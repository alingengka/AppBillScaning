# BillScan

สแกนภาพหน้าจอสินค้า (เช่นแชทสั่งของ หรือใบเสร็จ) แล้วให้ระบบอ่านชื่อ/จำนวน/ราคาให้อัตโนมัติ
จากนั้นตรวจทาน แก้ไข และสร้างบิลออเดอร์ที่พร้อมส่งให้ทีมเดลิเวอรีได้ทันที — ธีมมินิมอล ฟ้า-ขาว

Web App (PWA) ที่ติดตั้งลงหน้าจอมือถือได้ ใช้งานได้ทั้งมือถือและคอมพิวเตอร์

## ฟีเจอร์หลัก

- 📷 อัปโหลดภาพ / ถ่ายรูป / วาง (paste) สกรีนช็อตสินค้า
- 🔍 OCR ผ่าน Google Cloud Vision อ่านข้อความจากภาพ (รองรับไทย/ลาว/อังกฤษ) แล้วแปลงเป็นรายการสินค้าอัตโนมัติ
- ✏️ ตารางรายการสินค้าที่แก้ไขได้ทั้งชื่อ/จำนวน/ราคา ก่อนบันทึกบิล
- 🧾 สร้างบิลพร้อมพิมพ์ / แชร์ข้อความบิลให้ไรเดอร์ผ่าน Web Share API
- 📦 สถานะออเดอร์: ฉบับร่าง → พร้อมส่ง → จัดส่งแล้ว
- ⚙️ ตั้งค่าข้อมูลร้าน (ชื่อ/เบอร์/ที่อยู่) แสดงบนหัวบิล
- 🔐 ระบบล็อกอิน + ข้อมูลเก็บบน Supabase (Postgres + Auth + Storage) แยกตามผู้ใช้ด้วย Row Level Security

## สแตก

- [Vite](https://vite.dev) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) (ธีมสี minimal blue/white ปรับได้ที่ `src/index.css`)
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, Edge Functions
- [Google Cloud Vision](https://cloud.google.com/vision) OCR API (เรียกผ่าน Supabase Edge Function เพื่อไม่ให้ API key หลุดไปที่เบราว์เซอร์) — เลือกใช้เพราะรองรับภาษาลาว ซึ่ง OCR.space ไม่รองรับ
- `vite-plugin-pwa` สำหรับติดตั้งเป็นแอปบนมือถือ

## เริ่มต้นใช้งาน (local dev)

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. สร้างโปรเจกต์ Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. รันไฟล์ `supabase/migrations/0001_init.sql` ใน SQL editor ของโปรเจกต์ (สร้างตาราง `orders`, `order_items`, `shop_settings` พร้อม Row Level Security และ storage bucket `screenshots`)
3. คัดลอก Project URL และ anon public key จาก Settings → API

### 3. ตั้งค่าตัวแปรแวดล้อมฝั่งเว็บ

```bash
cp .env.example .env.local
# แล้วใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
```

### 4. Deploy Edge Function สำหรับ OCR

สร้าง API key ของ Google Cloud Vision:

1. เปิด [Google Cloud Console](https://console.cloud.google.com) สร้างโปรเจกต์ (หรือใช้โปรเจกต์เดิม) — ต้องผูกบัตรเครดิต/billing account (มี free tier 1,000 ภาพ/เดือน)
2. เปิดใช้งาน **Cloud Vision API** ที่ [console.cloud.google.com/apis/library/vision.googleapis.com](https://console.cloud.google.com/apis/library/vision.googleapis.com)
3. สร้าง API key ที่ [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) แล้วจำกัดสิทธิ์ (Restrict key) ให้ใช้ได้เฉพาะ Cloud Vision API เท่านั้น

จากนั้น deploy edge function:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy ocr-scan
npx supabase secrets set GOOGLE_VISION_API_KEY=your-google-vision-key
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
  lib/           supabase client, เรียก OCR, ตัวแปลงข้อความเป็นรายการสินค้า, format
  types.ts       TypeScript types ของ Order / OrderItem / ShopSettings
supabase/
  migrations/    SQL schema + RLS policies
  functions/     Edge Function ocr-scan (proxy ไปยัง Google Cloud Vision)
```

## หมายเหตุเรื่องความแม่นยำของ OCR

การอ่านชื่อ/จำนวน/ราคาจากภาพเป็นการเดาแบบ heuristic (ดู `src/lib/parseReceipt.ts`) เนื่องจากภาพแต่ละแบบ
(แชทไลน์ ใบเสร็จ สลิป) มีรูปแบบไม่เหมือนกัน ผลลัพธ์จากการสแกนจึงควรถูกตรวจทาน/แก้ไขในตารางรายการ
สินค้าก่อนบันทึกบิลเสมอ

## คำสั่งที่ใช้บ่อย

```bash
npm run dev       # รัน dev server
npm run build      # type-check + build สำหรับ production
npm run preview    # preview build
npm run lint       # oxlint
```
