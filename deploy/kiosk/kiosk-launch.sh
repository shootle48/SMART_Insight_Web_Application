#!/usr/bin/env bash
# เปิด dashboard เต็มจอบน Pi
#
# เรียกจาก ~/.config/autostart/meter-kiosk.desktop ตอนเข้าเดสก์ท็อป
# (labwc บน Raspberry Pi OS เรียก lxsession-xdg-autostart ซึ่งอ่านโฟลเดอร์นั้นให้)
#
# ตั้งใจตรวจสภาพเครื่องเองแทนการ hardcode เพราะทั้งชื่อ binary ของ Chromium
# และชนิดของ session (Wayland/X11) ต่างกันระหว่างรุ่นของ Raspberry Pi OS

set -u

URL="${METER_URL:-http://localhost:3000}"
LOG="${HOME}/meter-kiosk.log"

log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

log "เริ่ม kiosk → $URL  (WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-ว่าง} DISPLAY=${DISPLAY:-ว่าง})"

# autostart อาจถูกเรียกซ้ำ (เคยเจอ 2 รอบห่างกัน 30 วินาที) — กันหน้าต่างซ้อนกัน
if pgrep -af chromium 2>/dev/null | grep -q -- "--app=${URL}"; then
  log "kiosk เปิดอยู่แล้ว ไม่เปิดซ้ำ"
  exit 0
fi

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

# เลือก backend ให้ตรงกับ session
#
# Raspberry Pi OS รุ่นใหม่ใช้ labwc (Wayland) แต่ /usr/bin/chromium ที่เรียกตรง ๆ
# default ไปที่ X11 แล้วตายทันทีด้วย "Missing X server or $DISPLAY"
# ต้องบอกมันตรง ๆ — ตรวจจาก env แทน hardcode เพราะเครื่องอื่นอาจยังเป็น X11 อยู่
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  OZONE="--ozone-platform=wayland"
  log "session เป็น Wayland → $OZONE"
elif [ -n "${DISPLAY:-}" ]; then
  OZONE="--ozone-platform=x11"
  log "session เป็น X11 → $OZONE"
else
  log "ไม่มีทั้ง WAYLAND_DISPLAY และ DISPLAY — ต้องรันจาก session บนจอของ Pi เอง"
  log "รันผ่าน SSH จะไม่มีจอให้วาด ให้ปล่อย autostart เป็นคนเรียกแทน"
  exit 1
fi

BIN="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$BIN" ]; then
  log "ไม่พบ chromium — ลงด้วย: sudo apt install -y chromium"
  exit 1
fi
log "ใช้เบราว์เซอร์: $BIN"

# ลบร่องรอย crash ของรอบก่อน ไม่งั้นเปิดมาจะติดแถบ "Restore pages?" คาจออยู่
PROFILE="${HOME}/.config/chromium"
for f in "${PROFILE}/Default/Preferences" "${PROFILE}/Local State"; do
  [ -f "$f" ] && sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/g; s/"exited_cleanly":false/"exited_cleanly":true/g' "$f" 2>/dev/null
done

exec "$BIN" \
  $OZONE \
  --kiosk \
  --app="$URL" \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  >>"$LOG" 2>&1
