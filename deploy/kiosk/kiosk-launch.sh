#!/usr/bin/env bash
# เปิด dashboard เต็มจอบน Pi
#
# เรียกจาก ~/.config/autostart/meter-kiosk.desktop ตอนเข้าเดสก์ท็อป
#
# ตั้งใจตรวจสภาพเครื่องเองแทนการ hardcode เพราะชื่อ binary ของ Chromium
# ต่างกันระหว่างรุ่นของ Raspberry Pi OS (chromium-browser vs chromium)

set -u

URL="${METER_URL:-http://localhost:3000}"
LOG="${HOME}/meter-kiosk.log"

log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

log "เริ่ม kiosk → $URL"

# รอ server ตอบก่อน ไม่งั้นเบราว์เซอร์จะขึ้นหน้า "connection refused" ค้างไว้
# แล้วไม่มีใครไปกด refresh บนจอที่ติดผนัง
#
# ⚠️ รับทุก HTTP status ไม่ใช่แค่ 2xx โดยตั้งใจ — /api/health ตอบ 503 ตอน DB ยังไม่ขึ้น
# ถ้ารอ 2xx จอจะดำค้างทั้งที่หน้าเว็บแสดงสถานะ degraded ให้ดูได้แล้ว
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' "${URL}/api/health" || echo 000)
  if [ "$code" != "000" ]; then
    log "server ตอบแล้ว (HTTP $code) หลังรอ $((i * 2)) วินาที"
    break
  fi
  sleep 2
done

BIN="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$BIN" ]; then
  log "ไม่พบ chromium — ลงด้วย: sudo apt install -y chromium-browser"
  exit 1
fi
log "ใช้เบราว์เซอร์: $BIN"

# ลบร่องรอย crash ของรอบก่อน ไม่งั้นเปิดมาจะติดแถบ "Restore pages?" คาจออยู่
PROFILE="${HOME}/.config/chromium"
for f in "${PROFILE}/Default/Preferences" "${PROFILE}/Local State"; do
  [ -f "$f" ] && sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/g; s/"exited_cleanly":false/"exited_cleanly":true/g' "$f" 2>/dev/null
done

exec "$BIN" \
  --kiosk \
  --app="$URL" \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --start-maximized \
  >>"$LOG" 2>&1
