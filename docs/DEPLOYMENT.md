# DEPLOYMENT — เอาขึ้น Raspberry Pi 5

> เครื่องเป้าหมาย: `smsn-pi-office-01` · Pi 5 8GB · Debian 13 (trixie) aarch64 · **บูตจาก SD**
> โปรเจกต์อยู่ที่ `~/Meter` · เข้าผ่าน ssh alias `pi_5_orc_V5` (ProxyJump ผ่าน v5.smartsensedesign.net)

ทุกคำสั่งข้างล่างรัน **บน Pi** จากโฟลเดอร์ `~/Meter` เว้นแต่ระบุไว้เป็นอย่างอื่น

---

## สิ่งที่ต้องมีก่อน (ลงไปแล้ว 2026-08-26)

| | เช็คด้วย |
|---|---|
| Docker + user อยู่ใน group `docker` | `docker run --rm hello-world` |
| Bun | `bun --version` → 1.4.0 |
| repo | `ls ~/Meter` |

⚠️ **Pi เครื่องนี้เคยมี mosquitto จาก apt จองพอร์ต 1883** ปิดไปแล้วด้วย `sudo systemctl disable --now mosquitto`
ถ้าเจอ `address already in use` ตอน compose up ให้เช็คว่ามันกลับมาไหม

---

## 1. ดึงโค้ดล่าสุด

```bash
cd ~/Meter && git pull
```

## 2. ตั้งค่า `.env`

`.env` ไม่ขึ้น git (มีรหัสผ่าน) ต้องสร้างบนเครื่องเอง **ครั้งเดียว**

```bash
cd ~/Meter
PGPW=$(openssl rand -hex 16)
cat > .env <<EOF
POSTGRES_PASSWORD=$PGPW
DATABASE_URL=postgres://meter:$PGPW@localhost:5432/meter
MQTT_URL=mqtt://localhost:1883
MQTT_TOPIC_PREFIX=meter
PORT=3000
EOF
chmod 600 .env
```

> ถ้าเคยตั้งไปแล้วและ container สร้างไปแล้ว **การเปลี่ยนรหัสผ่านใน .env จะไม่เปลี่ยนรหัสใน DB**
> เพราะ Postgres อ่าน `POSTGRES_PASSWORD` เฉพาะตอนสร้าง volume ครั้งแรก — ถ้าจะเปลี่ยนจริง
> ต้อง `ALTER USER` ใน psql หรือลบ volume ทิ้ง (ข้อมูลหาย)

## 3. ขึ้น Postgres + Mosquitto

```bash
cd ~/Meter
docker compose --env-file .env -f deploy/docker-compose.yml up -d
```

**ตรวจให้ครบ 3 อย่าง อย่าดูแค่ `docker ps`:**

```bash
docker compose --env-file .env -f deploy/docker-compose.yml ps
docker port meter-mqtt && docker port meter-postgres
(echo > /dev/tcp/127.0.0.1/1883) && echo "1883 ต่อได้"
```

> 🔴 บทเรียนจากรอบก่อน: `docker run` ที่ล้มตอน setup network จะทิ้ง container ที่ `Up` ได้
> แต่**ไม่มี port mapping** และ `docker start` ซ้ำไม่ช่วย ต้อง `rm` แล้วสร้างใหม่
> `docker port` เป็นตัวชี้ขาด — **`ss -lptn` ใช้ไม่ได้** เพราะ Docker รุ่นใหม่ forward ผ่าน
> netfilter โดยไม่มี process listen บนโฮสต์

## 4. ลง dependency + สร้างตาราง + build หน้าเว็บ

```bash
cd ~/Meter
bun install
bun run db:migrate
# ⚠️ db:seed ใส่ข้อมูล "ปลอม" สำหรับ dev — **อย่ารันบนเครื่องที่มีข้อมูลจริงแล้ว**
# ถ้าเผลอรันไปแล้ว ล้างด้วย: bun run purge-dev-seed --yes  (ดูก่อนได้ด้วยการรันโดยไม่ใส่ --yes)
# bun run db:seed
bun run build
```

> `bun install` ต้องรันบน Pi เสมอ **ห้ามก๊อป `node_modules` จากเครื่อง dev** เพราะเป็นของ Windows x64

## 5. ตั้ง service ให้ขึ้นเองตอนบูต

```bash
sudo cp ~/Meter/deploy/meter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now meter
systemctl status meter --no-pager
```

ตรวจว่าใช้ได้จริง:

```bash
curl -s localhost:3000/api/health
```

ต้องได้ `"status":"ok"` และ `postgres.ok = true` — ถ้าได้ `503` แปลว่า DB ยังไม่ขึ้นหรือรหัสผ่านไม่ตรง

ดู log:
```bash
journalctl -u meter -f
```

## 6. ตั้งจอ kiosk

```bash
chmod +x ~/Meter/deploy/kiosk/kiosk-launch.sh
mkdir -p ~/.config/autostart
cp ~/Meter/deploy/kiosk/meter-kiosk.desktop ~/.config/autostart/
```

ปิดการดับหน้าจอ (จอติดผนังต้องติดตลอด):
```bash
sudo raspi-config    # Display Options → Screen Blanking → Disable
```

ลองรันสคริปต์ตรง ๆ ก่อน reboot จะได้รู้ว่ามันพังตรงไหน:
```bash
~/Meter/deploy/kiosk/kiosk-launch.sh
```
ถ้าไม่ขึ้น ดู `~/meter-kiosk.log`

