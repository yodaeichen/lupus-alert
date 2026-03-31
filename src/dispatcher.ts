import { config } from "./config.js";
import { sendTelegram } from "./channels/telegram.js";
import { sendNtfy } from "./channels/ntfy.js";
import { sendEmail } from "./channels/email.js";
import { sendSms } from "./channels/sms.js";

export interface Alert {
  device: string;
  event: string;
  location: string;
  ts: string;
  raw?: Record<string, unknown>;
}

export interface DispatchResult {
  channel: string;
  ok: boolean;
  error?: string;
}

function buildMessage(alert: Alert): string {
  const loc = alert.location ? ` | Ort: ${alert.location}` : "";
  return `🔥 RAUCHMELDER ALARM\nGerät: ${alert.device}${loc}\nEreignis: ${alert.event}\nZeit: ${alert.ts}`;
}

async function safeRun(
  channel: string,
  fn: () => Promise<void>
): Promise<DispatchResult> {
  try {
    await fn();
    console.log(`[OK] ${channel}`);
    return { channel, ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] ${channel}: ${msg}`);
    return { channel, ok: false, error: msg };
  }
}

export async function dispatchAlert(alert: Alert): Promise<DispatchResult[]> {
  const message = buildMessage(alert);
  const title = `🔥 ALARM: ${alert.device}`;

  const tasks: Promise<DispatchResult>[] = [];

  if (config.TELEGRAM_ENABLED) {
    tasks.push(safeRun("telegram", () => sendTelegram(message)));
  }
  if (config.NTFY_ENABLED) {
    tasks.push(safeRun("ntfy", () => sendNtfy(title, message, "max")));
  }
  if (config.EMAIL_ENABLED) {
    tasks.push(safeRun("email", () => sendEmail(title, message)));
  }
  if (config.SMS_ENABLED) {
    tasks.push(safeRun("sms", () => sendSms(message)));
  }

  // Fire all channels in parallel – one failure must not block others
  return Promise.all(tasks);
}

export async function dispatchTest(channel: string): Promise<DispatchResult[]> {
  const ts = new Date().toISOString();
  const testAlert: Alert = {
    device: "TEST-Gerät",
    event:  "TEST",
    location: "Testalarmierung",
    ts,
  };
  const message = `[TEST] ${buildMessage(testAlert)}`;
  const title = "🔔 LUPUS Alert – Testbenachrichtigung";

  const run = (ch: string, fn: () => Promise<void>) => safeRun(ch, fn);
  const all = channel === "all";

  const tasks: Promise<DispatchResult>[] = [];
  if ((all || channel === "telegram") && config.TELEGRAM_ENABLED)
    tasks.push(run("telegram", () => sendTelegram(message)));
  if ((all || channel === "ntfy") && config.NTFY_ENABLED)
    tasks.push(run("ntfy", () => sendNtfy(title, message, "high")));
  if ((all || channel === "email") && config.EMAIL_ENABLED)
    tasks.push(run("email", () => sendEmail(title, message)));
  if ((all || channel === "sms") && config.SMS_ENABLED)
    tasks.push(run("sms", () => sendSms(message)));

  return Promise.all(tasks);
}
