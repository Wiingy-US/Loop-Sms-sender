// Sends ONE text via the Quo (OpenPhone) API. The web page calls this once per
// recipient and handles the pacing, so each invocation is fast and never times out.

const OPENPHONE_BASE = process.env.OPENPHONE_BASE || "https://api.openphone.com/v1";
const E164 = /^\+[1-9]\d{1,14}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  // Same-origin in production; permissive CORS also allows opening the page locally.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { password, to, content } = body;
  const from = body.from || process.env.OPENPHONE_FROM;

  // Auth for THIS page (the operator password you set in Vercel).
  if (!process.env.SEND_PASSWORD || password !== process.env.SEND_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Wrong access password" });
  }

  const apiKey = process.env.OPENPHONE_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: "OPENPHONE_API_KEY not set in Vercel" });
  if (!from) return res.status(400).json({ ok: false, error: "No 'from' number (set OPENPHONE_FROM in Vercel)" });
  if (!content || !content.trim()) return res.status(400).json({ ok: false, error: "Empty message" });
  if (!E164.test(String(to || "").trim())) {
    return res.status(400).json({ ok: false, error: "Number must be E.164, e.g. +15555550123" });
  }

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const r = await fetch(`${OPENPHONE_BASE}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: apiKey }, // raw key, no "Bearer"
        body: JSON.stringify({ from, to: [String(to).trim()], content }),
      });

      let data = null;
      try { data = await r.json(); } catch { /* non-JSON */ }

      if (r.ok) {
        const msgStatus = (data?.data?.status ?? "").toLowerCase();
        if (msgStatus === "failed" || msgStatus === "undelivered") {
          return res.status(200).json({
            ok: false,
            error: `Message ${msgStatus}` + (data?.data?.errorMessage ? `: ${data.data.errorMessage}` : ""),
            id: data?.data?.id ?? null,
            status: msgStatus,
          });
        }
        return res.status(200).json({ ok: true, id: data?.data?.id ?? null, status: data?.data?.status ?? "queued" });
      }
      // Retry only rate-limit / transient server errors.
      if ((r.status === 429 || r.status >= 500) && attempt < 2) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      // Report everything else (400 A2P, 402 no credits, 403, 404) back to the page.
      return res.status(200).json({
        ok: false,
        httpStatus: r.status,
        error: data?.message || data?.title || `HTTP ${r.status}`,
      });
    } catch (err) {
      if (attempt < 2) { await sleep(1500 * (attempt + 1)); continue; }
      return res.status(200).json({ ok: false, error: err.message });
    }
  }
}
