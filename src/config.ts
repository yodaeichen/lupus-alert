import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env file manually (no dotenv dependency needed in Node 20+)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function envBool(key: string, fallback = "false"): boolean {
  return env(key, fallback).toLowerCase() === "true";
}

export const config = {
  PORT:          parseInt(env("PORT", "3000"), 10),
  WEBHOOK_TOKEN: env("WEBHOOK_TOKEN"),

  // ── Telegram ──────────────────────────────────────────────────────────────
  TELEGRAM_ENABLED:  envBool("TELEGRAM_ENABLED"),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_CHAT_IDS:  (process.env.TELEGRAM_CHAT_IDS ?? "").split(",").filter(Boolean),

  // ── ntfy ──────────────────────────────────────────────────────────────────
  NTFY_ENABLED:  envBool("NTFY_ENABLED"),
  NTFY_URL:      process.env.NTFY_URL ?? "https://ntfy.sh",
  NTFY_TOPIC:    process.env.NTFY_TOPIC ?? "lupus-alarm",
  NTFY_TOKEN:    process.env.NTFY_TOKEN ?? "",          // optional for self-hosted

  // ── E-Mail (SMTP) ─────────────────────────────────────────────────────────
  EMAIL_ENABLED:  envBool("EMAIL_ENABLED"),
  SMTP_HOST:      process.env.SMTP_HOST ?? "",
  SMTP_PORT:      parseInt(process.env.SMTP_PORT ?? "587", 10),
  SMTP_USER:      process.env.SMTP_USER ?? "",
  SMTP_PASS:      process.env.SMTP_PASS ?? "",
  SMTP_FROM:      process.env.SMTP_FROM ?? "",
  EMAIL_TO:       (process.env.EMAIL_TO ?? "").split(",").filter(Boolean),

  // ── SMS via sipgate / Twilio ───────────────────────────────────────────────
  SMS_ENABLED:    envBool("SMS_ENABLED"),
  SMS_PROVIDER:   (process.env.SMS_PROVIDER ?? "sipgate") as "sipgate" | "twilio",
  SMS_TO:         (process.env.SMS_TO ?? "").split(",").filter(Boolean),

  // sipgate
  SIPGATE_TOKEN_ID: process.env.SIPGATE_TOKEN_ID ?? "",
  SIPGATE_TOKEN:    process.env.SIPGATE_TOKEN ?? "",
  SIPGATE_SMS_ID:   process.env.SIPGATE_SMS_ID ?? "s0",

  // twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN:  process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_FROM:        process.env.TWILIO_FROM ?? "",
};
