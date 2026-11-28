// Crowd reports for the Hong Kong map.
// Stores short-lived anonymous reports in Workers KV.
// Endpoints:
//   GET  /reports?key=22.29800,114.17200
//   POST /report  { key, kind: "open"|"closed"|"queue", value?: minutes }
//   GET  /health

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

const TTL = 6 * 60 * 60; // reports live for 6 hours
const MAX_REPORTS = 60;  // keep the newest reports per place

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS }
  });
}

function normalizeKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  const parts = raw.split(",");
  if (parts.length !== 2) return "";
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  // Hong Kong bounding box, generous margins.
  if (lat < 22.0 || lat > 22.7 || lng < 113.7 || lng > 114.7) return "";
  return lat.toFixed(5) + "," + lng.toFixed(5);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "hk-crowd", now: Date.now() });
    }

    if (url.pathname === "/reports" && request.method === "GET") {
      const key = normalizeKey(url.searchParams.get("key"));
      if (!key) return json({ error: "bad key" }, 400);
      const stored = await env.REPORTS.get("p:" + key, { type: "json" });
      const list = Array.isArray(stored) ? stored : [];
      const fresh = list.filter((r) => r && Date.now() - r.ts < TTL * 1000);
      return json({ key, reports: fresh });
    }

    if (url.pathname === "/report" && request.method === "POST") {
      const text = await request.text();
      if (text.length > 2048) return json({ error: "too large" }, 413);

      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "bad json" }, 400);
      }

      const key = normalizeKey(body && body.key);
      const kind = body && body.kind;
      if (!key || !["open", "closed", "queue"].includes(kind)) {
        return json({ error: "bad payload" }, 400);
      }

      let value = 0;
      if (kind === "queue") {
        value = Math.max(0, Math.min(180, Math.round(Number(body.value) || 0)));
      }

      const kvKey = "p:" + key;
      const stored = await env.REPORTS.get(kvKey, { type: "json" });
      let list = Array.isArray(stored) ? stored : [];
      list.push({ ts: Date.now(), kind, value });
      // Drop stale entries and keep a bounded list.
      list = list
        .filter((r) => r && Date.now() - r.ts < TTL * 1000)
        .slice(-MAX_REPORTS);

      await env.REPORTS.put(kvKey, JSON.stringify(list), {
        expirationTtl: TTL
      });

      return json({ ok: true, key, reports: list });
    }

    return json({ error: "not found" }, 404);
  }
};
