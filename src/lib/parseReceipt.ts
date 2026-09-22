import type { DraftItem } from '@/types'

const SKIP_LINE = /^(รวม|ยอดรวม|ยอดสุทธิ|total|subtotal|sub[\s-]?total|vat|ภาษี|ส่วนลด|discount|เงินสด|cash|เงินทอน|เปลี่ยน|change|ขอบคุณ|thank|ที่อยู่|address|เบอร์|tel\.?|โทร|วันที่|date|เวลา|time|receipt|ใบเสร็จ|เลขที่|no\.\s*\d|คิวอาร์|qr|พนักงาน|cashier|โต๊ะ|table)/i

// A number that isn't glued to a unit suffix (500ml, 1kg, 250g) — those are
// part of the product name/size, not a price or quantity.
const NUMBER_TOKEN = /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?!\s?(?:ml|มล|g|kg|กก|กรัม|l|ลิตร|oz|%|"))/gi
const MULTIPLIER = /(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:[.,]\d+)?)/

/**
 * Turns raw OCR text from a product/order screenshot into editable line
 * items. This is a best-effort heuristic (receipts and chat screenshots
 * have no fixed layout) — every result is meant to be reviewed and
 * corrected by the user before the bill is saved.
 */
export function parseReceiptText(text: string): DraftItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1)

  const items: DraftItem[] = []

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue

    const item = parseLine(line)
    if (item) items.push(item)
  }

  return items
}

function parseLine(line: string): DraftItem | null {
  const multiplierMatch = line.match(MULTIPLIER)
  if (multiplierMatch) {
    const quantity = toNumber(multiplierMatch[1])
    const unitPrice = toNumber(multiplierMatch[2])
    const name = clean(line.replace(multiplierMatch[0], ' '))
    if (quantity > 0) return makeItem(name || line, quantity, unitPrice)
  }

  const numbers = [...line.matchAll(NUMBER_TOKEN)]
  if (numbers.length === 0) {
    // No price found at all — keep the name so the user can fill in the price manually.
    return makeItem(clean(line), 1, 0)
  }

  if (numbers.length === 1) {
    const [match] = numbers
    const price = toNumber(match[0])
    const name = clean(removeAt(line, match))
    return makeItem(name || line, 1, price)
  }

  // 3+ numbers: assume the receipt-style layout "qty  unit price  amount".
  if (numbers.length >= 3) {
    const [qtyMatch, priceMatch] = numbers
    const qty = looksLikeQuantity(qtyMatch[0]) ? toNumber(qtyMatch[0]) : 1
    const priceCandidate = looksLikeQuantity(qtyMatch[0]) ? priceMatch : qtyMatch
    const price = toNumber(priceCandidate[0])
    const name = clean(removeAt(removeAt(line, qtyMatch), priceMatch))
    return makeItem(name || line, qty, price)
  }

  // Exactly 2 numbers: either "qty  price" or "unit price  amount".
  const [first, second] = numbers
  if (looksLikeQuantity(first[0]) && !looksLikeQuantity(second[0])) {
    const qty = toNumber(first[0])
    const price = toNumber(second[0])
    const name = clean(removeAt(removeAt(line, first), second))
    return makeItem(name || line, qty, price)
  }

  // Otherwise treat the last number as the price (line total / amount).
  const price = toNumber(second[0])
  const name = clean(removeAt(removeAt(line, first), second))
  return makeItem(name || line, 1, price)
}

function looksLikeQuantity(raw: string): boolean {
  return /^\d{1,3}$/.test(raw) && Number(raw) > 0 && Number(raw) <= 999
}

function toNumber(raw: string): number {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function removeAt(line: string, match: RegExpMatchArray): string {
  if (match.index == null) return line
  return line.slice(0, match.index) + ' ' + line.slice(match.index + match[0].length)
}

function clean(name: string): string {
  return name
    .replace(/[฿]|บาท|ea\.?|pcs?\.?|ชิ้น|x\s*$/gi, ' ')
    .replace(/[-–—:|.]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[-–—:|,.\s]+|[-–—:|,.\s]+$/g, '')
}

function makeItem(name: string, quantity: number, unitPrice: number): DraftItem {
  return {
    id: crypto.randomUUID(),
    name: name || 'สินค้า',
    quantity: quantity > 0 ? quantity : 1,
    unit_price: unitPrice >= 0 ? unitPrice : 0,
  }
}
