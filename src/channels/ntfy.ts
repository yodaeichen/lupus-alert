import { config } from "../config.js";

type Priority = "max" | "high" | "default" | "low" | "min";

export async function sendNtfy(
  title: string,
  message: string,
  priority: Priority = "high"
): Promise<void> {
  const url = `${config.NTFY_URL.replace(/\/$/, "")}/${config.NTFY_TOPIC}`;

  const headers: Record<string, string> = {
    "Title":    title,
    "Priority": priority,
    "Tags":     "fire,rotating_light",
    "Content-Type": "text/plain",
  };

  // Optional auth for self-hosted ntfy with auth enabled
  if (config.NTFY_TOKEN) {
    headers["Authorization"] = `Bearer ${config.NTFY_TOKEN}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: message,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ntfy error (${res.status}): ${err}`);
  }
}
