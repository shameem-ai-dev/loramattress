// LORA — Permanent Cloud Storage (S3-compatible: Cloudflare R2, AWS S3, Backblaze B2, DigitalOcean Spaces, Wasabi)
//
// Why: the GoDaddy Node.js hosting container is recycled/redeployed periodically, and EVERYTHING on its
// local disk (uploaded product photos, reel videos, catalog/orders JSON) is wiped when that happens.
// This module mirrors those files to an external bucket and restores them automatically on startup.
//
// Required environment variables (set in GoDaddy → Node.js App → Environment Variables):
//   S3_ENDPOINT          e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com   (R2)  |  https://s3.ap-south-1.amazonaws.com (AWS)
//   S3_BUCKET            e.g. lora-media
//   S3_ACCESS_KEY_ID
//   S3_SECRET_ACCESS_KEY
// Optional:
//   S3_REGION            default "auto" (R2). Use your AWS region for S3, e.g. ap-south-1
//   S3_PUBLIC_URL        public bucket / CDN URL (e.g. https://media.loramattress.com). When set, missing
//                        uploads are served by redirecting to the CDN instead of proxying through the server.
//   S3_PREFIX            key prefix inside the bucket, default "lora"
//
// Zero dependencies — implements AWS Signature V4 with Node's built-in crypto/https.

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function cfg() {
  const endpoint = (process.env.S3_ENDPOINT || '').trim().replace(/\/+$/, '');
  return {
    endpoint,
    bucket: (process.env.S3_BUCKET || '').trim(),
    accessKeyId: (process.env.S3_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.S3_SECRET_ACCESS_KEY || '').trim(),
    region: (process.env.S3_REGION || 'auto').trim(),
    publicUrl: (process.env.S3_PUBLIC_URL || '').trim().replace(/\/+$/, ''),
    prefix: (process.env.S3_PREFIX || 'lora').trim().replace(/^\/+|\/+$/g, '')
  };
}

function isEnabled() {
  const c = cfg();
  return Boolean(c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey);
}

function fullKey(key) {
  const c = cfg();
  const k = String(key).replace(/^\/+/, '');
  return c.prefix ? `${c.prefix}/${k}` : k;
}

