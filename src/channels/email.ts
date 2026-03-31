import nodemailer from "nodemailer";
import { config } from "../config.js";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });
  return _transporter;
}

export async function sendEmail(subject: string, body: string): Promise<void> {
  if (!config.SMTP_HOST) throw new Error("SMTP_HOST not configured");
  if (!config.EMAIL_TO.length) throw new Error("EMAIL_TO not configured");

  const transporter = getTransporter();

  await transporter.sendMail({
    from:    config.SMTP_FROM || config.SMTP_USER,
    to:      config.EMAIL_TO.join(", "),
    subject,
    text:    body,
    html:    `<pre style="font-family:monospace;font-size:14px">${body.replace(/</g, "&lt;")}</pre>`,
  });
}
