# BillScan

แคปภาพแชทสั่งของ (Facebook Messenger, Line ฯลฯ) แล้วให้ AI อ่านออกมาเป็นชื่อลูกค้า/เบอร์โทร/โปรที่เลือก
ให้อัตโนมัติ จากนั้นตรวจทาน แก้ไข และสร้างบิลออเดอร์ที่พร้อมส่งให้ทีมเดลิเวอรีได้ทันที — ธีมมินิมอล ฟ้า-ขาว

ออกแบบมาสำหรับร้านกาแฟที่ขายเป็นโปรโมชั่น "ซื้อ X แถม X" ราคาเป็นเงินกีบ (KIP)

Web App (PWA) ที่ติดตั้งลงหน้าจอมือถือได้ ใช้งานได้ทั้งมือถือและคอมพิวเตอร์

## ฟีเจอร์หลัก

- 📷 แนบภาพแชทสั่งของ (อัปโหลด / ถ่ายรูป / วาง Ctrl+V)
- 🤖 ให้ **Gemini** อ่านภาพแล้วดึงชื่อลูกค้า/เบอร์โทร/โปรที่เลือกมาเติมฟอร์มให้อัตโนมัติ (อ่านภาษาลาว/ไทยแบบไม่เป๊ะได้ดี)
- 🏷️ ปุ่มเลือกโปรด่วน (1 แถม 1, 2 แถม 2, 3 แถม 3, 5 แถม 5, 10 แถม 10) หรือกรอกเอง/แก้ไขได้เสมอ
- 🧾 สร้างบิลพร้อมพิมพ์ / แชร์ข้อความบิลให้ไรเดอร์ผ่าน Web Share API
- 📦 สถานะออเดอร์: ฉบับร่าง → พร้อมส่ง → จัดส่งแล้ว
- ⚙️ ตั้งค่าข้อมูลร้าน (ชื่อ/เบอร์/ที่อยู่) แสดงบนหัวบิล
- 🔐 ระบบล็อกอิน + ข้อมูลเก็บบน Supabase (Postgres + Auth + Storage) แยกตามผู้ใช้ด้วย Row Level Security

## สแตก

- [Vite](https://vite.dev) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) (ธีมสี minimal blue/white ปรับได้ที่ `src/index.css`)
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, Edge Functions
- [Gemini API](https://ai.google.dev) (เรียกผ่าน Supabase Edge Function เพื่อไม่ให้ API key หลุดไปที่เบราว์เซอร์) — free tier ไม่ต้องผูกบัตรเครดิต
- `vite-plugin-pwa` สำหรับติดตั้งเป็นแอปบนมือถือ

## เริ่มต้นใช้งาน (local dev)

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. สร้างโปรเจกต์ Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. รันไฟล์ `supabase/migrations/0001_init.sql` แล้วตามด้วย `0002_coffee_combo_orders.sql` ใน SQL editor ของโปรเจกต์
3. คัดลอก Project URL และ anon public key จาก Settings → API

### 3. ตั้งค่าตัวแปรแวดล้อมฝั่งเว็บ

```bash
cp .env.example .env.local
# แล้วใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
```

### 4. Deploy Edge Function สำหรับอ่านภาพ

สร้าง API key ของ Gemini (ฟรี ไม่ต้องผูกบัตรเครดิต) ที่ [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
จากนั้น deploy edge function:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy smart-scan
npx supabase secrets set GEMINI_API_KEY=your-gemini-key
```

### 5. รันแอป

```bash
npm run dev
```

## โครงสร้างโปรเจกต์

```
src/
  pages/         หน้าเว็บหลัก (Login, Dashboard, NewOrder, BillView, Settings)
  components/    ส่วนประกอบ UI ที่ใช้ร่วมกัน (Layout, ProtectedRoute, Spinner)
  context/       AuthContext (สถานะการล็อกอิน)
  lib/           supabase client, เรียก smart-scan, format
  types.ts       TypeScript types ของ Order / ShopSettings
supabase/
  migrations/    SQL schema + RLS policies
  functions/     Edge Function smart-scan (proxy ไปยัง Gemini)
```

## หมายเหตุเรื่องความแม่นยำ

Gemini อ่านภาพและดึงข้อมูลให้แบบ best-effort — ข้อความแชทที่ไม่ชัด/พิมพ์ผิด/ไม่มีข้อมูลบางอย่าง
อาจทำให้ผลลัพธ์ไม่ครบหรือผิดได้ ฟอร์มทุกช่องแก้ไขได้เสมอ ควรตรวจสอบก่อนกดบันทึกบิลทุกครั้ง

## คำสั่งที่ใช้บ่อย

```bash
npm run dev       # รัน dev server
npm run build      # type-check + build สำหรับ production
npm run preview    # preview build
npm run lint       # oxlint
```