function publicUrlFor(key) {
  const c = cfg();
  return c.publicUrl ? `${c.publicUrl}/${fullKey(key).split('/').map(encodeRfc3986).join('/')}` : '';
}

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// Low-level signed request. body: Buffer | fs.ReadStream | null
function signedRequest(method, key, { query = {}, body = null, contentLength, contentType, payloadHash, stream = false } = {}) {
  const c = cfg();
  const url = new URL(c.endpoint);
  const objectPath = key == null ? '' : '/' + fullKey(key).split('/').map(encodeRfc3986).join('/');
  const canonicalUri = `/${encodeRfc3986(c.bucket)}${objectPath}`;
  const canonicalQuery = Object.keys(query).sort()
    .map(k => `${encodeRfc3986(k)}=${encodeRfc3986(String(query[k]))}`).join('&');

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const hash = payloadHash || (Buffer.isBuffer(body) ? sha256Hex(body) : (body ? 'UNSIGNED-PAYLOAD' : sha256Hex('')));

  const headers = {
    host: url.host,
    'x-amz-content-sha256': hash,
    'x-amz-date': amzDate
  };
  if (contentType) headers['content-type'] = contentType;
  const len = contentLength != null ? contentLength : (Buffer.isBuffer(body) ? body.length : (body ? undefined : 0));
  if (len != null && (method === 'PUT' || method === 'POST')) headers['content-length'] = String(len);

  const signedHeaderKeys = Object.keys(headers).filter(h => h !== 'content-length').sort();
  const canonicalHeaders = signedHeaderKeys.map(h => `${h}:${String(headers[h]).trim()}\n`).join('');
  const signedHeaders = signedHeaderKeys.join(';');
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, hash].join('\n');
  const scope = `${dateStamp}/${c.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac('AWS4' + c.secretAccessKey, dateStamp);
  const kSigning = hmac(hmac(hmac(kDate, c.region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      method,
      hostname: url.hostname,
      port: url.port || undefined,
      path: canonicalUri + (canonicalQuery ? `?${canonicalQuery}` : ''),
      headers,
      timeout: 10 * 60 * 1000
    }, res => {
      if (stream) return resolve(res);
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Cloud storage request timed out')));
    req.on('error', reject);
    if (body && typeof body.pipe === 'function') {
      body.on('error', err => req.destroy(err));
      body.pipe(req);
    } else {
      req.end(body || undefined);
    }
  });
}

async function putBuffer(key, buffer, contentType) {
  const r = await signedRequest('PUT', key, { body: buffer, contentType: contentType || 'application/octet-stream' });
  if (r.status < 200 || r.status >= 300) throw new Error(`Cloud PUT ${key} failed (${r.status}): ${r.body.toString().slice(0, 300)}`);
  return true;
}

// Single PUT is capped at 5 GiB by S3/R2 — anything larger goes multipart.
function multipartThreshold() {
  const v = Number(process.env.S3_MULTIPART_THRESHOLD_BYTES || 0);
  return v > 0 ? v : Math.floor(4.5 * 1024 ** 3);
}
// R2 requires equal-sized parts (except the last). Large parts = fewer cloud requests.
function partSizeFor(size) {
  const min = Number(process.env.S3_MIN_PART_BYTES || 0) || 256 * 1024 * 1024;
  return Math.max(min, Math.ceil(size / 9000));
}

async function putFile(key, filePath, contentType) {
  const size = fs.statSync(filePath).size;
  // Small files: signed payload hash. Large files (videos): streamed with UNSIGNED-PAYLOAD over HTTPS.
  if (size <= 8 * 1024 * 1024) return putBuffer(key, fs.readFileSync(filePath), contentType);
  if (size > multipartThreshold()) return putFileMultipart(key, filePath, size, contentType);
  const r = await signedRequest('PUT', key, {
    body: fs.createReadStream(filePath),
    contentLength: size,
    contentType: contentType || 'application/octet-stream',
    payloadHash: 'UNSIGNED-PAYLOAD'
  });
  if (r.status < 200 || r.status >= 300) throw new Error(`Cloud PUT ${key} failed (${r.status}): ${r.body.toString().slice(0, 300)}`);
  return true;
}

// Downloads an object to destPath atomically. Returns true if found, false if missing.
async function getToFile(key, destPath) {
  const res = await signedRequest('GET', key, { stream: true });
  if (res.statusCode === 404) { res.resume(); return false; }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    res.resume();
    throw new Error(`Cloud GET ${key} failed (${res.statusCode})`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tmp = `${destPath}.cloud-${process.pid}-${Date.now()}.part`;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    res.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    res.on('error', reject);
  });
  fs.renameSync(tmp, destPath);
  return true;
}

async function putFileMultipart(key, filePath, size, contentType) {
  const uploadId = await createMultipart(key, contentType);
  const partSize = partSizeFor(size);
  const parts = [];
  try {
    for (let n = 1, start = 0; start < size; n++, start += partSize) {
      const end = Math.min(size, start + partSize) - 1;
      const r = await signedRequest('PUT', key, {
        query: { partNumber: String(n), uploadId },
        body: fs.createReadStream(filePath, { start, end }),
        contentLength: end - start + 1,
        payloadHash: 'UNSIGNED-PAYLOAD'
      });
      if (r.status !== 200) throw new Error(`Cloud part ${n} failed (${r.status}): ${r.body.toString().slice(0, 300)}`);
      parts.push({ partNumber: n, etag: r.headers.etag });
    }
    await completeMultipart(key, uploadId, parts);
  } catch (e) {
    await abortMultipart(key, uploadId).catch(() => {});
    throw e;
  }
  return true;
}

const xmlDecode = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const xmlEncode = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Lists every object under a RAW bucket prefix ('' = whole bucket). Returns [{ key, size }] with full keys.
// One request per 1000 objects.
async function listRaw(rawPrefix = '') {
  const objects = [];
  let token = null;
  do {
    const query = { 'list-type': '2', prefix: rawPrefix, 'max-keys': '1000' };
    if (token) query['continuation-token'] = token;
    const r = await signedRequest('GET', null, { query });
    if (r.status !== 200) throw new Error(`Cloud LIST failed (${r.status}): ${r.body.toString().slice(0, 300)}`);
    const xml = r.body.toString('utf8');
    const re = /<Contents>([\s\S]*?)<\/Contents>/g;
    let m;
    while ((m = re.exec(xml))) {
      const k = /<Key>([\s\S]*?)<\/Key>/.exec(m[1]);
      const s = /<Size>(\d+)<\/Size>/.exec(m[1]);
      if (k) objects.push({ key: xmlDecode(k[1]), size: s ? Number(s[1]) : 0 });
    }
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const next = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml);
    token = truncated && next ? xmlDecode(next[1]) : null;
  } while (token);
  return objects;
}

// Lists keys (relative to S3_PREFIX) under a sub-prefix, e.g. list('uploads/')
async function list(subPrefix) {
  const c = cfg();
  const base = c.prefix ? `${c.prefix}/` : '';
  return (await listRaw(base + subPrefix)).map(o => o.key.slice(base.length));
}

// Size in bytes, or null if the object does not exist.
async function head(key) {
  const r = await signedRequest('HEAD', key);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(`Cloud HEAD ${key} failed (${r.status})`);
  return Number(r.headers['content-length'] || 0);
}

async function del(key) {
  const r = await signedRequest('DELETE', key);
  if (r.status !== 204 && r.status !== 200 && r.status !== 404) throw new Error(`Cloud DELETE ${key} failed (${r.status})`);
  return true;
}

async function createMultipart(key, contentType) {
  const r = await signedRequest('POST', key, { query: { uploads: '' }, contentType: contentType || 'application/octet-stream' });
  const m = /<UploadId>([\s\S]*?)<\/UploadId>/.exec(r.body.toString('utf8'));
  if (r.status !== 200 || !m) throw new Error(`Cloud multipart start failed (${r.status}): ${r.body.toString().slice(0, 300)}`);
  return xmlDecode(m[1]);
}

async function completeMultipart(key, uploadId, parts) {
  const xml = '<CompleteMultipartUpload>' + parts
    .slice().sort((a, b) => a.partNumber - b.partNumber)
    .map(p => `<Part><PartNumber>${Number(p.partNumber)}</PartNumber><ETag>${xmlEncode(p.etag)}</ETag></Part>`).join('') +
    '</CompleteMultipartUpload>';
  const r = await signedRequest('POST', key, { query: { uploadId }, body: Buffer.from(xml), contentType: 'application/xml' });
  // S3 may return 200 with an <Error> body for completion failures.
  if (r.status !== 200 || /<Error>/.test(r.body.toString('utf8'))) {
    throw new Error(`Cloud multipart complete failed (${r.status}): ${r.body.toString().slice(0, 300)}`);
  }
  return true;
}

async function abortMultipart(key, uploadId) {
  const r = await signedRequest('DELETE', key, { query: { uploadId } });
  if (r.status !== 204 && r.status !== 200 && r.status !== 404) throw new Error(`Cloud multipart abort failed (${r.status})`);
  return true;
}

// Query-string signed URL (SigV4 presign) so the browser can upload straight to the bucket.
function presignUrl(method, key, { query = {}, expiresIn = 3600 } = {}) {
  const c = cfg();
  const url = new URL(c.endpoint);
  const canonicalUri = `/${encodeRfc3986(c.bucket)}/` + fullKey(key).split('/').map(encodeRfc3986).join('/');
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${c.region}/s3/aws4_request`;
  const q = Object.assign({}, query, {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${c.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.min(604800, Math.max(1, Math.floor(expiresIn)))),
    'X-Amz-SignedHeaders': 'host'
  });
  const canonicalQuery = Object.keys(q).sort().map(k => `${encodeRfc3986(k)}=${encodeRfc3986(String(q[k]))}`).join('&');
  const canonicalRequest = [method, canonicalUri, canonicalQuery, `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac('AWS4' + c.secretAccessKey, dateStamp);
  const kSigning = hmac(hmac(hmac(kDate, c.region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return `${url.protocol}//${url.host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function status() {
  const c = cfg();
  return {
    enabled: isEnabled(),
    provider: /r2\.cloudflarestorage\.com/.test(c.endpoint) ? 'cloudflare_r2' : (c.endpoint ? 's3_compatible' : 'none'),
    bucket: c.bucket || null,
    publicUrl: c.publicUrl || null
  };
}

module.exports = {
  isEnabled, status, fullKey, putBuffer, putFile, getToFile, list, listRaw, head, del, publicUrlFor,
  presignUrl, createMultipart, completeMultipart, abortMultipart, multipartThreshold, partSizeFor
};