> ✅ ยืนยันบนเครื่องจริงแล้วว่า **`~/.config/autostart` ใช้ได้** — `/etc/xdg/labwc/autostart`
> ของ Pi OS เรียก `lxsession-xdg-autostart` ซึ่งอ่านโฟลเดอร์นั้นให้อยู่แล้ว
> **ห้ามสร้าง `~/.config/labwc/autostart` เอง** — labwc จะใช้ไฟล์ส่วนตัวแทนของระบบทั้งไฟล์
> แล้ว taskbar (`wf-panel-pi`) กับ desktop (`pcmanfm-pi`) จะไม่ถูกเรียก = เดสก์ท็อปพัง
>
> ถ้าหลัง reboot จอยังไม่ขึ้น ให้ดู `~/meter-kiosk.log` ก่อนเสมอ — บอกได้ว่าสคริปต์ถูกเรียกไหม
> และตายที่ขั้นไหน · ถ้า session ไม่ได้อ่าน `~/.config/autostart` จริง ๆ
> เช็คว่าใช้ compositor อะไรด้วย `ps -e | grep -Ei 'labwc|wayfire'` แล้วใส่ autostart ตามตัวนั้นแทน:
> - **labwc** → เพิ่มบรรทัด `/home/pi/Meter/deploy/kiosk/kiosk-launch.sh &` ใน `~/.config/labwc/autostart`
> - **wayfire** → เพิ่ม `[autostart]` `meter = /home/pi/Meter/deploy/kiosk/kiosk-launch.sh` ใน `~/.config/wayfire.ini`

## 7. ทดสอบ definition of done

```bash
sudo reboot
```

หลังบูตขึ้นมา **ห้ามพิมพ์อะไรเลย** แล้วต้องได้ครบ 3 ข้อ:

1. จอ Pi ขึ้น dashboard เอง
2. `curl -s localhost:3000/api/health` ตอบ `ok`
3. ยิง mock จาก**เครื่องอื่น**แล้วค่าขึ้นจอ:
   ```bash
   # รันบนเครื่อง dev
   MQTT_URL=mqtt://smsn-pi-office-01.local:1883 bun run mock-edge
   ```

---

## อัปเดตโค้ดรอบถัดไป

```bash
cd ~/Meter && git pull && bun install && bun run db:migrate && bun run build && sudo systemctl restart meter
```

---

## หนี้ที่ยังค้าง (อย่าลืมก่อนใช้งานจริง)

| | ticket |
|---|---|
| 🔴 **Postgres อยู่บน SD** — ไฟดับกลางคันอาจ corrupt ; ยอมรับไว้โดยแลกกับต้องมี backup นอกเครื่อง (D-006) | **T-010** |
| ยังไม่มี user/password + ACL บน broker — ใครอยู่ใน LAN ก็ publish ค่ามั่วเข้ามาได้ | **T-008** |
| ยังไม่มี retention — `readings` โตไปเรื่อย ๆ บน SD ที่เหลือ ~19GB | **T-009** |
| ยังไม่มี watchdog ที่ restart ตาม `/api/health` — ตอนนี้ systemd restart เฉพาะตอน process ตายเท่านั้น ถ้าแอปยังอยู่แต่ DB ล่มค้าง จะไม่มีใคร restart ให้ | — |

## แก้ปัญหาที่เจอบ่อย

**`meter.service` ขึ้น `status=203/EXEC`** — หา `bun` ไม่เจอ · systemd ไม่อ่าน `~/.bashrc`
ต้องใช้ path เต็มใน `ExecStart` (`/home/pi/.bun/bin/bun`) เช็คด้วย `which bun` ว่าตรงกันไหม

**health ตอบ 503 ตลอด** — `DATABASE_URL` ใน `.env` ไม่ตรงกับรหัสผ่านที่ container ถูกสร้างมา
เช็คด้วย `docker exec -it meter-postgres psql -U meter -d meter -c '\dt'`

**edge จากเครื่องอื่นต่อ broker ไม่ได้** แต่บน Pi ต่อได้ — `docker port meter-mqtt` ต้องเป็น
`0.0.0.0:1883` ไม่ใช่ `127.0.0.1:1883`

**kiosk เปิดได้แต่ไม่เต็มจอ** — เกิดจากใส่ `--app=<url>` คู่กับ `--kiosk`
สองอันนี้ตีกัน (`--app` = หน้าต่างแอปขนาดปกติ) และบน Wayland ตัว `--app` ชนะ
วิธีที่ถูกคือส่ง URL เป็น argument ธรรมดา **ห้ามใส่ `--app`**

**kiosk ตายด้วย `Missing X server or $DISPLAY`** — chromium เลือก backend เป็น X11
ทั้งที่ session เป็น Wayland (labwc) · สคริปต์ตรวจ `WAYLAND_DISPLAY` แล้วใส่ `--ozone-platform`
ให้เองแล้ว ถ้ายังเจอ แปลว่า env ตอน autostart ไม่มีตัวแปรนั้น — ดูบรรทัดแรกของ `~/meter-kiosk.log`

**`bun run start` ขึ้น `EADDRINUSE`** — ไม่ใช่ความผิดพลาด แปลว่า systemd service `meter`
ทำงานอยู่แล้วและถือ port 3000 ไว้ · ใช้ `systemctl status meter` / `journalctl -u meter -f` แทน

**จอขึ้นแต่ไม่มีข้อมูล** — ดู `curl localhost:3000/api/health` ที่ `checks.ingest.received`
ถ้าไม่ขยับ = ไม่มีใคร publish เข้ามา ; ถ้า `invalid` ขยับ = มีคนส่งแต่ผิดสัญญา ดู `journalctl -u meter`
