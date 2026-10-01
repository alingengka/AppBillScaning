// Supabase Edge Function: smart-scan
//
// Reads a screenshot of a chat order (Facebook Messenger, Line, etc.) and
// asks Gemini to extract the customer's name/phone and which combo deal
// they ordered — not just raw OCR text, since order messages are informal,
// mix the contact's display name with the message body, and often have
// typos. Deploy with:
//   supabase functions deploy smart-scan
//   supabase secrets set GEMINI_API_KEY=your-key-here
//
// Get a free key (no credit card required) at https://aistudio.google.com/apikey
//
// No external imports on purpose: the Supabase CLI's bundler resolves every
// remote specifier at deploy time, which fails in sandboxes with flaky
// outbound DNS. Auth is checked with a plain fetch to the Auth REST API
// instead of pulling in the supabase-js SDK.

const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScanRequestBody {
  imageBase64: string // raw base64, no data: prefix required
  mimeType?: string
  combos: { paid: number; free: number; total: number }[]
}

const PROMPT = `You are reading a screenshot of a chat conversation (Facebook Messenger, Line, WhatsApp, etc.) for a coffee shop in Laos that sells combo deals. The customer writes in Lao (sometimes mixed with Thai), informally and possibly with typos.

The shop's available combo deals (paid bags + free bags = total price in Lao Kip) are listed below. Match the customer's chosen combo to one of these exactly if possible:
{{COMBOS}}

LANGUAGE RULES — very important:
- Copy Lao text exactly as written, character by character, including every vowel, tone mark (່ ້ ໊ ໋) and consonant. Read slowly and carefully; do not guess or "correct" spellings.
- Never translate, and never write Lao words with Thai letters (e.g. write ບ້ານ, never บ้าน). Use only Lao Unicode characters (U+0E80–U+0EFF) for Lao words.
- Keep Latin text, numbers and Thai text exactly as they appear.

ADDRESS RULES — very important:
- Put the customer's delivery address in "destination", never in "note".
- The address is everything describing where to send the parcel: village (ບ້ານ), district (ເມືອງ), province (ແຂວງ) or capital (ນະຄອນຫຼວງ), street or landmark, and the shipping/transport company and branch (e.g. ອານຸສິດ, ຮຸ່ງອາລຸນ, HAL, ມີໄຊ, ສາຂາ ...).
- Join a multi-line address into one line separated by ", ", in the order the customer wrote it.
- "note" is ONLY for other instructions that are not part of the address (e.g. ໂທກ່ອນສົ່ງ "call before delivery"). If there is nothing else, note must be null.

Extract the order details from the image and return ONLY a JSON object (no markdown, no explanation) with this shape:
{
  "customer_name": string or null,   // prefer a name given in the order message itself; fall back to the chat contact's display name shown at the top of the screenshot
  "customer_phone": string or null,  // digits only, no spaces or dashes
  "paid_qty": number or null,        // paid bags in the chosen combo
  "free_qty": number or null,        // free bags in the chosen combo
  "total_amount": number or null,    // total price in Kip for the chosen combo
  "payment_method": "cod" | "destination" | "origin" or null,  // "cod" if the message says cash on delivery / ເກັບເງິນປາຍທາງ COD; "destination" if it says pay at the destination (ປາຍທາງ); "origin" if it says pay at origin / already paid (ຕົ້ນທາງ, ໂອນແລ້ວ); null if not mentioned
  "destination": string or null,     // the full delivery address, see ADDRESS RULES
  "note": string or null             // other instructions only, never the address
}
If the image contains no readable order, return all fields as null.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const userResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
    })
    if (!userResponse.ok) {
      return json({ error: 'Invalid or expired session' }, 401)
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return json({ error: 'AI provider is not configured (missing GEMINI_API_KEY secret)' }, 500)
    }

    const body = (await req.json()) as Partial<ScanRequestBody>
    if (!body.imageBase64) {
      return json({ error: 'imageBase64 is required' }, 400)
    }

    const mimeType = body.mimeType ?? 'image/jpeg'
    const combosText = (body.combos ?? [])
      .map((c) => `- ${c.paid} paid + ${c.free} free = ${c.total} Kip`)
      .join('\n')
    const prompt = PROMPT.replace('{{COMBOS}}', combosText || '(none listed)')

    const request = {
      contents: [
        {
          parts: [{ text: prompt }, { inlineData: { mimeType, data: body.imageBase64 } }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            customer_name: { type: 'STRING', nullable: true },
            customer_phone: { type: 'STRING', nullable: true },
            paid_qty: { type: 'NUMBER', nullable: true },
            free_qty: { type: 'NUMBER', nullable: true },
            total_amount: { type: 'NUMBER', nullable: true },
            payment_method: { type: 'STRING', enum: ['cod', 'destination', 'origin'], nullable: true },
            destination: {
              type: 'STRING',
              nullable: true,
              description: 'Full delivery address in Lao script: village, district, province, shipping company/branch',
            },
            note: {
              type: 'STRING',
              nullable: true,
              description: 'Other instructions that are not part of the address; null if none',
            },
          },
          propertyOrdering: [
            'customer_name',
            'customer_phone',
            'paid_qty',
            'free_qty',
            'total_amount',
            'payment_method',
            'destination',
            'note',
          ],
        },
      },
    }

    const { response: geminiResponse, result: geminiResult } = await callGemini(apiKey, request)

    if (!geminiResponse.ok) {
      return json({ error: geminiResult.error?.message ?? 'AI provider request failed' }, 502)
    }

    // Skip any thought-summary parts and take the actual answer.
    const parts: { text?: string; thought?: boolean }[] = geminiResult.candidates?.[0]?.content?.parts ?? []
    const text = parts.find((part) => part.text && !part.thought)?.text
    if (!text) {
      return json({ error: 'AI provider returned no result' }, 502)
    }

    let extracted: unknown
    try {
      extracted = JSON.parse(text)
    } catch {
      return json({ error: 'AI provider returned an unreadable result' }, 502)
    }

    return json(extracted)
  } catch (err) {
    console.error('[smart-scan] unexpected error', err)
    return json({ error: 'Unexpected server error' }, 500)
  }
})

// Gemini models think before answering by default; for reading a chat
// screenshot that mostly adds latency, so ask for minimal thinking.
const FAST_THINKING = { thinkingConfig: { thinkingLevel: 'low' } }

/**
 * Calls Gemini fast (low thinking), retrying once without the thinking
 * setting if the model rejects it, and once more after a short pause if
 * Gemini is overloaded (429/503 "high demand").
 */
async function callGemini(apiKey: string, request: { generationConfig: Record<string, unknown> }) {
  let withThinking = true
  let retriedBusy = false
  for (;;) {
    const payload = withThinking
      ? { ...request, generationConfig: { ...request.generationConfig, ...FAST_THINKING } }
      : request
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json()

    if (response.status === 400 && withThinking && /thinking/i.test(result.error?.message ?? '')) {
      withThinking = false
      continue
    }
    if ((response.status === 429 || response.status === 503) && !retriedBusy) {
      retriedBusy = true
      await new Promise((resolve) => setTimeout(resolve, 2000))
      continue
    }
    return { response, result }
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
