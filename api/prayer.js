// api/prayer.js
// Anonymous Prayer Request relay using Resend
// Works with Vercel serverless functions (CommonJS export)

const RECIPIENT = process.env.RECIPIENT_EMAIL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const FROM_ADDRESS = process.env.FROM_ADDRESS || "Prayer Relay <onboarding@resend.dev>";

module.exports = async (req, res) => {
  // Handle CORS preflight
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
    if (!RESEND_API_KEY) return res.status(500).json({ error: "Missing RESEND_API_KEY" });
    if (!RECIPIENT) return res.status(500).json({ error: "Missing RECIPIENT_EMAIL" });

    const { message, category = "", urgency = "", shareConsent = false } = req.body || {};
    if (typeof message !== "string") return res.status(400).json({ error: "Missing message" });

    const text = message.trim();
    if (text.length < 10 || text.length > 2000) {
      return res.status(400).json({ error: "Message length must be 10–2000 characters" });
    }

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

    // Call Resend API
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: toList,
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      let errText = "";
      try { errText = await resp.text(); } catch {}
      console.error("Resend error:", resp.status, errText);
      return res.status(502).json({ error: "Email service failed" });
    }

    // ✅ Generate short anonymous request ID
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();

    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
};

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
