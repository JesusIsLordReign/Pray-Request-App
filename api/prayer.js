// api/prayer.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { message } = req.body || {};
  if (!message || message.length < 10) {
    return res.status(400).json({ error: 'Message too short' });
  }
  return res.status(200).json({ ok: true, received: message });
}
