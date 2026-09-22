import { supabase } from '@/lib/supabase'

/**
 * OCR.space language codes we expose in the UI. Lao ('lao') is not on
 * OCR.space's confirmed-supported list — it's offered because most of this
 * shop's customers write in Lao, but results may be poor or the API may
 * reject it; the scanned items table is always editable as a fallback.
 */
export const OCR_LANGUAGES = [
  { code: 'lao', label: 'ລາວ (Lao)' },
  { code: 'tha', label: 'ไทย (Thai)' },
  { code: 'eng', label: 'English' },
] as const

export type OcrLanguage = (typeof OCR_LANGUAGES)[number]['code']

/**
 * Sends an image to the `ocr-scan` Supabase Edge Function, which proxies it
 * to the OCR.space cloud OCR API (keeping the provider API key server-side).
 */
export async function scanImageForText(file: File, language: OcrLanguage = 'lao'): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('กรุณาเข้าสู่ระบบก่อนสแกนภาพ')

  const imageBase64 = await fileToBase64(file)

  const { data, error } = await supabase.functions.invoke<{ text?: string; error?: string }>('ocr-scan', {
    body: { imageBase64, mimeType: file.type || 'image/jpeg', language },
  })

  if (error) throw new Error(error.message || 'เรียกใช้บริการ OCR ไม่สำเร็จ')
  if (data?.error) throw new Error(data.error)
  return data?.text ?? ''
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
