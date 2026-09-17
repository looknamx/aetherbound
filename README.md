# Aetherbound — The Shattered Isles

เว็บเกม Auto Battler สำหรับเพื่อน 2–4 คน ใช้ห้องส่วนตัว กระดาน 6×6 และเซิร์ฟเวอร์เป็นผู้ตัดสินกติกาทั้งหมด สร้างโลก ตัวละคร ภาพ placeholder และเสียงขึ้นใหม่สำหรับโปรเจกต์นี้

## เปิดเล่นในเครื่อง

ต้องมี **Node.js 22.12+ หรือ 24** และ npm ไม่จำเป็นต้องติดตั้งฐานข้อมูลเพื่อเล่น

```powershell
npm ci
npm run db:generate
npm run dev
```

เปิด **http://localhost:5173** สองหน้าต่างหรือสองแท็บ:

1. ผู้เล่นแรกกรอกชื่อแล้วกด **Create a private room**
2. ผู้เล่นที่สองกรอกชื่อและ Room Key แล้วกด **Join room** หรือเปิด invite URL ในแท็บใหม่
3. ทุกคนกด **Ready up** แล้ว Host กด **Begin expedition**
4. ซื้อยูนิตจากร้านด้านล่าง ลากจาก Reserves ลงกระดาน หรือกดยูนิตแล้วกดช่องปลายทาง
5. ซื้อยูนิตชื่อเดียวกันและดาวเดียวกัน 3 ตัวเพื่อรวมดาวอัตโนมัติ
6. ลากไอเทมจาก Relic Satchel ลงยูนิต หรือเลือกไอเทมแล้วเลือกยูนิต
7. หมดเวลาเตรียม 30 วินาทีจะต่อสู้อัตโนมัติ เล่นจนเหลือผู้ชนะ

รีเฟรชแท็บเดิมเพื่อกลับเข้าที่นั่งเดิมได้ Session แยกตามแท็บด้วย `sessionStorage` อย่าใช้ Duplicate Tab เพื่อสร้างผู้เล่นใหม่ เพราะบางเบราว์เซอร์คัดลอก session ไปด้วย ให้เปิดแท็บใหม่แล้วกรอก URL แทน

### เล่นกับเพื่อนใน LAN

ให้เพื่อนเปิด `http://<IP ของเครื่องเซิร์ฟเวอร์>:5173` โดยเครื่องต้องเข้าถึงกันได้ และ firewall ต้องอนุญาตพอร์ตนี้ เข้าเว็บไซต์ผ่าน IP เดียวกันก่อนคัดลอก invite URL เพื่อไม่ส่ง `localhost` ให้เครื่องอื่น การแชร์ข้ามอินเทอร์เน็ตต้องนำเซิร์ฟเวอร์ไปโฮสต์พร้อม HTTPS/WebSocket; งานนี้ยังไม่ได้ deploy สาธารณะ

### คำสั่ง

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | เริ่ม client 5173 และ server 3001 |
| `npm run dev:client` | Vite client อย่างเดียว |
| `npm run dev:server` | Authoritative server อย่างเดียว |
| `npm run build` | ตรวจ TypeScript และสร้าง client production bundle |
| `npm start` | เสิร์ฟ bundle และ Socket.IO จาก http://localhost:3001 |
| `npm test` | Unit และ real-socket integration tests |
| `npm run test:e2e` | Chromium E2E สอง client และ viewport มือถือ |
| `npm run db:generate` | สร้าง Prisma client |
| `docker compose up -d db` | เริ่ม PostgreSQL ทางเลือก |
| `npm run db:migrate` | ใช้ schema migration |
| `npm run db:seed` | บันทึก content v1 ในฐานข้อมูล |

ทดสอบ browser ครั้งแรก:

```powershell
npx playwright install chromium
npm run build
npm run test:e2e
```

E2E ใช้เซิร์ฟเวอร์แยกพอร์ต **3101** และไม่แตะห้องที่เล่นบน 3001 ตัวทดสอบรอ preparation จริงในรอบแรก แล้วเร่งรอบถัดไปผ่าน development controls ภาพอยู่ใน `artifacts/playtest/` และ HTML report อยู่ใน `playwright-report/`

## Configuration และ persistence

คัดลอก `.env.example` เป็น `.env` เมื่อต้องการเปลี่ยนค่า ตัว server โหลดไฟล์นี้ตอนเริ่มต้น ค่า environment ที่กำหนดไว้แล้วมีลำดับความสำคัญสูงกว่าไฟล์

ห้องและ session ที่กำลังเล่นอยู่เก็บในหน่วยความจำเพื่อให้เริ่ม MVP ได้ทันที จบเกมแล้วเขียนประวัติ JSON แบบ atomic ลง `.data/matches/` หากตั้ง `DATABASE_URL` จะใช้ Prisma/PostgreSQL เก็บประวัติแทน **การ restart server ทำให้ห้องและ session ปัจจุบันหาย** การ refresh browser หรือเน็ตหลุดชั่วคราวไม่ทำให้ห้องหาย

เลือก PostgreSQL:

```powershell
docker compose up -d db
$env:DATABASE_URL='postgresql://aether:aether_local@localhost:5432/aetherbound'
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

รหัสผ่านใน Compose เป็นค่าตัวอย่างสำหรับฐานข้อมูล local ที่ bind เฉพาะ loopback ไม่ใช่ production credential

Production process หลัง `npm run build`:

```powershell
$env:NODE_ENV='production'
$env:CLIENT_ORIGIN='https://your-host.example'
npm start
```

ใช้ reverse proxy ส่ง HTTP และ WebSocket ไปพอร์ต 3001 แล้วตั้ง `CLIENT_ORIGIN` ให้ตรงกับ origin สาธารณะ ใช้หนึ่ง server instance ต่อชุดห้องใน MVP

## Development tools

ปิดไว้โดยค่าเริ่มต้น ต้องตั้ง `ENABLE_DEV_TOOLS=true`, ไม่ใช่ `NODE_ENV=production` และเข้าเว็บผ่าน loopback origin Host จะเห็นแผง Development controls ด้านล่างเกม

| ปุ่ม | ค่าในช่อง Developer value |
|---|---|
| gold / level | เพิ่ม 50 gold / เพิ่ม 1 level |
| seed | จำนวนเต็ม 0–4294967295 |
| shop / unit | Unit ID เช่น `cinder` |
| item | Item ID เช่น `sunshard` |
| speed | `1`, `5` หรือ `20` มีผลกับ phase ถัดไป |
| advance | ข้ามไป phase ถัดไปทันที |

มี combat log แบบ read-only ในแผงเดียวกัน การเปลี่ยนข้อมูลยูนิต/ไอเทมทำได้เฉพาะ Preparing; seed และ speed ใช้ทดสอบการจำลองซ้ำได้

## เอกสารและข้อจำกัด

- [กติกาและสมมติฐาน](docs/RULES.md)
- [Architecture และ event protocol](docs/ARCHITECTURE.md)
- [รายชื่อตัวละคร สกิล traits และไอเทม](docs/CONTENT.md)
- [ผลการทดสอบจริง](TEST_REPORT.md)
- [งานต่อยอดและข้อจำกัด](ROADMAP.md)
- [แหล่งที่มาของ assets และ dependencies](docs/ATTRIBUTION.md)

ยังไม่มี finite shared unit pool, persistence ของแมตช์ที่กำลังเล่น, matchmaking สาธารณะ หรือระบบหลาย server ดูรายละเอียดใน ROADMAP โดยเฉพาะข้อจำกัดของโหมด production
