#!/usr/bin/env bash
# พิสูจน์ว่า dump ล่าสุด restore กลับมาได้จริง
#
#   ~/Meter/deploy/restore-test.sh
#
# ทำไมต้องมี: **backup ที่ไม่เคยทดสอบ restore ไม่นับว่าเป็น backup**
# ไฟล์ที่มีขนาดพอดูอาจเสียได้หลายแบบ — pg_dump ถูกฆ่ากลางคัน, ดิสก์เต็มตอนเขียน,
# ไฟล์เสียหายตอนคัดลอก ทั้งหมดนี้จะรู้ตอนของจริงหายไปแล้วถ้าไม่เคยลอง
#
# restore เข้า database ชั่วคราวแล้วลบทิ้ง — **ไม่แตะข้อมูลจริงเลย**
# จึงรันซ้ำได้บ่อยเท่าที่ต้องการ แม้ระบบกำลังทำงานอยู่

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

CONTAINER="${BACKUP_CONTAINER:-meter-postgres}"
DB_USER="${BACKUP_DB_USER:-meter}"
DB_NAME="${BACKUP_DB_NAME:-meter}"
OUT_DIR="${BACKUP_DIR:-$HOME/meter-backups}"
SCRATCH="meter_restore_test"

FILE="${1:-}"
if [ -z "$FILE" ]; then
  FILE="$(find "$OUT_DIR" -maxdepth 1 -name 'meter-*.dump' -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)"
fi

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "❌ ไม่พบไฟล์ dump ใน $OUT_DIR — รัน deploy/backup.sh ก่อน"
  exit 1
fi

echo "ทดสอบไฟล์: $FILE ($(du -h "$FILE" | cut -f1))"

psql_q() { docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$1" -tAc "$2"; }

cleanup() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -qc "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -qc "CREATE DATABASE $SCRATCH" >/dev/null
echo "สร้าง database ชั่วคราว $SCRATCH แล้ว"

# --no-owner กันพลาดกรณี role ในไฟล์ dump ไม่ตรงกับเครื่องที่ restore
if ! docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$SCRATCH" --no-owner < "$FILE" 2>/tmp/restore-err.txt; then
  echo "❌ pg_restore ล้มเหลว:"
  tail -20 /tmp/restore-err.txt
  exit 1
fi
echo "restore เข้า $SCRATCH สำเร็จ"

FAIL=0
for T in devices points readings; do
  SRC="$(psql_q "$DB_NAME" "SELECT count(*) FROM $T")"
  DST="$(psql_q "$SCRATCH" "SELECT count(*) FROM $T")"
  # ของจริงเดินหน้าตลอดเวลา (ingest เขียนอยู่) dump จึงมีได้ไม่เกินของจริง
  # เช็คว่า "ไม่ว่างเปล่า" และ "ไม่เกินของจริง" — ถ้าเท่ากันเป๊ะแปลว่าหยุดนิ่งพอดี ก็ผ่าน
  if [ "$DST" -gt 0 ] && [ "$DST" -le "$SRC" ]; then
    echo "  ✅ $T: dump มี $DST แถว (ของจริงตอนนี้ $SRC)"
  else
    echo "  ❌ $T: dump มี $DST แถว (ของจริง $SRC) — ผิดปกติ"
    FAIL=$((FAIL + 1))
  fi
done

# ตรวจว่า index สำคัญติดมาด้วย ไม่ใช่แค่ข้อมูลดิบ
# restore ที่ได้ข้อมูลแต่ไม่มี index จะกลับมาแล้วช้าจนใช้ไม่ได้
IDX="$(psql_q "$SCRATCH" "SELECT count(*) FROM pg_indexes WHERE tablename='readings'")"
if [ "$IDX" -ge 3 ]; then
  echo "  ✅ index ของ readings ติดมาครบ ($IDX ตัว)"
else
  echo "  ❌ index ของ readings มาไม่ครบ ($IDX ตัว คาดว่า >= 3)"
  FAIL=$((FAIL + 1))
fi

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "✅ ผ่าน — dump นี้ restore กลับมาได้จริง"
else
  echo ""
  echo "❌ ไม่ผ่าน $FAIL ข้อ — อย่าไว้ใจ backup ชุดนี้"
  exit 1
fi
