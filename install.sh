#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  LUPUS Alert Server – One-Line Installer
#  Aufruf (auf dem Proxmox-Host als root):
#
#  bash <(curl -fsSL https://raw.githubusercontent.com/DEIN_USER/lupus-alert/main/install.sh)
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Repo-Konfiguration ────────────────────────────────────────────────────────
GITHUB_USER="${GITHUB_USER:-DEIN_GITHUB_USER}"
GITHUB_REPO="${GITHUB_REPO:-lupus-alert}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
RAW_BASE="https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}"
REPO_URL="https://github.com/${GITHUB_USER}/${GITHUB_REPO}"

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; ORANGE='\033[0;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

msg()  { echo -e "${CYAN}${BOLD}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}${BOLD}[ OK ]${NC} $*"; }
warn() { echo -e "${ORANGE}${BOLD}[WARN]${NC} $*"; }
err()  { echo -e "${RED}${BOLD}[ERR ]${NC} $*"; exit 1; }
ask()  { echo -en "${ORANGE}${BOLD} ❯  ${NC}$* "; }
step() { echo -e "\n${BOLD}━━━ $* $(printf '━%.0s' {1..40})${NC}\n"; }

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${RED}${BOLD}"
cat <<'BANNER'
  ██╗     ██╗   ██╗██████╗ ██╗   ██╗███████╗
  ██║     ██║   ██║██╔══██╗██║   ██║██╔════╝
  ██║     ██║   ██║██████╔╝██║   ██║███████╗
  ██║     ██║   ██║██╔═══╝ ██║   ██║╚════██║
  ███████╗╚██████╔╝██║     ╚██████╔╝███████║
  ╚══════╝ ╚═════╝ ╚═╝      ╚═════╝ ╚══════╝
BANNER
echo -e "${NC}"
echo -e "  ${BOLD}LUPUS Alert Server${NC} – Proxmox LXC Installer"
echo -e "  Webhook → Telegram · ntfy · E-Mail · SMS"
echo -e "  ${CYAN}${REPO_URL}${NC}"
echo ""

# ── Voraussetzungen ───────────────────────────────────────────────────────────
step "Voraussetzungen prüfen"
[[ "$(id -u)" -eq 0 ]]          || err "Bitte als root ausführen!"
command -v pct    &>/dev/null    || err "pct nicht gefunden – bitte auf Proxmox-Host ausführen!"
command -v pvesh  &>/dev/null    || err "pvesh nicht gefunden!"
command -v curl   &>/dev/null    || err "curl nicht gefunden!"
command -v openssl &>/dev/null   || warn "openssl nicht gefunden – Token-Generierung manuell nötig"
ok "Proxmox-Host erkannt ($(pveversion | head -1))"

# ── LXC Konfiguration ─────────────────────────────────────────────────────────
step "Container Konfiguration"

NEXT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "200")
ask "Container-ID [$NEXT_ID]:"; read -r v; CT_ID="${v:-$NEXT_ID}"

ask "Hostname [lupus-alert]:"; read -r v; CT_HOSTNAME="${v:-lupus-alert}"

ask "RAM in MB [512]:"; read -r v; CT_RAM="${v:-512}"

ask "Disk in GB [4]:"; read -r v; CT_DISK="${v:-4}"

ask "CPU-Kerne [1]:"; read -r v; CT_CORES="${v:-1}"

# Storage
STORAGES=$(pvesh get /nodes/"$(hostname)"/storage --output-format json 2>/dev/null \
  | python3 -c "import sys,json; [print(s['storage']) for s in json.load(sys.stdin)]" 2>/dev/null \
  || echo "local-lvm local")
ask "Storage (verfügbar: $STORAGES) [local-lvm]:"; read -r v; CT_STORAGE="${v:-local-lvm}"

ask "Netzwerk-Bridge [vmbr0]:"; read -r v; CT_BRIDGE="${v:-vmbr0}"

ask "IP/CIDR oder 'dhcp' [dhcp]:"; read -r v; CT_IP="${v:-dhcp}"
CT_GW=""
if [[ "$CT_IP" != "dhcp" ]]; then
  ask "Gateway:"; read -r CT_GW
