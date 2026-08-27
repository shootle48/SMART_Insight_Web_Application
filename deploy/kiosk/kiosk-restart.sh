#!/usr/bin/env bash
# ปิดแล้วเปิด kiosk ใหม่ — **สั่งจาก SSH ได้**
#
#   ~/Meter/deploy/kiosk/kiosk-restart.sh
#
# ใช้หลัง deploy โค้ดใหม่ (git pull + bun run build + systemctl restart meter)
# เพื่อให้จอโหลดหน้าเว็บเวอร์ชันใหม่ โดยไม่ต้องเดินไปที่เครื่องหรือ reboot
#
# ทำไมต้องมีไฟล์นี้: kiosk-launch.sh รันจาก SSH ตรง ๆ ไม่ได้ เพราะ SSH session
# ไม่มี WAYLAND_DISPLAY/XDG_RUNTIME_DIR ของ session ที่กำลังวาดอยู่บนจอ
# สคริปต์นี้หาค่าพวกนั้นจาก session ที่รันอยู่จริงแล้วส่งต่อให้

set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="${METER_URL:-http://localhost:3000}"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

if [ ! -d "$XDG_RUNTIME_DIR" ]; then
  echo "ไม่พบ $XDG_RUNTIME_DIR — ผู้ใช้นี้ไม่มี session อยู่บนเครื่อง"
  exit 1
fi

# หา socket ของ Wayland ที่ compositor เปิดไว้ (ปกติชื่อ wayland-0)
# ตัดไฟล์ .lock ออก ไม่งั้นจะได้ชื่อผิด
SOCK="$(find "$XDG_RUNTIME_DIR" -maxdepth 1 -name 'wayland-*' ! -name '*.lock' -printf '%f\n' 2>/dev/null | head -1)"

if [ -n "$SOCK" ]; then
  export WAYLAND_DISPLAY="$SOCK"
  echo "เจอ Wayland session: $WAYLAND_DISPLAY"
elif [ -n "${DISPLAY:-}" ]; then
  echo "ใช้ X11 session: $DISPLAY"
else
  echo "ไม่พบ session บนจอเลย — เดสก์ท็อปยังไม่ขึ้นหรือ auto-login ปิดอยู่"
  echo "เช็คด้วย: loginctl list-sessions"
  exit 1
fi

echo "ปิด kiosk เดิม (ถ้ามี)..."
pkill -f "chromium.*${URL}" 2>/dev/null && sleep 2

echo "เปิดใหม่..."
# ต้อง detach ให้หลุดจาก SSH ไม่งั้นพอ ssh หลุด chromium ตายตาม
setsid nohup "$DIR/kiosk-launch.sh" >/dev/null 2>&1 &

sleep 6
if pgrep -f "chromium.*${URL}" >/dev/null; then
  echo "✅ kiosk เปิดแล้ว"
else
  echo "❌ ยังไม่ขึ้น — ดูสาเหตุที่ ~/meter-kiosk.log"
  tail -5 ~/meter-kiosk.log
  exit 1
fi
