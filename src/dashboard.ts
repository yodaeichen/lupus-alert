import type { LogEntry } from "./eventlog.js";
import { config } from "./config.js";

function badge(enabled: boolean, label: string): string {
  const cls = enabled ? "badge-on" : "badge-off";
  const icon = enabled ? "✓" : "✗";
  return `<span class="badge ${cls}">${icon} ${label}</span>`;
}

function eventRow(e: LogEntry): string {
  const icon = e.type === "alarm" ? "🔥" : e.type === "test" ? "🔔" : "⚠️";
  const loc  = e.location ? `<span class="loc">${e.location}</span>` : "";
  return `
  <tr class="${e.type === "alarm" ? "row-alarm" : ""}">
    <td>${icon}</td>
    <td>${e.ts?.replace("T", " ").slice(0, 19) ?? "—"}</td>
    <td>${e.device ?? e.channel ?? "—"}</td>
    <td>${e.event ?? e.type}${loc}</td>
  </tr>`;
}

export function renderDashboard(events: LogEntry[]): string {
  const channels = [
    badge(config.TELEGRAM_ENABLED, "Telegram"),
    badge(config.NTFY_ENABLED,     "ntfy"),
    badge(config.EMAIL_ENABLED,    "E-Mail"),
    badge(config.SMS_ENABLED,      `SMS (${config.SMS_PROVIDER})`),
  ].join(" ");

  const rows = events.length
    ? events.map(eventRow).join("\n")
    : `<tr><td colspan="4" class="empty">Noch keine Ereignisse</td></tr>`;

  return /* html */ `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LUPUS Alert Server</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Sora:wght@300;600;800&display=swap');
    :root {
      --bg:     #0d0f14;
      --panel:  #13161e;
      --border: #1f2433;
      --accent: #ff3b3b;
      --amber:  #ffaa00;
      --green:  #00e676;
      --muted:  #4a5068;
      --text:   #d6daf0;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Sora', sans-serif;
      font-weight: 300;
      min-height: 100vh;
      padding: 2rem 1.5rem;
    }
    header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
    }
    .logo {
      width: 3rem; height: 3rem;
      background: var(--accent);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem;
    }
    h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; }
    h1 span { color: var(--accent); }
    .subtitle { font-size: .8rem; color: var(--muted); margin-top: .2rem; font-family: 'JetBrains Mono', monospace; }

    .pulse {
      display: inline-block;
      width: .6rem; height: .6rem;
      background: var(--green);
      border-radius: 50%;
      margin-right: .5rem;
      box-shadow: 0 0 8px var(--green);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100% { opacity: 1; }
      50%      { opacity: .3; }
    }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }

    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
    }
    .card-title { font-size: .7rem; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); margin-bottom: .75rem; font-family: 'JetBrains Mono', monospace; }

    .badge { display: inline-block; padding: .25rem .65rem; border-radius: 999px; font-size: .75rem; font-family: 'JetBrains Mono', monospace; margin: .2rem .15rem; }
    .badge-on  { background: rgba(0,230,118,.12); color: var(--green); border: 1px solid rgba(0,230,118,.25); }
    .badge-off { background: rgba(74,80,104,.15); color: var(--muted); border: 1px solid var(--border); }

    .status-live { display: flex; align-items: center; font-size: .9rem; }

    table { width: 100%; border-collapse: collapse; font-size: .82rem; }
    th { text-align: left; color: var(--muted); font-family: 'JetBrains Mono', monospace; font-size: .65rem; letter-spacing: .1em; text-transform: uppercase; padding: .5rem .75rem; border-bottom: 1px solid var(--border); }
    td { padding: .55rem .75rem; border-bottom: 1px solid rgba(31,36,51,.6); font-family: 'JetBrains Mono', monospace; }
    .row-alarm td { color: var(--accent); }
    .loc { margin-left: .5rem; color: var(--muted); font-size: .75rem; }
    .empty { text-align: center; color: var(--muted); padding: 2rem !important; }

    footer { margin-top: 3rem; text-align: center; font-size: .72rem; color: var(--muted); font-family: 'JetBrains Mono', monospace; }

    .section-title { font-size: .95rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: .5rem; }
    .event-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .event-header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  </style>
  <meta http-equiv="refresh" content="30">
</head>
<body>
  <header>
    <div class="logo">🔥</div>
    <div>
      <h1>LUPUS <span>Alert</span> Server</h1>
      <div class="subtitle">Webhook → Multi-Channel Alarmierung</div>
    </div>
  </header>

  <div class="grid">
    <div class="card">
      <div class="card-title">System Status</div>
      <div class="status-live"><span class="pulse"></span> Aktiv &amp; empfangsbereit</div>
    </div>
    <div class="card">
      <div class="card-title">Aktive Kanäle</div>
      ${channels}
    </div>
    <div class="card">
      <div class="card-title">Webhook Endpunkt</div>
      <code style="font-family:'JetBrains Mono',monospace;font-size:.8rem;color:#7c8fbd">
        GET/POST /webhook/alarm
      </code>
    </div>
    <div class="card">
      <div class="card-title">Ereignisse gesamt</div>
      <span style="font-size:1.8rem;font-weight:800;color:var(--amber)">${events.length}</span>
      <span style="color:var(--muted);font-size:.8rem;margin-left:.4rem">(letzte 200)</span>
    </div>
  </div>

  <div class="event-card">
    <div class="event-header">
      <span class="section-title">📋 Ereignisprotokoll</span>
      <span style="font-size:.7rem;font-family:'JetBrains Mono',monospace;color:var(--muted)">Auto-Refresh 30s</span>
    </div>
    <table>
      <thead>
        <tr><th></th><th>Zeitstempel</th><th>Gerät</th><th>Ereignis</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <footer>LUPUS Alert Server · Node.js · Hono · ${new Date().toLocaleString("de-DE")}</footer>
</body>
</html>`;
}