fi

ask "Root-Passwort für den Container:"; read -rs CT_PASS; echo ""
[[ -n "$CT_PASS" ]] || err "Passwort darf nicht leer sein!"

# ── Alert-Konfiguration ───────────────────────────────────────────────────────
step "Alert-Kanäle konfigurieren"

# Webhook Token
ask "Webhook-Token (leer = auto-generieren):"; read -r v
if [[ -z "$v" ]]; then
  WEBHOOK_TOKEN=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-')
  echo -e "  ${GREEN}Generiert:${NC} $WEBHOOK_TOKEN"
else
  WEBHOOK_TOKEN="$v"
fi

# Telegram
echo ""
ask "Telegram aktivieren? [J/n]:"; read -r v
if [[ "${v,,}" != "n" ]]; then
  TELEGRAM_ENABLED=true
  ask "Bot-Token (von @BotFather):"; read -r TELEGRAM_BOT_TOKEN
  ask "Chat-ID(s) kommagetrennt:";   read -r TELEGRAM_CHAT_IDS
else
  TELEGRAM_ENABLED=false; TELEGRAM_BOT_TOKEN=""; TELEGRAM_CHAT_IDS=""
fi

# ntfy
echo ""
ask "ntfy Push aktivieren? [J/n]:"; read -r v
if [[ "${v,,}" != "n" ]]; then
  NTFY_ENABLED=true
  ask "ntfy URL [https://ntfy.sh]:"; read -r v; NTFY_URL="${v:-https://ntfy.sh}"
  ask "Topic [lupus-alarm]:";        read -r v; NTFY_TOPIC="${v:-lupus-alarm}"
  ask "ntfy Token (leer = kein Auth):"; read -r NTFY_TOKEN
else
  NTFY_ENABLED=false; NTFY_URL="https://ntfy.sh"; NTFY_TOPIC="lupus-alarm"; NTFY_TOKEN=""
fi

# E-Mail
echo ""
ask "E-Mail aktivieren? [J/n]:"; read -r v
if [[ "${v,,}" != "n" ]]; then
  EMAIL_ENABLED=true
  ask "SMTP-Host [smtp.gmail.com]:"; read -r v; SMTP_HOST="${v:-smtp.gmail.com}"
  ask "SMTP-Port [587]:";            read -r v; SMTP_PORT="${v:-587}"
  ask "SMTP-User:";                  read -r SMTP_USER
  ask "SMTP-Passwort:";              read -rs SMTP_PASS; echo ""
  ask "Absender [$SMTP_USER]:";      read -r v; SMTP_FROM="${v:-$SMTP_USER}"
  ask "Empfänger kommagetrennt:";    read -r EMAIL_TO
else
  EMAIL_ENABLED=false; SMTP_HOST=""; SMTP_PORT=587
  SMTP_USER=""; SMTP_PASS=""; SMTP_FROM=""; EMAIL_TO=""
fi

# SMS
echo ""
ask "SMS aktivieren? [J/n]:"; read -r v
if [[ "${v,,}" != "n" ]]; then
  SMS_ENABLED=true
  ask "Anbieter – sipgate oder twilio [sipgate]:"; read -r v; SMS_PROVIDER="${v:-sipgate}"
  ask "Empfänger (+49...) kommagetrennt:";         read -r SMS_TO
  if [[ "$SMS_PROVIDER" == "twilio" ]]; then
    ask "Twilio Account SID:";  read -r TWILIO_ACCOUNT_SID
    ask "Twilio Auth Token:";   read -rs TWILIO_AUTH_TOKEN; echo ""
    ask "Twilio Absender-Nr.:"; read -r TWILIO_FROM
    SIPGATE_TOKEN_ID=""; SIPGATE_TOKEN=""; SIPGATE_SMS_ID="s0"
  else
    ask "sipgate Token-ID:";    read -r SIPGATE_TOKEN_ID
    ask "sipgate Token:";       read -rs SIPGATE_TOKEN; echo ""
    ask "sipgate SMS-ID [s0]:"; read -r v; SIPGATE_SMS_ID="${v:-s0}"
    TWILIO_ACCOUNT_SID=""; TWILIO_AUTH_TOKEN=""; TWILIO_FROM=""
  fi
