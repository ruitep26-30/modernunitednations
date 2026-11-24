# Modern United Nations - Cloudflare Worker for Brevo OTP

This Cloudflare Worker handles secure 6-digit OTP email verification via Brevo (formerly Sendinblue) with zero servers to manage.

---

## 🚀 Fast 2-Minute Deployment (via Cloudflare Web Dashboard)

No command line needed! You can deploy this in 2 minutes directly from your browser:

### 1. Log in to Cloudflare
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) (create a free account if you don't have one).
2. On the left navigation, click **Compute (Workers) > Workers & Pages**.
3. Click **Create** > **Create Worker**.
4. Name your worker ( `mun-auth-worker`) and click **Deploy**.

### 2. Paste the Worker Code
1. Click **Edit code** on your newly created worker.
2. Replace all the placeholder code in the left editor with the contents of [`worker.js`](./worker.js).
3. Click **Deploy** in the top right.

### 3. Add Your Secrets & Variables
1. Go back to your Worker's main page in the Cloudflare dashboard.
2. Click the **Settings** tab > **Variables and Secrets**.
3. Under **Environment Variables**, add:
   - `BREVO_SENDER_NAME` = `Modern United Nations`
   - `BREVO_SENDER_EMAIL` = `your_verified_sender@domain.com`
4. Under **Secrets**, click **Add secret**:
   - Variable name: `BREVO_API_KEY`
   - Value: `xkeysib-...` (Your Brevo API key)
   - Click **Save**.

### 4. Connect to Your Frontend
1. Copy your worker's public URL from the top of the Cloudflare page ( `https://mun-auth-worker.YOUR_SUBDOMAIN.workers.dev`).
2. In `signup.html`, update line 177:
   ```javascript
   const WORKER_API_BASE = 'https://mun-auth-worker.YOUR_SUBDOMAIN.workers.dev';
   ```

---

## 🛠️ Optional: CLI Deployment (via Wrangler)

If you prefer using the command line:

```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Deploy the worker
npx wrangler deploy

# 3. Add your secret Brevo API key
npx wrangler secret put BREVO_API_KEY
```

