#!/usr/bin/env bash
# สำรอง Postgres ออกเป็นไฟล์ แล้ว (ถ้าตั้งค่าไว้) ส่งออกนอกเครื่อง
#
#   ~/Meter/deploy/backup.sh
#
# เรียกโดย meter-backup.timer วันละครั้ง — ดู docs/DEPLOYMENT.md
#
# ⚠️ เหตุผลที่ต้องส่งออกนอกเครื่อง: D-006 ยอมให้ Postgres อยู่บน SD card
# โดยแลกกับต้องมี backup ที่อื่น โหมดพังที่กลัวคือ SD เสีย/ไฟดับกลางคัน
# ซึ่งกวาดทั้ง DB และไฟล์ dump ที่อยู่บน SD ใบเดียวกันไปพร้อมกัน
# backup ที่อยู่บนเครื่องเดียวกันจึงกันได้แค่ "ลบผิด" ไม่ได้กัน "การ์ดพัง"

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

CONTAINER="${BACKUP_CONTAINER:-meter-postgres}"
DB_USER="${BACKUP_DB_USER:-meter}"
DB_NAME="${BACKUP_DB_NAME:-meter}"
OUT_DIR="${BACKUP_DIR:-$HOME/meter-backups}"
KEEP="${BACKUP_KEEP:-7}"
# ปลายทางนอกเครื่อง เช่น "user@nas:/backup/meter/" — ว่าง = ไม่ส่งออก (จะเตือน)
REMOTE="${BACKUP_REMOTE:-}"

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/meter-$STAMP.dump"

echo "[backup] เริ่ม $STAMP → $FILE"

# -Fc = custom format: บีบอัดในตัว และ restore เลือกเฉพาะบางตารางได้
# เขียนผ่าน stdout ของ docker exec จึงไม่ต้อง mount volume เพิ่ม
if ! docker exec "$CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$FILE.part"; then
  echo "[backup] ❌ pg_dump ล้มเหลว"
  rm -f "$FILE.part"
  exit 1
fi

# เปลี่ยนชื่อหลังเขียนเสร็จเท่านั้น — ไฟล์ .part ที่ค้างอยู่คือ dump ที่ไม่สมบูรณ์
# ถ้าตั้งชื่อจริงตั้งแต่แรก แล้วไฟดับกลางคัน จะได้ไฟล์ที่ดูเหมือน backup แต่ restore ไม่ได้
mv "$FILE.part" "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "[backup] ✅ ได้ไฟล์ $SIZE"

# ---- ส่งออกนอกเครื่อง ----
if [ -n "$REMOTE" ]; then
  echo "[backup] ส่งไป $REMOTE"
  if rsync -az --timeout=120 "$FILE" "$REMOTE"; then
    echo "[backup] ✅ ส่งออกนอกเครื่องแล้ว"
  else
    # ไม่ exit 1 เพราะไฟล์ local ยังใช้ได้ — แต่ต้องดังพอให้เห็นใน journal
    echo "[backup] ❌ ส่งออกไม่สำเร็จ — backup ยังอยู่แค่บน SD ใบเดียวกับ DB"
  fi
else
  echo "[backup] ⚠️ ยังไม่ได้ตั้ง BACKUP_REMOTE — backup อยู่บน SD ใบเดียวกับ DB"
  echo "[backup]    กันได้แค่ 'ลบผิด' ไม่ได้กัน 'การ์ดพัง' ซึ่งเป็นความเสี่ยงหลักของเครื่องนี้ (D-006)"
fi

# ---- ลบของเก่า ----
# ลบเฉพาะไฟล์ที่ตั้งชื่อครบแล้ว ไม่แตะ .part ที่อาจกำลังเขียนอยู่
COUNT="$(find "$OUT_DIR" -maxdepth 1 -name 'meter-*.dump' | wc -l)"
if [ "$COUNT" -gt "$KEEP" ]; then
  find "$OUT_DIR" -maxdepth 1 -name 'meter-*.dump' -printf '%T@ %p\n' \
    | sort -n | head -n "$((COUNT - KEEP))" | cut -d' ' -f2- \
    | while read -r old; do
        echo "[backup] ลบของเก่า $(basename "$old")"
        rm -f "$old"
      done
fi

echo "[backup] เก็บไว้ $(find "$OUT_DIR" -maxdepth 1 -name 'meter-*.dump' | wc -l) ไฟล์ (เพดาน $KEEP)"
