// Supabase Edge Function: ocr-scan
//
// Proxies an uploaded product/receipt screenshot to the OCR.space cloud OCR
// API so the OCR provider's secret key never reaches the browser. Deploy with:
//   supabase functions deploy ocr-scan
//   supabase secrets set OCR_SPACE_API_KEY=your-key-here
//
// Get a free key at https://ocr.space/ocrapi (free tier: 25,000 requests/month).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScanRequestBody {
  imageBase64: string // raw base64, no data: prefix required
  mimeType?: string
  language?: string // OCR.space language code, e.g. "tha", "eng"
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    // Require a logged-in Supabase user (JWT is verified automatically when
    // verify_jwt is left enabled in supabase/functions/ocr-scan/config? we
    // double check here for clarity and to fetch the user id for logging).
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Invalid or expired session' }, 401)
    }

    const apiKey = Deno.env.get('OCR_SPACE_API_KEY')
    if (!apiKey) {
      return json({ error: 'OCR provider is not configured (missing OCR_SPACE_API_KEY secret)' }, 500)
    }

    const body = (await req.json()) as Partial<ScanRequestBody>
    if (!body.imageBase64) {
      return json({ error: 'imageBase64 is required' }, 400)
    }

    const mimeType = body.mimeType ?? 'image/jpeg'
    const language = body.language ?? 'tha'

    const form = new FormData()
    form.append('base64Image', `data:${mimeType};base64,${body.imageBase64}`)
    form.append('language', language)
    form.append('isTable', 'true')
    form.append('scale', 'true')
    form.append('OCREngine', '2')

    const ocrResponse = await fetch(OCR_SPACE_ENDPOINT, {
      method: 'POST',
      headers: { apikey: apiKey },
      body: form,
    })

    const ocrResult = await ocrResponse.json()

    if (ocrResult.IsErroredOnProcessing) {
      const message = Array.isArray(ocrResult.ErrorMessage)
        ? ocrResult.ErrorMessage.join(', ')
        : (ocrResult.ErrorMessage ?? 'OCR provider failed to process the image')
      return json({ error: message }, 502)
    }

    const text: string = (ocrResult.ParsedResults ?? [])
      .map((r: { ParsedText?: string }) => r.ParsedText ?? '')
      .join('\n')

    return json({ text })
  } catch (err) {
    console.error('[ocr-scan] unexpected error', err)
    return json({ error: 'Unexpected server error' }, 500)
  }
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
