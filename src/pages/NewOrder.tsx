import { useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { smartScanOrder } from '@/lib/smartScan'
import { formatCurrency } from '@/lib/format'
import Spinner from '@/components/Spinner'

const COMBO_PRESETS = [
  { label: '1 แถม 1', paid: 1, free: 1, total: 280000 },
  { label: '2 แถม 2', paid: 2, free: 2, total: 550000 },
  { label: '3 แถม 3', paid: 3, free: 3, total: 800000 },
  { label: '5 แถม 5', paid: 5, free: 5, total: 1200000 },
  { label: '10 แถม 10', paid: 10, free: 10, total: 2200000 },
] as const

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NewOrder() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scannedOnce, setScannedOnce] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderDate, setOrderDate] = useState(today())
  const [paidQty, setPaidQty] = useState(1)
  const [freeQty, setFreeQty] = useState(1)
  const [totalAmount, setTotalAmount] = useState(0)
  const [billNumber, setBillNumber] = useState('')
  const [destination, setDestination] = useState('')
  const [note, setNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function loadFile(file: File) {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setScanError(null)
    setScannedOnce(false)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const file = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))?.getAsFile()
    if (file) loadFile(file)
  }

  async function handleScan() {
    if (!imageFile) return
    setScanning(true)
    setScanError(null)
    try {
      const combos = COMBO_PRESETS.map((p) => ({ paid: p.paid, free: p.free, total: p.total }))
      const result = await smartScanOrder(imageFile, combos)

      if (result.customer_name) setCustomerName(result.customer_name)
      if (result.customer_phone) setCustomerPhone(result.customer_phone)
      if (result.paid_qty != null) setPaidQty(result.paid_qty)
      if (result.free_qty != null) setFreeQty(result.free_qty)
      if (result.total_amount != null) setTotalAmount(result.total_amount)
      if (result.note) setNote((prev) => (prev ? `${prev}\n${result.note}` : result.note!))

      if (!result.customer_name && result.paid_qty == null && result.total_amount == null) {
        setScanError('อ่านออเดอร์จากภาพนี้ไม่ได้ ลองกรอกฟอร์มด้านล่างเองได้เลย')
      }
      setScannedOnce(true)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'สแกนภาพไม่สำเร็จ')
    } finally {
      setScanning(false)
    }
  }

  function applyPreset(preset: (typeof COMBO_PRESETS)[number]) {
    setPaidQty(preset.paid)
    setFreeQty(preset.free)
    setTotalAmount(preset.total)
  }

  async function handleSave(status: 'draft' | 'ready') {
    if (!user) return
    if (!customerName.trim()) {
      setSaveError('กรุณากรอกชื่อลูกค้า')
      return
    }
    setSaving(true)
    setSaveError(null)

    try {
      let sourceImagePath: string | null = null
      if (imageFile) {
        const path = `${user.id}/${Date.now()}-${imageFile.name.replace(/[^\w.-]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('screenshots').upload(path, imageFile)
        if (uploadError) throw uploadError
        sourceImagePath = path
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone || null,
          destination: destination || null,
          note: note || null,
          status,
          order_date: orderDate,
          paid_qty: paidQty,
          free_qty: freeQty,
          total_amount: totalAmount,
          bill_number: billNumber || null,
          source_image_path: sourceImagePath,
        })
        .select()
        .single()
      if (orderError) throw orderError

      navigate(`/orders/${order.id}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'บันทึกออเดอร์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-ink">เพิ่มออเดอร์ใหม่</h1>
        <p className="text-sm text-ink-muted">แนบภาพแชทสั่งของแล้วให้ AI อ่านให้ หรือเลือกโปร/กรอกเองด้านล่าง</p>
      </div>

      {/* Image capture / smart scan */}
      <div
        onPaste={handlePaste}
        tabIndex={0}
        className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-surface p-5 text-center outline-none focus:border-brand-400"
      >
        {imagePreview ? (
          <img src={imagePreview} alt="ภาพที่เลือก" className="max-h-64 w-full rounded-lg object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-ink-muted">
            <CameraIcon className="size-9 text-brand-400" />
            <p className="text-sm">แคปภาพแชทสั่งของ แล้วแตะเพื่อเลือก ถ่ายรูป หรือวาง (Ctrl+V) ที่นี่</p>
          </div>
        )}

        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
          >
            {imageFile ? 'เปลี่ยนภาพ' : 'เลือกภาพ / ถ่ายรูป'}
          </button>
          <button
            type="button"
            onClick={() => void handleScan()}
            disabled={!imageFile || scanning}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {scanning && <Spinner className="size-4 text-white" />}
            {scanning ? 'กำลังอ่านออเดอร์...' : 'ให้ AI อ่านออเดอร์'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {scanError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{scanError}</p>}
      {scannedOnce && !scanError && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          อ่านออเดอร์แล้ว ตรวจสอบและแก้ไขข้อมูลด้านล่างก่อนบันทึกบิล
        </p>
      )}

      {/* Combo presets */}
      <div className="flex flex-wrap gap-2">
        {COMBO_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              paidQty === preset.paid && freeQty === preset.free && totalAmount === preset.total
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line bg-surface text-ink hover:border-brand-300 hover:bg-brand-50'
            }`}
          >
            {preset.label} ({formatCurrency(preset.total)})
          </button>
        ))}
      </div>

      {/* Order fields */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="font-medium text-ink">ชื่อลูกค้า *</span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="font-medium text-ink">เบอร์โทร</span>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="font-medium text-ink">วันที่</span>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">ชิ้นจ่ายเงิน</span>
            <input
              type="number"
              min={0}
              value={paidQty}
              onChange={(e) => setPaidQty(Number(e.target.value))}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">ชิ้นแถม</span>
            <input
              type="number"
              min={0}
              value={freeQty}
              onChange={(e) => setFreeQty(Number(e.target.value))}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">ยอดรวม (KIP)</span>
            <input
              type="number"
              min={0}
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="font-medium text-ink">เลขบิล</span>
            <input
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="font-medium text-ink">ปลายทาง</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">หมายเหตุ</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>
      </div>

      {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</p>}

      <div className="flex gap-2 pb-4">
        <button
          type="button"
          onClick={() => void handleSave('draft')}
          disabled={saving}
          className="flex-1 rounded-lg border border-line bg-surface py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:opacity-50"
        >
          บันทึกฉบับร่าง
        </button>
        <button
          type="button"
          onClick={() => void handleSave('ready')}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {saving && <Spinner className="size-4 text-white" />}
          สร้างบิล & พร้อมส่ง
        </button>
      </div>
    </div>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
