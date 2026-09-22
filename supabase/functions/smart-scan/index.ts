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

const PROMPT = `You are reading a screenshot of a chat conversation (Facebook Messenger, Line, WhatsApp, etc.) for a coffee shop in Laos that sells combo deals. The customer's message about the order may mix Lao and Thai script, contain typos, and be informal.

The shop's available combo deals (paid bags + free bags = total price in Lao Kip) are listed below. Match the customer's chosen combo to one of these exactly if possible:
{{COMBOS}}

Extract the order details from the image and return ONLY a JSON object (no markdown, no explanation) with this shape:
{
  "customer_name": string or null,   // prefer a name given in the order message itself; fall back to the chat contact's display name shown at the top of the screenshot
  "customer_phone": string or null,  // digits only, no spaces or dashes
  "paid_qty": number or null,        // paid bags in the chosen combo
  "free_qty": number or null,        // free bags in the chosen combo
  "total_amount": number or null,    // total price in Kip for the chosen combo
  "note": string or null             // anything else worth flagging, e.g. "cash on delivery" / destination mentioned in the message, in Thai
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

    const geminiResponse = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
              note: { type: 'STRING', nullable: true },
            },
          },
        },
      }),
    })

    const geminiResult = await geminiResponse.json()

    if (!geminiResponse.ok) {
      return json({ error: geminiResult.error?.message ?? 'AI provider request failed' }, 502)
    }

    const text: string | undefined = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text
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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
