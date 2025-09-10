// api/prayer.js
// Zero-dependency Resend email relay for anonymous prayer requests.
// Works on Vercel Serverless. No SDK install needed.

const RECIPIENT = process.env.RECIPIENT_EMAIL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; // set to your site URL after first deploy
const FROM_ADDRESS = process.env.FROM_ADDRESS || "Prayer Relay <pray@your-domain.com>"; // optional

export default async function handler(req, res) {
  // CORS (allow your frontend to call this function from the browser)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: "Missing RESEND_API_KEY" });
    }
    if (!RECIPIENT) {
      return res.status(500).json({ error: "Missing RECIPIENT_EMAIL" });
    }

    const { message, category = "", urgency = "", shareConsent = false } = req.body || {};
    if (typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }
    const text = message.trim();
    if (text.length < 10 || text.length > 2000) {
      return res.status(400).json({ error: "Message length must be 10–2000 characters" });
    }

    // Support multiple recipients via comma-separated list
    const toList = RECIPIENT.split(",").map(s => s.trim()).filter(Boolean);
    const subject = `New Anonymous Prayer Request${urgency ? ` — ${urgency}` : ""}`;

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
        <h2 style="margin:0 0 8px;">Anonymous Prayer Request</h2>
        <pre style="white-space:pre-wrap;font:inherit;line-height:1.5;margin:0;">${escapeHtml(text)}</pre>
        <hr style="margin:16px 0;" />
        <p style="margin:4px 0;font-size:14px;color:#555;">
          <strong>Category:</strong> ${escapeHtml(category || "—")}<br/>
          <strong>Urgency:</strong> ${escapeHtml(urgency || "—")}<br/>
          <strong>Share consent:</strong> ${shareConsent ? "Yes" : "No"}
        </p>
        <p style="margin-top:16px;font-size:12px;color:#888;">Sent by the Anonymous Prayer App.</p>
      </div>`.trim();

    // Send via Resend REST API (no SDK)
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,          // e.g., "Prayer Relay <pray@your-domain.com>"
        to: toList,                  // array of recipients
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const err = await safeJson(resp);
      console.error("Resend error:", err);
      return res.status(502).json({ error: "Email service failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function safeJson(resp) {
  try { return await resp.json(); } catch { return { status: resp.status, text: await resp.text().catch(() => "") }; }
}
