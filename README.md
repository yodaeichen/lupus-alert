# 🔥 LUPUS Alert Server

> Webhook-Empfänger für **LUPUS Mobilfunk-Rauchwarnmelder** – alarmiert parallel per Telegram, ntfy Push, E-Mail und SMS.

![CI](https://github.com/yodaeichen/lupus-alert/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![Platform](https://img.shields.io/badge/Proxmox-LXC-orange?logo=proxmox)
![License](https://img.shields.io/badge/Lizenz-MIT-blue)

---

## ⚡ Installation (One-Liner)

Auf dem **Proxmox-Host als root** ausführen:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/yodaeichen/lupus-alert/main/install.sh)
```

Das Skript fragt interaktiv alle Einstellungen ab und richtet vollautomatisch ein:
- Debian 12 LXC Container
- Node.js 20 + pnpm
- Alle Benachrichtigungskanäle
- systemd Service mit Autostart

---

## Architektur

```
LUPUS SD-GSM (Mobilfunk-Rauchwarnmelder)
        │
        │  HTTP Webhook
        │  GET /webhook/alarm?device=SD-GSM&event=FIRE&location=Keller
        │  Authorization: Bearer <token>
        ▼
┌──────────────────────────────────────────────┐
│         Debian 12 LXC · Node.js 20           │
│              Hono Webhook Server             │
│                                              │
│  ┌──────────────┐    ┌───────────────────┐   │
│  │ /webhook/alarm│───▶│    Dispatcher     │   │
│  └──────────────┘    │  (parallel, alle  │   │
│  ┌──────────────┐    │   Kanäle gleichz.)│   │
│  │  /api/test   │───▶└────────┬──────────┘   │
│  └──────────────┘             │              │
│  ┌──────────────┐             │              │
│  │  / Dashboard │             │              │
│  └──────────────┘             │              │
└──────────────────────────────┼───────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼                     ▼
   📱 Telegram          🔔 ntfy Push          📧 E-Mail            💬 SMS
   Bot API              (self-hosted           SMTP                sipgate /
                        oder ntfy.sh)                              Twilio
```

---

## Voraussetzungen

- Proxmox VE 7 oder 8
- Internetzugang vom Proxmox-Host (für Template-Download und GitHub)
- Accounts für die gewünschten Benachrichtigungskanäle (siehe unten)

---

## Kanäle einrichten

### 📱 Telegram
1. Bot erstellen: Schreib `@BotFather` → `/newbot`
2. Chat-ID herausfinden: Schreib `@userinfobot`
3. Während der Installation eingeben

### 🔔 ntfy Push
- **Öffentlich (kostenlos):** `https://ntfy.sh` – kein Account nötig
- **App:** [iOS](https://apps.apple.com/app/ntfy/id1625396347) / [Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) → Topic abonnieren
- **Self-hosted:** `docker run -p 8080:80 binwiederhier/ntfy serve`

### 📧 E-Mail via Gmail
1. [App-Passwort erstellen](https://myaccount.google.com/apppasswords) (Google-Konto mit 2FA nötig)
2. SMTP-Host: `smtp.gmail.com`, Port: `587`

### 💬 SMS sipgate (empfohlen für Deutschland)
1. [Kostenloses Konto](https://www.sipgate.de/) erstellen
2. Token: Einstellungen → Persönlicher Zugang → Token erstellen
3. SMS-Extension ist standardmäßig `s0`

### 💬 SMS Twilio (international)
1. [Twilio Account](https://www.twilio.com/) erstellen
2. Account SID + Auth Token aus der Console
3. Absendernummer kaufen/verifizieren

---

## LUPUS Gerät konfigurieren

Im LUPUS SD-GSM unter **Einstellungen → Alarmierung → HTTP**:

| Feld | Wert |
|------|------|
| URL | `http://[LXC-IP]:3000/webhook/alarm` |
| Methode | `GET` oder `POST` |
| Header | `Authorization: Bearer [DEIN_TOKEN]` |
| Parameter | `device=SD-GSM&event=FIRE&location=Keller` |

**Optionale URL-Parameter:**

| Parameter | Bedeutung | Beispiel |
|-----------|-----------|---------|
| `device` | Gerätename oder -ID | `SD-GSM-OG` |
| `event` | Ereignistyp | `FIRE`, `ALARM`, `LOW_BATTERY` |
| `location` | Standort / Zone | `Obergeschoss`, `Keller` |

---

## API-Endpunkte

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|-------------|
| `GET` | `/health` | – | Statuscheck (Monitoring) |
| `GET` | `/` | – | Web-Dashboard (Ereignisprotokoll) |
| `GET/POST` | `/webhook/alarm` | Bearer Token | LUPUS Alarm-Eingang |
| `POST` | `/api/test` | Bearer Token | Testbenachrichtigung auslösen |
| `GET` | `/api/events` | Bearer Token | Ereignislog als JSON |

---

## Testen

```bash
# Alle Kanäle gleichzeitig testen
curl -X POST http://[LXC-IP]:3000/api/test \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"channel":"all"}'

# Einzelnen Kanal testen
curl -X POST http://[LXC-IP]:3000/api/test \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"channel":"telegram"}'

# Alarm simulieren
curl "http://[LXC-IP]:3000/webhook/alarm?device=SD-GSM&event=FIRE&location=Keller" \
  -H "Authorization: Bearer [TOKEN]"
```

---

## Verwaltung

```bash
# Logs live verfolgen
pct exec [CT-ID] -- journalctl -u lupus-alert -f

# Service neu starten (nach .env-Änderung)
pct exec [CT-ID] -- systemctl restart lupus-alert

# Konfiguration bearbeiten
pct exec [CT-ID] -- nano /opt/lupus-alert/.env

# Status prüfen
pct exec [CT-ID] -- systemctl status lupus-alert
```

---

## Sicherheit

- Der **Webhook-Token** schützt vor unbefugten Anfragen (Bearer Auth)
- Service läuft unter eigenem `lupus`-Systembenutzer (keine Shell, kein Home)
- systemd-Hardening: `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`
- `.env` hat Dateiberechtigung `600`

### HTTPS mit Caddy (empfohlen bei Internetzugang)

```
# /etc/caddy/Caddyfile (im LXC oder auf dem Host)
alarm.example.com {
    reverse_proxy localhost:3000
}
```

---

## Tech Stack

| Komponente | Version |
|-----------|---------|
| Runtime | Node.js 20 LTS |
| Framework | [Hono](https://hono.dev) v4 |
| Paketmanager | pnpm |
| Sprache | TypeScript 5 |
| E-Mail | nodemailer |
| Betriebssystem | Debian 12 (Bookworm) LXC |

---

## Lizenz

MIT – siehe [LICENSE](LICENSE)
