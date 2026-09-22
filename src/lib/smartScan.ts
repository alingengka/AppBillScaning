import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { PaymentMethod } from '@/types'

export interface ComboOption {
  paid: number
  free: number
  total: number
}

export interface ExtractedOrder {
  customer_name: string | null
  customer_phone: string | null
  paid_qty: number | null
  free_qty: number | null
  total_amount: number | null
  payment_method: PaymentMethod | null
  note: string | null
}

/**
 * Sends a chat screenshot to the `smart-scan` Supabase Edge Function, which
 * asks Gemini to read the image and extract the order (customer name/phone,
 * chosen combo) as structured data — not just raw OCR text, since order
 * messages are informal and mix the chat contact's name with the message.
 */
export async function smartScanOrder(file: File, combos: ComboOption[]): Promise<ExtractedOrder> {
  const imageBase64 = await fileToBase64(file)

  const { data, error } = await supabase.functions.invoke<Partial<ExtractedOrder> & { error?: string }>(
    'smart-scan',
    { body: { imageBase64, mimeType: file.type || 'image/jpeg', combos } },
  )

  if (error) throw new Error(await extractFunctionErrorMessage(error))
  if (data?.error) throw new Error(data.error)

  return {
    customer_name: data?.customer_name ?? null,
    customer_phone: data?.customer_phone ?? null,
    paid_qty: data?.paid_qty ?? null,
    free_qty: data?.free_qty ?? null,
    total_amount: data?.total_amount ?? null,
    payment_method: data?.payment_method ?? null,
    note: data?.note ?? null,
  }
}

// supabase-js's FunctionsHttpError only carries a generic "non-2xx status
// code" message — the actual { error: "..." } body our function returns is
// on error.context (the raw Response) and has to be read separately.
async function extractFunctionErrorMessage(error: Error): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (typeof body?.error === 'string') return body.error
    } catch {
      // fall through to the generic message below
    }
  }
  return error.message || 'เรียกใช้บริการอ่านภาพไม่สำเร็จ'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip the "data:<mime>;base64," prefix
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}
