import { config } from "../config.js";

async function sendViaSipgate(to: string, message: string): Promise<void> {
  const credentials = Buffer.from(
    `${config.SIPGATE_TOKEN_ID}:${config.SIPGATE_TOKEN}`
  ).toString("base64");

  const res = await fetch("https://api.sipgate.com/v2/sessions/sms", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      smsId:    config.SIPGATE_SMS_ID,
      recipient: to,
      message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`sipgate error (${res.status}): ${err}`);
  }
}

async function sendViaTwilio(to: string, message: string): Promise<void> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = config;
  const credentials = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const body = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error (${res.status}): ${err}`);
  }
}

export async function sendSms(message: string): Promise<void> {
  if (!config.SMS_TO.length) throw new Error("SMS_TO not configured");

  await Promise.all(
    config.SMS_TO.map((to) =>
      config.SMS_PROVIDER === "twilio"
        ? sendViaTwilio(to, message)
        : sendViaSipgate(to, message)
    )
  );
}
