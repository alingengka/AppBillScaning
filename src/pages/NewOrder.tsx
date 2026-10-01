import { useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { smartScanOrder } from '@/lib/smartScan'
import OrderFields from '@/components/OrderFields'
import { formValuesToColumns, type OrderFormValues } from '@/lib/orderForm'
import { COMBO_PRESETS } from '@/lib/combos'
import Spinner from '@/components/Spinner'
import Lightbox from '@/components/Lightbox'
import { BillAndSource } from '@/components/BillWithSource'
import type { Order } from '@/types'

const SCAN_CONCURRENCY = 4
const SAVE_CONCURRENCY = 3

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Draft extends OrderFormValues {
  id: string
  file: File
  preview: string
  status: 'scanning' | 'scanned' | 'error'
  scanError: string | null
}

function newDraft(file: File): Draft {
  return {
    id: crypto.randomUUID(),
    file,
    preview: URL.createObjectURL(file),
    status: 'scanning',
    scanError: null,
    customerName: '',
    customerPhone: '',
    orderDate: today(),
    paidQty: 1,
    freeQty: 1,
    totalAmount: 0,
    billNumber: '',
    destination: '',
    paymentMethod: null,
    note: '',
  }
}

/** The draft shaped like a saved order, so BillSheet can preview it as printed. */
function draftToOrder(draft: Draft): Order {
  return {
    ...formValuesToColumns(draft),
    id: draft.id,
    user_id: '',
    status: 'draft',
    source_image_path: null,
    created_at: '',
    updated_at: '',
  }
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0
  async function worker() {
    while (index < items.length) {
      const item = items[index++]
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export default function NewOrder() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  function patchDraft(id: string, patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)),
    )
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((d) => d.id !== id)
    })
  }

  async function scanDrafts(targets: Draft[]) {
    const combos = COMBO_PRESETS.map((p) => ({ paid: p.paid, free: p.free, total: p.total }))
    await mapWithConcurrency(targets, SCAN_CONCURRENCY, async (draft) => {
      try {
        const result = await smartScanOrder(draft.file, combos)
        patchDraft(draft.id, (d) => ({
          status: 'scanned',
          scanError: null,
          customerName: result.customer_name ?? d.customerName,
          customerPhone: result.customer_phone ?? d.customerPhone,
          paidQty: result.paid_qty ?? d.paidQty,
          freeQty: result.free_qty ?? d.freeQty,
          totalAmount: result.total_amount ?? d.totalAmount,
          paymentMethod: result.payment_method ?? d.paymentMethod,
          destination: result.destination ?? d.destination,
          note: result.note ? (d.note ? `${d.note}\n${result.note}` : result.note) : d.note,
        }))
      } catch (err) {
        patchDraft(draft.id, {
          status: 'error',
          scanError: err instanceof Error ? err.message : 'สแกนภาพไม่สำเร็จ',
        })
      }
    })
  }

  function addFiles(files: File[]) {
    if (files.length === 0) return
    const created = files.map(newDraft)
    setDrafts((prev) => [...prev, ...created])
    void scanDrafts(created)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const files = [...e.clipboardData.items]
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null)
    addFiles(files)
  }

  function retryScan(draft: Draft) {
    patchDraft(draft.id, { status: 'scanning', scanError: null })
    void scanDrafts([draft])
  }

  async function handleSaveAll(status: 'draft' | 'ready') {
    if (!user || drafts.length === 0) return

    const missingName = drafts.filter((d) => !d.customerName.trim())
    if (missingName.length > 0) {
      setSaveError(`กรุณากรอกชื่อลูกค้าให้ครบ (ขาดอยู่ ${missingName.length} รายการ — มีกรอบสีแดง)`)
      return
    }

    setSaving(true)
    setSaveError(null)
    setSavedCount(0)
    const failed: Draft[] = []

    await mapWithConcurrency(drafts, SAVE_CONCURRENCY, async (draft) => {
      try {
        const path = `${user.id}/${Date.now()}-${draft.file.name.replace(/[^\w.-]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('screenshots').upload(path, draft.file)
        if (uploadError) throw uploadError

        const { error: orderError } = await supabase.from('orders').insert({
          user_id: user.id,
          ...formValuesToColumns(draft),
          status,
          source_image_path: path,
        })
        if (orderError) throw orderError

        setSavedCount((n) => n + 1)
        URL.revokeObjectURL(draft.preview)
      } catch (err) {
        failed.push(draft)
        patchDraft(draft.id, { scanError: err instanceof Error ? err.message : 'บันทึกออเดอร์นี้ไม่สำเร็จ' })
      }
    })

    setSaving(false)

    if (failed.length === 0) {
      navigate('/')
    } else {
      setDrafts(failed)
      setSaveError(`บันทึกสำเร็จบางส่วน เหลือ ${failed.length} รายการที่บันทึกไม่ผ่าน (ดู error ใต้แต่ละภาพ)`)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-ink">เพิ่มออเดอร์ใหม่</h1>
        <p className="text-sm text-ink-muted">
          แนบภาพแชทสั่งของได้หลายภาพพร้อมกัน — แต่ละภาพจะกลายเป็น 1 ออเดอร์ ให้ AI อ่านให้อัตโนมัติ
        </p>
      </div>

      {/* Add images */}
      <div
        onPaste={handlePaste}
        tabIndex={0}
        className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-surface p-5 text-center outline-none focus:border-brand-400"
      >
        <div className="flex flex-col items-center gap-2 py-2 text-ink-muted">
          <CameraIcon className="size-9 text-brand-400" />
          <p className="text-sm">เลือกภาพแคปแชทจากคลังภาพได้หลายภาพพร้อมกัน ถ่ายรูป หรือวาง (Ctrl+V)</p>
        </div>
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex-[2] rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            เลือกจากคลังภาพ
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
          >
            ถ่ายรูป
          </button>
        </div>
        {/* No `capture` here: on phones it would force the camera and hide the gallery. */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Draft order cards */}
      {drafts.map((draft) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          onPatch={(patch) => patchDraft(draft.id, patch)}
          onRemove={() => removeDraft(draft.id)}
          onRetryScan={() => retryScan(draft)}
        />
      ))}

      {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</p>}
      {saving && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          กำลังบันทึก... สำเร็จแล้ว {savedCount}/{drafts.length}
        </p>
      )}

      {drafts.length > 0 && (
        <div className="flex gap-2 pb-4">
          <button
            type="button"
            onClick={() => void handleSaveAll('draft')}
            disabled={saving}
            className="flex-1 rounded-lg border border-line bg-surface py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:opacity-50"
          >
            บันทึกฉบับร่างทั้งหมด ({drafts.length})
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAll('ready')}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Spinner className="size-4 text-white" />}
            สร้างบิลทั้งหมด ({drafts.length})
          </button>
        </div>
      )}
    </div>
  )
}

function DraftCard({
  draft,
  onPatch,
  onRemove,
  onRetryScan,
}: {
  draft: Draft
  onPatch: (patch: Partial<Draft>) => void
  onRemove: () => void
  onRetryScan: () => void
}) {
  const [viewing, setViewing] = useState<'image' | 'bill' | null>(null)

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      {viewing === 'image' && (
        <Lightbox onClose={() => setViewing(null)}>
          <img src={draft.preview} alt="ภาพแชท" className="w-full rounded-lg" />
        </Lightbox>
      )}
      {viewing === 'bill' && (
        <Lightbox onClose={() => setViewing(null)}>
          <BillAndSource order={draftToOrder(draft)} sourceUrl={draft.preview} />
        </Lightbox>
      )}

      <div className="mb-3 flex items-start gap-3">
        <button
          type="button"
          onClick={() => setViewing('image')}
          aria-label="ดูภาพแชทขนาดเต็ม"
          className="shrink-0 rounded-lg transition hover:opacity-80"
        >
          <img src={draft.preview} alt="ภาพแชท" className="size-16 rounded-lg border border-line object-cover" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {draft.status === 'scanning' && (
            <p className="flex items-center gap-1.5 text-xs text-brand-600">
              <Spinner className="size-3.5" />
              กำลังให้ AI อ่านออเดอร์...
            </p>
          )}
          {draft.status === 'scanned' && !draft.scanError && (
            <p className="text-xs text-emerald-600">อ่านแล้ว ตรวจสอบข้อมูลก่อนบันทึก</p>
          )}
          {draft.scanError && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-red-600">{draft.scanError}</p>
              <button
                type="button"
                onClick={onRetryScan}
                className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                ลองใหม่
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setViewing('image')}
              className="rounded-md border border-line px-2 py-1 text-xs font-medium text-ink transition hover:bg-surface-muted"
            >
              ดูภาพแชท
            </button>
            <button
              type="button"
              onClick={() => setViewing('bill')}
              className="rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
            >
              ดูบิลเทียบกับภาพแชท
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="เอาภาพนี้ออก"
          className="shrink-0 rounded-md p-1.5 text-ink-muted transition hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <OrderFields values={draft} onChange={onPatch} />
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
