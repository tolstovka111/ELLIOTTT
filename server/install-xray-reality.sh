#!/usr/bin/env bash
#
# Dельта VPN — VPS node installer (VLESS + XTLS-Reality).
#
# Reality makes the node look like a TLS connection to a real, popular site: there
# is no certificate of your own to fingerprint and no TLS handshake that stands out,
# which is what survives DPI-based filtering.
#
# Usage (as root):
#   ./install-xray-reality.sh [--sni www.microsoft.com] [--port 443] [--name "Dельта · DE"]
#
set -euo pipefail

SNI="www.microsoft.com"
PORT="443"
NODE_NAME="Dельта"
CONFIG_DIR="/usr/local/etc/xray"
OUTPUT="/root/delta-node.txt"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sni) SNI="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --name) NODE_NAME="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Неизвестный аргумент: $1" >&2; exit 1 ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запустите скрипт от root (sudo -i)." >&2
  exit 1
fi

echo "==> Устанавливаем зависимости"
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq curl unzip ca-certificates jq >/dev/null
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y -q curl unzip ca-certificates jq >/dev/null
else
  echo "Поддерживаются только apt- и dnf-системы." >&2
  exit 1
fi

echo "==> Устанавливаем Xray-core"
bash -c "$(curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

echo "==> Генерируем ключи"
UUID="$(xray uuid)"
KEYS="$(xray x25519)"
PRIVATE_KEY="$(echo "${KEYS}" | awk '/[Pp]rivate/ {print $NF}')"
PUBLIC_KEY="$(echo "${KEYS}" | awk '/[Pp]ublic/ {print $NF}')"
SHORT_ID="$(openssl rand -hex 8)"
SERVER_IP="$(curl -fsSL --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"

echo "==> Пишем конфигурацию"
mkdir -p "${CONFIG_DIR}"
cat >"${CONFIG_DIR}/config.json" <<JSON
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    {
      "tag": "reality-in",
      "listen": "0.0.0.0",
      "port": ${PORT},
      "protocol": "vless",
      "settings": {
        "clients": [
          { "id": "${UUID}", "flow": "xtls-rprx-vision" }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "${SNI}:443",
          "xver": 0,
          "serverNames": ["${SNI}"],
          "privateKey": "${PRIVATE_KEY}",
          "shortIds": ["${SHORT_ID}"]
        }
      },
      "sniffing": {
        "enabled": true,
        "destOverride": ["http", "tls", "quic"]
      }
    }
  ],
  "outbounds": [
    { "tag": "direct", "protocol": "freedom", "settings": { "domainStrategy": "UseIPv4" } },
    { "tag": "block", "protocol": "blackhole" }
  ],
  "routing": {
    "domainStrategy": "AsIs",
    "rules": [
      { "type": "field", "ip": ["geoip:private"], "outboundTag": "block" },
      { "type": "field", "protocol": ["bittorrent"], "outboundTag": "block" }
    ]
  }
}
JSON

echo "==> Открываем порт ${PORT}"
if command -v ufw >/dev/null 2>&1; then
  ufw allow "${PORT}"/tcp >/dev/null || true
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${PORT}"/tcp >/dev/null || true
  firewall-cmd --reload >/dev/null || true
fi

echo "==> Включаем BBR (ускоряет TCP на дальних маршрутах)"
if ! grep -q "^net.core.default_qdisc" /etc/sysctl.conf; then
  {
    echo "net.core.default_qdisc=fq"
    echo "net.ipv4.tcp_congestion_control=bbr"
  } >>/etc/sysctl.conf
  sysctl -p >/dev/null 2>&1 || true
fi

systemctl enable xray >/dev/null 2>&1 || true
systemctl restart xray
sleep 2
systemctl --no-pager --lines=0 status xray || true

LINK="vless://${UUID}@${SERVER_IP}:${PORT}?type=tcp&security=reality&encryption=none&pbk=${PUBLIC_KEY}&sid=${SHORT_ID}&sni=${SNI}&fp=chrome&flow=xtls-rprx-vision#$(printf '%s' "${NODE_NAME}" | jq -sRr @uri)"

{
  echo "UUID:        ${UUID}"
  echo "Public key:  ${PUBLIC_KEY}"
  echo "Short id:    ${SHORT_ID}"
  echo "SNI:         ${SNI}"
  echo "Порт:        ${PORT}"
  echo "IP:          ${SERVER_IP}"
  echo
  echo "${LINK}"
} | tee "${OUTPUT}"

echo
echo "Ссылка сохранена в ${OUTPUT}"
echo "Добавьте её в приложение (Настройки → Добавить сервер) или в EXTRA_NODES воркера."
