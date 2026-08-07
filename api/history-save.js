const GITHUB_API = "https://api.github.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { password, rows } = body;

  if (!process.env.SEND_PASSWORD || password !== process.env.SEND_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Wrong access password" });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return res.status(500).json({ ok: false, error: "GITHUB_TOKEN or GITHUB_REPO not set in Vercel" });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ ok: false, error: "No rows to save" });
  }

  const branch = process.env.GITHUB_BRANCH || "main";

  try {
    let sha = null;
    let existing = "Date,Total,Sent,Failed,Skipped,Duration,Segments,Cost\n";

    const getRes = await fetch(`${GITHUB_API}/repos/${repo}/contents/history.csv?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });

    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      existing = Buffer.from(data.content, "base64").toString("utf-8");
      if (!existing.endsWith("\n")) existing += "\n";
    }

    for (const r of rows) {
      existing += [r.date, r.total, r.sent, r.failed, r.skipped, r.duration, r.segments, r.cost].join(",") + "\n";
    }

    const putBody = {
      message: "Update SMS run history",
      content: Buffer.from(existing).toString("base64"),
      branch,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(`${GITHUB_API}/repos/${repo}/contents/history.csv`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      return res.status(200).json({ ok: false, error: err.message || `GitHub ${putRes.status}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
}
