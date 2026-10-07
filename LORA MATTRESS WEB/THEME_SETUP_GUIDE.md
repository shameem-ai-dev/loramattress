# LORA Mattress — Premium Shopify Theme Setup & Merchant Guide

## 1. Overview
The **LORA Mattress Luxury Theme** is a bespoke Shopify Online Store 2.0 theme built from scratch for the Indian luxury sleep market. It combines an editorial aesthetic (warm ivory, soft sand, deep espresso, muted olive, and restrained brass accents) with robust e-commerce capabilities:
- **Signature Night-to-Morning Hero**: Interactive scroll-driven transition from quiet midnight to radiant morning light with instant skip controls.
- **Find Your Comfort Quiz**: 5-step guided mattress selector recommending tailored firmness profiles with clinical and ergonomic rationale.
- **Inside the Comfort Explorer**: Material layer showcase detailing Belgian linen, 100% natural Dunlop latex, and zoned titanium pocket coils.
- **3-Way Mattress Comparison Engine**: Persistent dock and comparative modal analyzing firmness, price, warranty, and layers.
- **AJAX Slide-Out Cart Drawer**: Live free white-glove setup threshold progress bar, order notes, and direct checkout.
- **Quick View Modal & Size Guide**: Indian cot dimensions chart (Single, Diwan, Queen, King, Custom).
- **Localized for India**: Native INR (₹) formatting, WhatsApp Sleep Concierge integration, and showroom details for Mumbai, Delhi, and Bengaluru.

---

## 2. Installation & Upload Instructions

### Step 1: Upload Theme ZIP to Shopify
1. Log into your Shopify Admin dashboard (`your-store.myshopify.com/admin`).
2. Navigate to **Online Store** > **Themes**.
3. In the **Theme library** section, click **Add theme** > **Upload zip file**.
4. Select `lora-mattress-shopify-theme.zip` from your local machine.
5. Click **Upload file**. Shopify will validate and unpack the theme as an **unpublished theme**.
6. Click **Actions** > **Preview** to inspect the theme privately without affecting your live storefront.

---

## 3. Product Metafield Definitions
To take full advantage of LORA's structured comfort badges, layer breakdowns, and specifications, set up the following metafields in **Settings** > **Custom data** > **Products**:

| Name | Namespace & Key | Type | Description / Example |
| :--- | :--- | :--- | :--- |
| **Comfort Level** | `custom.comfort_level` | Single line text | e.g. `Balanced Medium-Firm (6.5 / 10)` or `Plush Cloud (4 / 10)` |
| **Product Tagline** | `custom.tagline` | Single line text | e.g. `Natural Dunlop Latex & Zoned Titanium Pocket Springs` |
| **Manufacturing Origin** | `custom.origin` | Single line text | e.g. `Direct from LORA Advanced Robotics Facility` |
| **Warranty Terms** | `custom.warranty_terms` | Single line text | e.g. `10-Year Comprehensive Replacement Warranty` |
| **Layer Architecture** | `custom.layer_architecture`| Multi-line text | Bulleted summary of comfort and support layers |

---

## 4. Theme Editor Customization

Click **Customize** next to the LORA Mattress theme in **Online Store** > **Themes**:

### A. Brand Colors & Typography
- **Theme Settings** > **Brand & Colors**: Adjust Warm Ivory, Soft Sand, Deep Espresso, Muted Olive, and Restrained Brass palette tokens.
- **Theme Settings** > **Typography**: Customize editorial serif heading font and body font sizing.

### B. Free White-Glove In-Home Setup Threshold
- **Theme Settings** > **Cart & Delivery Tiers**:
  - Set `Free White-Glove In-Home Delivery Threshold (INR)` (Default: `35000` = ₹35,000).
  - Enable/disable order notes for delivery instructions (floor number, lift access).

### C. WhatsApp Concierge Integration
- **Theme Settings** > **Customer Care & WhatsApp**:
  - Enter your official WhatsApp business phone number with country code (e.g. `+919876543210`).
  - Enter your default inquiry message text.

### D. Showroom & Sleep Studio Locations
- Open the **Showrooms & Assistance** section on the homepage:
  - Configure addresses, phone numbers, visiting hours, and studio consultation booking links for Mumbai, Bengaluru, and New Delhi (or add custom studio blocks).

---

## 5. Recommended App Integrations
The theme includes native `@app` block placeholders for seamless compatibility:
1. **Product Reviews**: Judge.me Product Reviews, Yotpo, or Okendo (render directly into the dedicated customer reviews section).
2. **Search & Discovery**: Shopify Search & Discovery app for enhanced filter facets and product recommendations.
3. **Subscriptions / Financing**: No-cost EMI payment gateway blocks (Razorpay, Cashfree, Pine Labs).

---

## 6. Local Interactive Preview
For local preview and demonstration without uploading to Shopify:
1. Run `node preview/server.js` from the theme root.
2. Open `http://localhost:3456` in any modern desktop or mobile browser.
3. Visit `http://localhost:3456/products/lora-balance-hybrid` to preview the dedicated product page.
