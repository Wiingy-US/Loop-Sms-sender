# Quo (OpenPhone) bulk SMS sender

A one-page web app you deploy to Vercel. Paste phone numbers + a message, click
**Send**, and it texts them one at a time with a gap you choose (default 2s), so
you never hit Quo's 10-requests/second limit. Each message is a separate quick
call to the backend, so nothing times out even on a run that takes 8–10 minutes.

## Files
- `index.html` — the page (paste, send, live progress, download failures).
- `api/send-one.js` — sends one text; checks your password; keeps the API key server-side.
- `package.json` — declares Node 18+.

## Deploy
1. Put these files in a GitHub repo (keep `send-one.js` inside an `api/` folder).
2. In Vercel: **New Project → import the repo**.
3. Before deploying, add three Environment Variables (below), then **Deploy**.
4. Open the `*.vercel.app` URL.

## Environment variables (set in Vercel)
| Name | Value |
|------|-------|
| `OPENPHONE_API_KEY` | Your Quo key: Settings → Workspace → API → Generate API Key. |
| `OPENPHONE_FROM` | Your Quo sending number in E.164, e.g. `+15555550100`. |
| `SEND_PASSWORD` | Any password you invent. You'll type it into the page to send. |

Optional: `OPENPHONE_BASE` (defaults to `https://api.openphone.com/v1`; set to
`https://api.quo.com/v1` if Quo retires the old domain).

## Before a big run
- Test with 1–2 of your own numbers first.
- Make sure your Quo workspace has prepaid credits (messages fail with `402` if not).
- US texting needs A2P 10DLC registration approved, or carriers filter the messages.
- Only message people who opted in; keep "Reply STOP to opt out" in your text.