else
  SMS_ENABLED=false; SMS_PROVIDER="sipgate"; SMS_TO=""
  SIPGATE_TOKEN_ID=""; SIPGATE_TOKEN=""; SIPGATE_SMS_ID="s0"
  TWILIO_ACCOUNT_SID=""; TWILIO_AUTH_TOKEN=""; TWILIO_FROM=""
fi

# ── Zusammenfassung & Bestätigung ─────────────────────────────────────────────
step "Zusammenfassung"
echo -e "  CT-ID / Hostname : ${BOLD}${CT_ID} / ${CT_HOSTNAME}${NC}"
echo -e "  IP               : ${BOLD}${CT_IP}${NC}"
echo -e "  Storage / RAM    : ${BOLD}${CT_STORAGE} / ${CT_RAM} MB${NC}"
echo -e "  Telegram         : ${BOLD}${TELEGRAM_ENABLED}${NC}"
echo -e "  ntfy             : ${BOLD}${NTFY_ENABLED}${BOLD} (${NTFY_URL}/${NTFY_TOPIC})${NC}"
echo -e "  E-Mail           : ${BOLD}${EMAIL_ENABLED}${NC}"
echo -e "  SMS              : ${BOLD}${SMS_ENABLED} (${SMS_PROVIDER})${NC}"
echo ""
ask "Jetzt installieren? [J/n]:"; read -r v
[[ "${v,,}" == "n" ]] && { echo "Abgebrochen."; exit 0; }

# ── Debian 12 Template ────────────────────────────────────────────────────────
step "Debian 12 LXC-Template"
TEMPLATE_STORE="local"
TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
if [[ ! -f "/var/lib/vz/template/cache/${TEMPLATE}" ]]; then
  msg "Lade Template herunter..."
  pveam update &>/dev/null
  pveam download "$TEMPLATE_STORE" "$TEMPLATE"
fi
ok "Template: $TEMPLATE"

# ── Container erstellen & starten ─────────────────────────────────────────────
step "Erstelle LXC CT${CT_ID}"
NET="name=eth0,bridge=${CT_BRIDGE}"
if [[ "$CT_IP" == "dhcp" ]]; then NET+=",ip=dhcp"
else NET+=",ip=${CT_IP}"; [[ -n "$CT_GW" ]] && NET+=",gw=${CT_GW}"; fi

pct create "$CT_ID" "${TEMPLATE_STORE}:vztmpl/${TEMPLATE}" \
  --hostname  "$CT_HOSTNAME" \
  --password  "$CT_PASS" \
  --storage   "$CT_STORAGE" \
  --rootfs    "${CT_STORAGE}:${CT_DISK}" \
  --memory    "$CT_RAM" \
  --cores     "$CT_CORES" \
  --net0      "$NET" \
  --unprivileged 1 \
  --features  nesting=1 \
  --onboot    1 \
  --start     1

ok "Container CT${CT_ID} gestartet"
sleep 4

# ── .env schreiben ────────────────────────────────────────────────────────────
ENVTMP=$(mktemp)
cat > "$ENVTMP" <<ENVEOF
PORT=3000
WEBHOOK_TOKEN=${WEBHOOK_TOKEN}

TELEGRAM_ENABLED=${TELEGRAM_ENABLED}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_CHAT_IDS=${TELEGRAM_CHAT_IDS}

NTFY_ENABLED=${NTFY_ENABLED}
NTFY_URL=${NTFY_URL}
NTFY_TOPIC=${NTFY_TOPIC}
NTFY_TOKEN=${NTFY_TOKEN}

EMAIL_ENABLED=${EMAIL_ENABLED}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}
EMAIL_TO=${EMAIL_TO}

