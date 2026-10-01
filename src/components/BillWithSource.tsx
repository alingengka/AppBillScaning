import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import BillSheet from '@/components/BillSheet'
import Lightbox from '@/components/Lightbox'
import type { Order } from '@/types'

/**
 * Overlay content for checking a bill: the bill as it will print, with the
 * original chat screenshot underneath to compare against.
 */
export function BillAndSource({ order, sourceUrl }: { order: Order; sourceUrl: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-white">ตัวอย่างบิล</p>
      <BillSheet order={order} />
      {sourceUrl && (
        <>
          <p className="mt-2 text-sm font-semibold text-white">ภาพแชทต้นฉบับ</p>
          <img src={sourceUrl} alt="ภาพแชทต้นฉบับ" className="w-full rounded-lg" />
        </>
      )}
    </div>
  )
}

/**
 * Button for a saved order that opens its bill alongside the original chat
 * screenshot. The screenshots bucket is private, so it asks for a
 * short-lived signed link to the user's own file when opened.
 */
export default function OpenSourceButton({ order, className }: { order: Order; className?: string }) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!order.source_image_path) return null

  async function handleOpen() {
    setError(null)
    if (!sourceUrl) {
      const { data, error } = await supabase.storage
        .from('screenshots')
        .createSignedUrl(order.source_image_path!, 60 * 10)
      if (error || !data) {
        setError(error?.message ?? 'เปิดภาพไม่สำเร็จ')
        return
      }
      setSourceUrl(data.signedUrl)
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleOpen()}
        className={`no-print text-sm font-medium text-brand-600 hover:text-brand-700 ${className ?? ''}`}
      >
        ดูบิลเทียบกับภาพแชทต้นฉบับ →
      </button>
      {error && <p className="no-print text-xs text-red-600">{error}</p>}
      {open && (
        <Lightbox onClose={() => setOpen(false)}>
          <BillAndSource order={order} sourceUrl={sourceUrl} />
        </Lightbox>
      )}
    </>
  )
}
