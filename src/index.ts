import { serve } from "@hono/node-server";
import app from "./server.js";
import { config } from "./config.js";

console.log(`
╔══════════════════════════════════════════╗
║   LUPUS Alert Server  🔥                 ║
║   Webhook → Telegram, ntfy, E-Mail, SMS  ║
╚══════════════════════════════════════════╝
`);

console.log(`[config] Port:        ${config.PORT}`);
console.log(`[config] Telegram:    ${config.TELEGRAM_ENABLED}`);
console.log(`[config] ntfy:        ${config.NTFY_ENABLED}  → ${config.NTFY_URL}/${config.NTFY_TOPIC}`);
console.log(`[config] E-Mail:      ${config.EMAIL_ENABLED}`);
console.log(`[config] SMS:         ${config.SMS_ENABLED}   (${config.SMS_PROVIDER})`);

serve({
  fetch: app.fetch,
  port:  config.PORT,
}, (info) => {
  console.log(`\n✅ Server läuft auf http://0.0.0.0:${info.port}`);
  console.log(`   Dashboard:  http://0.0.0.0:${info.port}/`);
  console.log(`   Webhook:    http://0.0.0.0:${info.port}/webhook/alarm`);
  console.log(`   Health:     http://0.0.0.0:${info.port}/health\n`);
});