SMS_ENABLED=${SMS_ENABLED}
SMS_PROVIDER=${SMS_PROVIDER}
SMS_TO=${SMS_TO}
SIPGATE_TOKEN_ID=${SIPGATE_TOKEN_ID}
SIPGATE_TOKEN=${SIPGATE_TOKEN}
SIPGATE_SMS_ID=${SIPGATE_SMS_ID}
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
TWILIO_FROM=${TWILIO_FROM}
ENVEOF

pct push "$CT_ID" "$ENVTMP" /root/.lupus-env
rm -f "$ENVTMP"

# ── App im Container installieren ─────────────────────────────────────────────
step "Installiere LUPUS Alert Server im Container"

pct exec "$CT_ID" -- bash -euo pipefail <<INNERSCRIPT
export DEBIAN_FRONTEND=noninteractive
echo "--- Pakete ---"
apt-get update -q
apt-get install -y -q curl ca-certificates git

echo "--- Node.js 20 ---"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &>/dev/null
apt-get install -y -q nodejs

echo "--- pnpm ---"
npm install -g pnpm@latest --silent

echo "--- Repo clonen ---"
git clone --depth 1 https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git /opt/lupus-alert

echo "--- .env einrichten ---"
cp /root/.lupus-env /opt/lupus-alert/.env
chmod 600 /opt/lupus-alert/.env
rm /root/.lupus-env

echo "--- Dependencies & Build ---"
cd /opt/lupus-alert
pnpm install --frozen-lockfile
pnpm build

echo "--- Benutzer anlegen ---"
useradd -r -s /bin/false -d /opt/lupus-alert lupus 2>/dev/null || true
chown -R lupus:lupus /opt/lupus-alert
chmod 600 /opt/lupus-alert/.env

echo "--- systemd Service ---"
cp /opt/lupus-alert/lupus-alert.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable lupus-alert
systemctl start lupus-alert
sleep 2
systemctl is-active lupus-alert && echo "Service läuft!" || echo "FEHLER: Service nicht aktiv"
INNERSCRIPT

# ── Abschluss ─────────────────────────────────────────────────────────────────
step "Installation abgeschlossen"

CT_FINAL_IP=$(pct exec "$CT_ID" -- bash -c "hostname -I 2>/dev/null | awk '{print \$1}'" 2>/dev/null || echo "?")

echo ""
echo -e "  ${GREEN}${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "  ${GREEN}${BOLD}║   ✅  LUPUS Alert Server ist bereit!          ║${NC}"
echo -e "  ${GREEN}${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Container:${NC}     CT${CT_ID} · ${CT_HOSTNAME}"
echo -e "  ${BOLD}IP-Adresse:${NC}    ${CT_FINAL_IP}"
echo -e "  ${BOLD}Dashboard:${NC}     ${CYAN}http://${CT_FINAL_IP}:3000/${NC}"
echo ""
echo -e "  ${BOLD}━━━ LUPUS Gerät konfigurieren ━━━━━━━━━━━━━━━━━${NC}"
echo -e "  URL:    http://${CT_FINAL_IP}:3000/webhook/alarm"
echo -e "  Param:  ?device=SD-GSM&event=FIRE&location=Keller"
echo -e "  Header: Authorization: Bearer ${WEBHOOK_TOKEN}"
echo ""
echo -e "  ${BOLD}━━━ Soforttest ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}curl -X POST http://${CT_FINAL_IP}:3000/api/test \\${NC}"
echo -e "  ${CYAN}  -H 'Authorization: Bearer ${WEBHOOK_TOKEN}' \\${NC}"
echo -e "  ${CYAN}  -H 'Content-Type: application/json' \\${NC}"
echo -e "  ${CYAN}  -d '{\"channel\":\"all\"}'${NC}"
echo ""
echo -e "  ${BOLD}━━━ Logs & Verwaltung ━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Logs:      pct exec ${CT_ID} -- journalctl -u lupus-alert -f"
echo -e "  Neustart:  pct exec ${CT_ID} -- systemctl restart lupus-alert"
echo -e "  Config:    pct exec ${CT_ID} -- nano /opt/lupus-alert/.env"
echo ""
