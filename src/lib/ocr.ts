import { createWorker } from 'tesseract.js'

/**
 * Tesseract.js language codes offered in the UI. OCR runs fully client-side
 * (no API key, no usage cap) — see scanImageForText.
 */
export const OCR_LANGUAGES = [
  { code: 'lao', label: 'ລາວ (Lao)' },
  { code: 'tha', label: 'ไทย (Thai)' },
  { code: 'eng', label: 'English' },
] as const

export type OcrLanguage = (typeof OCR_LANGUAGES)[number]['code']

/**
 * Runs OCR entirely in the browser via Tesseract.js — free and unlimited,
 * unlike a cloud OCR API. The language's trained-data file (a few MB)
 * downloads from a CDN on first use and is cached by the browser after that,
 * so later scans in the same language are faster and work offline.
 */
export async function scanImageForText(
  file: File,
  language: OcrLanguage = 'lao',
  onProgress?: (progress: number) => void,
): Promise<string> {
  const worker = await createWorker(language, undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(m.progress)
      }
    },
  })

  try {
    const {
      data: { text },
    } = await worker.recognize(file)
    return text
  } finally {
    await worker.terminate()
  }
}
