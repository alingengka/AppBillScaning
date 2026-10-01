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
  destination: string | null
  note: string | null
}

/**
 * Sends a chat screenshot to the `smart-scan` Supabase Edge Function, which
 * asks Gemini to read the image and extract the order (customer name/phone,
 * chosen combo) as structured data — not just raw OCR text, since order
 * messages are informal and mix the chat contact's name with the message.
 */
export async function smartScanOrder(file: File, combos: ComboOption[]): Promise<ExtractedOrder> {
  const { base64: imageBase64, mimeType } = await prepareImageForScan(file)

  const { data, error } = await supabase.functions.invoke<Partial<ExtractedOrder> & { error?: string }>(
    'smart-scan',
    { body: { imageBase64, mimeType, combos } },
  )

  if (error) throw new Error(await extractFunctionErrorMessage(error))
  if (data?.error) throw new Error(data.error)

  return moveAddressOutOfNote({
    customer_name: data?.customer_name ?? null,
    customer_phone: data?.customer_phone ?? null,
    paid_qty: data?.paid_qty ?? null,
    free_qty: data?.free_qty ?? null,
    total_amount: data?.total_amount ?? null,
    payment_method: data?.payment_method ?? null,
    destination: data?.destination ?? null,
    note: data?.note ?? null,
  })
}

// Words that only show up in a Lao delivery address: village, district,
// province, capital, branch, and the common parcel/transport companies.
const LAO_ADDRESS_HINT = /ບ້ານ|ເມືອງ|ແຂວງ|ນະຄອນຫຼວງ|ນະຄອນຫລວງ|ສາຂາ|ອານຸສິດ|ຮຸ່ງອາລຸນ|ມີໄຊ|\bHAL\b/i

/**
 * Safety net for when the AI still puts the address in `note` instead of
 * `destination`: if there's no destination but the note reads like an
 * address, move it over so it prints on the bill's address line.
 */
function moveAddressOutOfNote(order: ExtractedOrder): ExtractedOrder {
  if (order.destination || !order.note || !LAO_ADDRESS_HINT.test(order.note)) return order
  return { ...order, destination: order.note, note: null }
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

// Longest side, in pixels, of the image sent to the AI. Phone screenshots are
// often 2500px+ PNGs of several MB; the model downsamples them anyway, so
// shrinking first makes the upload much faster without losing readable text.
const SCAN_MAX_SIDE = 2000
const SCAN_JPEG_QUALITY = 0.9

async function prepareImageForScan(file: File): Promise<{ base64: string; mimeType: string }> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, SCAN_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    // JPEG has no transparency; paint white so transparent PNGs don't turn black.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const dataUrl = canvas.toDataURL('image/jpeg', SCAN_JPEG_QUALITY)
    return { base64: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' }
  } catch {
    // Formats the browser can't decode (e.g. HEIC on some devices): send as-is.
    return { base64: await fileToBase64(file), mimeType: file.type || 'image/jpeg' }
  }
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
