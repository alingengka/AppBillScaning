import { useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { scanImageForText } from '@/lib/ocr'
import { parseReceiptText } from '@/lib/parseReceipt'
import { formatCurrency } from '@/lib/format'
import Spinner from '@/components/Spinner'
import type { DraftItem } from '@/types'

export default function NewOrder() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scannedOnce, setScannedOnce] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [note, setNote] = useState('')
  const [deliveryFee, setDeliveryFee] = useState(0)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
  const total = subtotal + (deliveryFee || 0)

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
      const text = await scanImageForText(imageFile)
      const parsed = parseReceiptText(text)
      if (parsed.length === 0) {
        setScanError('ไม่พบข้อความในภาพนี้ ลองเพิ่มรายการด้วยตนเองด้านล่างได้เลย')
      }
      setItems((prev) => [...prev, ...parsed])
      setScannedOnce(true)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'สแกนภาพไม่สำเร็จ')
    } finally {
      setScanning(false)
    }
  }

  function updateItem(id: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function addBlankItem() {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: '', quantity: 1, unit_price: 0 }])
  }

  async function handleSave(status: 'draft' | 'ready') {
    if (!user) return
    if (items.length === 0) {
      setSaveError('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการก่อนบันทึก')
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
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          delivery_address: deliveryAddress || null,
          note: note || null,
          status,
          delivery_fee: deliveryFee || 0,
          source_image_path: sourceImagePath,
        })
        .select()
        .single()
      if (orderError) throw orderError

      const { error: itemsError } = await supabase.from('order_items').insert(
        items
          .filter((it) => it.name.trim().length > 0)
          .map((it) => ({
            order_id: order.id,
            name: it.name.trim(),
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
      )
      if (itemsError) throw itemsError

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
        <h1 className="text-lg font-semibold text-ink">สแกนสินค้าใหม่</h1>
        <p className="text-sm text-ink-muted">อัปโหลดภาพหน้าจอสินค้า ระบบจะอ่านชื่อ/จำนวน/ราคาให้อัตโนมัติ</p>
      </div>

      {/* Image capture / upload */}
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
            <p className="text-sm">แตะเพื่อเลือกภาพ ถ่ายรูป หรือวาง (Ctrl+V) สกรีนช็อตที่นี่</p>
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
            onClick={handleScan}
            disabled={!imageFile || scanning}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {scanning && <Spinner className="size-4 text-white" />}
            {scanning ? 'กำลังสแกน...' : 'สแกนอ่านข้อมูล'}
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
          สแกนสำเร็จ ตรวจสอบและแก้ไขรายการด้านล่างก่อนบันทึกบิล
        </p>
      )}

      {/* Items */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">รายการสินค้า</h2>
          <button type="button" onClick={addBlankItem} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            + เพิ่มรายการ
          </button>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">ยังไม่มีรายการสินค้า สแกนภาพหรือเพิ่มด้วยตนเอง</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                <input
                  value={it.name}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                  placeholder="ชื่อสินค้า"
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-surface-muted px-2 py-1.5 text-sm outline-none focus:border-brand-300"
                />
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })}
                  className="w-14 rounded-md border border-transparent bg-surface-muted px-2 py-1.5 text-center text-sm outline-none focus:border-brand-300"
                />
                <span className="text-xs text-ink-muted">×</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.unit_price}
                  onChange={(e) => updateItem(it.id, { unit_price: Number(e.target.value) })}
                  className="w-20 rounded-md border border-transparent bg-surface-muted px-2 py-1.5 text-right text-sm outline-none focus:border-brand-300"
                />
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  aria-label="ลบรายการ"
                  className="rounded-md p-1.5 text-ink-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer & delivery */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">ข้อมูลลูกค้า / จัดส่ง</h2>
        <div className="flex flex-col gap-2.5">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="ชื่อลูกค้า"
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="เบอร์โทรศัพท์"
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <textarea
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="ที่อยู่จัดส่ง"
            rows={2}
            className="resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุถึงไรเดอร์ (ถ้ามี)"
            rows={2}
            className="resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink-muted">ค่าจัดส่ง</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(Number(e.target.value))}
              className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-right text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between py-0.5 text-ink-muted">
          <span>ยอดรวมสินค้า</span>
          <span>{formatCurrency(subtotal)} ฿</span>
        </div>
        <div className="flex justify-between py-0.5 text-ink-muted">
          <span>ค่าจัดส่ง</span>
          <span>{formatCurrency(deliveryFee || 0)} ฿</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
          <span>ยอดสุทธิ</span>
          <span className="text-brand-700">{formatCurrency(total)} ฿</span>
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1a1.5 1.5 0 0 1-1.5 1.4H8.2a1.5 1.5 0 0 1-1.5-1.4L6 7h12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
