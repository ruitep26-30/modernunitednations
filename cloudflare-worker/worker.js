/**
 * Modern United Nations - Cloudflare Worker for Brevo OTP Authentication
 *
 * Endpoints:
 *   POST /api/auth/send-otp   -> Generates 6-digit OTP & dispatches Brevo email
 *   POST /api/auth/verify-otp -> Verifies OTP against Cloudflare KV or cache
 *   OPTIONS *                 -> CORS preflight
 */

// In-memory fallback if Cloudflare KV is not yet bound
const memoryStore = new Map();

export default {
  async fetch(request, env, ctx) {
    // 1. Unified CORS Headers (Allows your frontend from any domain / localhost)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Helper to return JSON with CORS
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    };

    // Configuration from Cloudflare Environment Variables / Secrets
    const BREVO_API_KEY = env.BREVO_API_KEY || '';
    const BREVO_SENDER_EMAIL = env.BREVO_SENDER_EMAIL || 'auth@sevenauth.site';
    const BREVO_SENDER_NAME = env.BREVO_SENDER_NAME || 'Modern United Nations';
    const HMAC_SECRET = env.OTP_SECRET || env.BREVO_API_KEY || 'mun-auth-secure-otp-secret-2026';

    // -------------------------------------------------------------
    // Helper: Stateless Cryptographic HMAC Verification Tokens
    // Solves serverless isolate memory evictions & KV replication lag
    // -------------------------------------------------------------
    async function generateVerificationToken(email, code, expiresAt) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(HMAC_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const hashData = `${email}:${code}:${expiresAt}:${HMAC_SECRET}`;
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(hashData));
      const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const payload = JSON.stringify({ email, expiresAt, codeHash });
      const payloadB64 = btoa(payload);

      const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
      const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

      return `${payloadB64}.${sigB64}`;
    }

    async function verifyVerificationToken(token, inputEmail, inputCode) {
      if (!token || typeof token !== 'string' || !token.includes('.')) return false;
      const [pB64, sB64] = token.split('.');
      if (!pB64 || !sB64) return false;

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(HMAC_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      try {
        const sigBytes = Uint8Array.from(atob(sB64), c => c.charCodeAt(0));
        const isValidSig = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(pB64));
        if (!isValidSig) return false;

        const payload = JSON.parse(atob(pB64));
        if (!payload || payload.email !== inputEmail) return false;
        if (payload.expiresAt < Date.now()) return false;

        const testHashData = `${inputEmail}:${inputCode}:${payload.expiresAt}:${HMAC_SECRET}`;
        const testHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(testHashData));
        const testCodeHash = Array.from(new Uint8Array(testHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        return testCodeHash === payload.codeHash;
      } catch (e) {
        return false;
      }
    }

    // -------------------------------------------------------------
    // Helper: KV Store / Memory Store operations
    // -------------------------------------------------------------
    async function saveOtp(email, record) {
      if (env.OTP_KV) {
        // Cloudflare KV with automatic 10-minute expiry (600 seconds)
        await env.OTP_KV.put(`otp:${email}`, JSON.stringify(record), { expirationTtl: 600 });
      } else {
        memoryStore.set(email, record);
      }
    }

    async function getOtp(email) {
      if (env.OTP_KV) {
        const raw = await env.OTP_KV.get(`otp:${email}`);
        return raw ? JSON.parse(raw) : null;
      }
      return memoryStore.get(email) || null;
    }

    async function deleteOtp(email) {
      if (env.OTP_KV) {
        await env.OTP_KV.delete(`otp:${email}`);
      } else {
        memoryStore.delete(email);
      }
    }

    // -------------------------------------------------------------
    // GET / (Health Check & Status)
    // -------------------------------------------------------------
    if (request.method === 'GET' && (pathname === '/' || pathname === '')) {
      return jsonResponse({
        status: 'online',
        service: 'Modern United Nations Auth API',
        configured: {
          brevoKeySet: !!BREVO_API_KEY && BREVO_API_KEY !== 'your_brevo_api_key_here',
          senderEmail: BREVO_SENDER_EMAIL
        },
        endpoints: {
          sendOtp: 'POST /api/auth/send-otp',
          verifyOtp: 'POST /api/auth/verify-otp'
        }
      }, 200);
    }

    // -------------------------------------------------------------
    // POST /api/auth/send-otp
    // -------------------------------------------------------------
    if (request.method === 'POST' && pathname === '/api/auth/send-otp') {
      try {
        const body = await request.json().catch(() => ({}));
        const email = (body.email || '').trim().toLowerCase();
        const name = (body.name || '').trim();

        if (!email || !email.includes('@')) {
          return jsonResponse({ success: false, error: 'A valid email address is required.' }, 400);
        }

        const now = Date.now();
        const existing = await getOtp(email);

        // 60-second cooldown rate limit
        if (existing && existing.lastSent && (now - existing.lastSent < 60000)) {
          const remainingSecs = Math.ceil((60000 - (now - existing.lastSent)) / 1000);
          return jsonResponse({
            success: false,
            error: `Please wait ${remainingSecs}s before requesting a new code.`,
            cooldown: remainingSecs
          }, 429);
        }

        // Generate cryptographically secure 6-digit OTP
        const randomBuffer = new Uint32Array(1);
        crypto.getRandomValues(randomBuffer);
        const otpCode = ((randomBuffer[0] % 900000) + 100000).toString();

        const record = {
          code: otpCode,
          expiresAt: now + 10 * 60 * 1000, // 10 minutes
          attempts: 0,
          lastSent: now
        };

        const verificationToken = await generateVerificationToken(email, otpCode, record.expiresAt);

        await saveOtp(email, record);

        // Call Brevo REST API
        const brevoPayload = {
          sender: {
            name: BREVO_SENDER_NAME,
            email: BREVO_SENDER_EMAIL
          },
          to: [{ email, name: name || 'MUN Delegate' }],
          subject: `${otpCode} is your Modern United Nations verification code`,
          htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!--[if !mso]><!-->
<style type="text/css">
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
  @font-face {
    font-family: 'Poppins';
    font-style: normal;
    font-weight: 400;
    src: url('https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecg.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Poppins';
    font-style: normal;
    font-weight: 500;
    src: url('https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLGT9Z1xlFQ.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Poppins';
    font-style: normal;
    font-weight: 600;
    src: url('https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Poppins';
    font-style: normal;
    font-weight: 700;
    src: url('https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2') format('woff2');
  }
  body, table, td, p, span, h1, a {
    font-family: 'Poppins', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
  }
</style>
<!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:#ffffff;-webkit-font-smoothing:antialiased;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff">
    <tr>
      <td align="center" style="padding:64px 24px 56px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;width:100%;">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding-bottom:52px;">
              <span style="font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#1d1d1f;letter-spacing:0.6px;text-transform:uppercase;">Modern United Nations</span>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td align="center" style="padding-bottom:10px;">
              <h1 style="margin:0;font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#1d1d1f;line-height:1.3;letter-spacing:-0.3px;">Verify your email</h1>
            </td>
          </tr>

          <!-- Subtext -->
          <tr>
            <td align="center" style="padding-bottom:44px;">
              <p style="margin:0;font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;color:#6e6e73;line-height:1.65;">${name ? `Hi ${name}, use` : 'Use'} the code below to complete your sign-up.</p>
            </td>
          </tr>

          <!-- OTP Code -->
          <tr>
            <td align="center" style="padding-bottom:44px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:#f0f6ff;border-radius:10px;padding:22px 52px;">
                    <span style="font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:38px;font-weight:700;letter-spacing:14px;color:#2563eb;line-height:1;display:block;">${otpCode}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry -->
          <tr>
            <td align="center" style="padding-bottom:52px;">
              <p style="margin:0;font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:400;color:#6e6e73;line-height:1.65;">Expires in <span style="color:#1d1d1f;font-weight:500;">10 minutes</span>. Do not share this code.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding-bottom:28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="height:1px;background:#e5e5ea;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center">
              <p style="margin:0 0 6px;font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:400;color:#aeaeb2;line-height:1.6;">If you didn&rsquo;t request this, you can safely ignore this email.</p>
              <p style="margin:0;font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:400;color:#aeaeb2;line-height:1.6;">&copy; 2026 Modern United Nations</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
          `
        };

        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(brevoPayload)
        });

        if (!brevoRes.ok) {
          const errDetail = await brevoRes.text();
          console.error('Brevo API Error:', errDetail);
          let errorMsg = 'Failed to deliver email via Brevo.';
          try {
            const parsed = JSON.parse(errDetail);
            if (parsed.message) errorMsg = parsed.message;
          } catch (e) {}
          return jsonResponse({
            success: false,
            error: errorMsg
          }, brevoRes.status);
        }

        return jsonResponse({
          success: true,
          message: 'Verification code sent to your email.',
          verificationToken,
          token: verificationToken,
          cooldown: 60
        });

      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // -------------------------------------------------------------
    // POST /api/auth/verify-otp
    // -------------------------------------------------------------
    if (request.method === 'POST' && pathname === '/api/auth/verify-otp') {
      try {
        const body = await request.json().catch(() => ({}));
        const email = (body.email || '').trim().toLowerCase();
        const otp = (body.otp || '').trim();

        if (!email || !otp) {
          return jsonResponse({ success: false, error: 'Email and OTP code are required.' }, 400);
        }

        // 1. Try stateless cryptographic token verification first (Zero-dependency on isolate memory / KV lag)
        const token = body.token || body.verificationToken;
        if (token) {
          const isValid = await verifyVerificationToken(token, email, otp);
          if (isValid) {
            await deleteOtp(email);
            return jsonResponse({
              success: true,
              verified: true,
              message: 'Email successfully verified!'
            });
          }
        }

        // 2. Fallback: Query KV or in-memory store
        const record = await getOtp(email);
        const now = Date.now();

        if (!record || record.expiresAt < now) {
          if (token) {
            return jsonResponse({
              success: false,
              error: 'Incorrect verification code. Please check your email and try again.'
            }, 400);
          }
          return jsonResponse({
            success: false,
            error: 'Verification code has expired or was not requested. Please request a new code.'
          }, 400);
        }

        if (record.attempts >= 5) {
          await deleteOtp(email);
          return jsonResponse({
            success: false,
            error: 'Too many incorrect attempts. Code has been invalidated. Please request a new code.'
          }, 429);
        }

        if (record.code !== otp) {
          record.attempts += 1;
          await saveOtp(email, record);
          const remaining = 5 - record.attempts;
          return jsonResponse({
            success: false,
            error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
            attemptsLeft: remaining
          }, 400);
        }

        // OTP is valid! Delete record so it cannot be reused
        await deleteOtp(email);

        return jsonResponse({
          success: true,
          verified: true,
          message: 'Email successfully verified!'
        });

      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // Default 404
    return jsonResponse({ error: 'Endpoint not found on Cloudflare Worker' }, 404);
  }
};

