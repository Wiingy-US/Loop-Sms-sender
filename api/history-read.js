const GITHUB_API = "https://api.github.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return res.status(200).json({ ok: false, rows: [], error: "GITHUB_TOKEN or GITHUB_REPO not configured" });
  }

  const branch = process.env.GITHUB_BRANCH || "main";

  try {
    const r = await fetch(`${GITHUB_API}/repos/${repo}/contents/history.csv?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });

    if (r.status === 404) {
      return res.status(200).json({ ok: true, rows: [], sha: null });
    }
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(200).json({ ok: false, rows: [], error: err.message || `GitHub ${r.status}` });
    }

    const data = await r.json();
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");
      if (parts.length >= 8) {
        rows.push({
          date: parts[0],
          total: parseInt(parts[1]) || 0,
          sent: parseInt(parts[2]) || 0,
          failed: parseInt(parts[3]) || 0,
          skipped: parseInt(parts[4]) || 0,
          duration: parts.slice(5, parts.length - 2).join(","),
          segments: parseInt(parts[parts.length - 2]) || 0,
          cost: parts[parts.length - 1],
        });
      }
    }

    return res.status(200).json({ ok: true, rows, sha: data.sha });
  } catch (err) {
    return res.status(200).json({ ok: false, rows: [], error: err.message });
  }
}
