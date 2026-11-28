# HK Crowd Worker

Anonymous crowd reports for the map: queue length, open/closed status.

## Deploy (5 minutes, free plan)

```powershell
cd E:\HK\hongkong-map\worker
npx wrangler login
npx wrangler kv namespace create REPORTS
```

Copy the returned `id` into `wrangler.toml` instead of `PASTE_KV_NAMESPACE_ID`, then:

```powershell
npx wrangler deploy
```

Wrangler prints the URL, e.g. `https://hk-crowd.<your-subdomain>.workers.dev`.

## Connect the map

Edit `E:\HK\hongkong-map\crowd.json` and set the URL:

```json
{ "api": "https://hk-crowd.<your-subdomain>.workers.dev" }
```

Commit and push. The report block appears in every place card automatically.

## Endpoints

- `GET /health`
- `GET /reports?key=22.29800,114.17200`
- `POST /report` with JSON `{ "key": "22.29800,114.17200", "kind": "queue", "value": 30 }`

`kind` is `open`, `closed` or `queue` (value in minutes, 0–180).

Reports expire after 6 hours; at most 60 reports are kept per place.

## Notes

- Data is public and anonymous. Respect Cloudflare's free plan limits.
- KV is eventually consistent: a report may take a few seconds to appear for other users.
- To wipe all reports, delete the KV namespace or its keys.
