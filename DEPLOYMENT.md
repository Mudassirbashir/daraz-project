# 🚀 Deployment Guide — Daraz Operations Management System

This application can be deployed to **Vercel** or **Cloudflare Pages / Workers (via OpenNext)** without any code modifications.

---

## Option 1: Deploy to Vercel (Recommended)

Vercel provides out-of-the-box support for Next.js App Router applications and serverless Cron jobs.

### 1. Import Repository
1. Push this repository to GitHub/GitLab.
2. Go to [Vercel Dashboard](https://vercel.com/dashboard) -> **Add New Project**.
3. Select this repository.

### 2. Configure Environment Variables
Add the following Environment Variables in Vercel Project Settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

DARAZ_APP_KEY=your-daraz-app-key
DARAZ_APP_SECRET=your-daraz-app-secret
DARAZ_API_BASE_URL=https://api.daraz.pk/rest

NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
CRON_SECRET=your-secure-random-cron-secret
DARAZ_ENCRYPTION_SECRET=your-32-byte-aes-256-encryption-key
```

---

## 🗄️ Database Migrations & Schema Overview

Apply all migration SQL scripts located in `supabase/migrations/` sequentially or via Supabase CLI:

```bash
npx supabase db push
```

### Key Tables & Composite Identity Controls:
1. **`daraz_stores`**: Multi-tenant Daraz Pakistan store slots with `encrypted_access_token`, `encrypted_refresh_token`, `encrypted_api_app_secret`, and `token_refresh_locked_until` DB lock.
2. **`master_skus`**: Central inventory ledger master catalog storing `physical_quantity`, `reserved_quantity`, `damaged_quantity`, and `safety_stock_quantity`.
3. **`barcode_mappings`**: EAN/UPC/Custom barcode to Master SKU mapping table per store with `(barcode, store_id, seller_sku)` unique constraint.
4. **`inventory_ledger`**: Audit ledger tracking every stock movement (`INBOUND`, `OUTBOUND`, `ORDER_RESERVED`, `ORDER_FULFILLED`, `RETURN_RESTOCKED`, `ADJUSTMENT`, `SAFETY_BUFFER_CHANGE`).
5. **`background_jobs`**: Asynchronous task queue runner table (`orders_sync`, `products_sync`, `inventory_push`, `token_refresh`, `fulfillment_push`) with exponential backoff scheduling.

---

## 📡 API Routes Map

- `POST /api/sync`: Full catalog, stock, and orders incremental sync trigger.
- `POST /api/sync/retry`: Asynchronous background job manual retry endpoint.
- `POST /api/stores/[id]/test-connection`: Real-time Daraz Seller Center API connectivity diagnostic test.
- `GET /api/dashboard/stock-mismatch`: Stock discrepancy report API between physical ledger stock and Daraz allocated stock.
- `GET /api/auth/daraz/callback`: Daraz OAuth authorization code callback handler.

---

## ⚙️ Background Worker Queue Design & Error Model

- **Queue Execution**: Jobs in `background_jobs` are polled or scheduled via serverless cron.
- **Exponential Backoff**: Retries up to 5 attempts with delay calculated as `2^attempts * 10s` (10s, 20s, 40s, 80s, 160s).
- **Credentials Masking**: All API request/response payloads written to logs pass through `sanitizeLogPayload` redacting tokens and secrets.

### 3. Deploy
- Default Build Command: `npm run build` (`next build`)
- Output Directory: `.next`
- Click **Deploy**. Vercel will build and deploy the app automatically.

---

## Option 2: Deploy to Cloudflare (Workers / Pages via OpenNext)

### 1. Local Build & Test
```bash
# Run Cloudflare OpenNext build
npm run build:cf

# Preview locally using Wrangler
npm run preview:cf
```

### 2. Deploy via Wrangler CLI
```bash
# Deploy to Cloudflare Workers
npm run deploy:cf
```

### 3. Environment Secrets on Cloudflare
In Cloudflare Dashboard (Workers & Pages -> Settings -> Environment Variables) or via Wrangler CLI:

```bash
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put DARAZ_APP_KEY
npx wrangler secret put DARAZ_APP_SECRET
```

---

## 🛠️ Summary of Applied Deployment Fixes

- **Default Build Command**: `package.json` updated with `"build": "next build"` for standard Vercel auto-detection, and `"build:cf": "opennextjs-cloudflare build"` for Cloudflare OpenNext.
- **Wrangler Cleanup**: Removed invalid placeholder KV namespace binding (`NEXT_CACHE_WORKERS_KV`) from `wrangler.jsonc`.
- **Dynamic API Routes**: Added `export const dynamic = "force-dynamic";` to all API handlers to prevent static rendering errors during `next build`.
- **Build-Safe Clients**: Provided fallback values when environment variables are missing during static generation (SSG) so pre-rendering won't crash.
- **Next.js Config**: Cleaned up wildcard `remotePatterns` and added `unoptimized: true` image handling for Edge Runtime compatibility.
