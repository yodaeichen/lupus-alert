import { Hono } from "hono";
import { logger } from "hono/logger";
import { bearerAuth } from "hono/bearer-auth";
import { config } from "./config.js";
import { dispatchAlert, dispatchTest } from "./dispatcher.js";
import { logEvent, getRecentEvents } from "./eventlog.js";

const app = new Hono();

app.use("*", logger());

// ── Health check (public) ──────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// ── Status dashboard (public) ──────────────────────────────────────────────
app.get("/", async (c) => {
  const events = getRecentEvents(20);
  const html = await import("./dashboard.js").then((m) => m.renderDashboard(events));
  return c.html(html);
});

// ── Protected routes ───────────────────────────────────────────────────────
app.use("/webhook/*", bearerAuth({ token: config.WEBHOOK_TOKEN }));
app.use("/api/*", bearerAuth({ token: config.WEBHOOK_TOKEN }));

/**
 * LUPUS Webhook endpoint
 * LUPUS sends:  GET/POST /webhook/alarm?device=SD-GSM&event=FIRE&location=Keller
 * All query params are forwarded as alert context.
 */
app.all("/webhook/alarm", async (c) => {
  const params = Object.fromEntries(new URL(c.req.url).searchParams);
  const body = c.req.method === "POST" ? await c.req.json().catch(() => ({})) : {};
  const payload = { ...params, ...body };

  const device   = String(payload.device   ?? payload.deviceid ?? "Unbekannt");
  const event    = String(payload.event     ?? payload.type     ?? "ALARM");
  const location = String(payload.location  ?? payload.zone     ?? "");
  const ts       = new Date().toISOString();

  const alert = { device, event, location, ts, raw: payload };

  logEvent({ type: "alarm", ...alert });
  console.log(`[ALARM] ${ts} | ${device} | ${event} | ${location}`);

  const results = await dispatchAlert(alert);
  return c.json({ received: true, dispatched: results });
});

/** Manual test trigger */
app.post("/api/test", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const channel = String(body.channel ?? "all");
  const results = await dispatchTest(channel);
  logEvent({ type: "test", channel, ts: new Date().toISOString() });
  return c.json({ ok: true, results });
});

/** Recent event log */
app.get("/api/events", (c) => c.json(getRecentEvents(50)));

export default app;
