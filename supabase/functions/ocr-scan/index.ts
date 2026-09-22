// Supabase Edge Function: ocr-scan
//
// Proxies an uploaded product/receipt screenshot to the Google Cloud Vision
// API so the provider's API key never reaches the browser. Deploy with:
//   supabase functions deploy ocr-scan
//   supabase secrets set GOOGLE_VISION_API_KEY=your-key-here
//
// Create a key at https://console.cloud.google.com/apis/credentials after
// enabling the Cloud Vision API on the project (restrict the key to that API).
// Google Cloud Vision is used instead of OCR.space because it supports Lao
// ("lo") language hints, which OCR.space's language list does not include.
//
// No external imports on purpose: the Supabase CLI's bundler resolves every
// remote specifier at deploy time, which fails in sandboxes with flaky
// outbound DNS. Auth is checked with a plain fetch to the Auth REST API
// instead of pulling in the supabase-js SDK.

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScanRequestBody {
  imageBase64: string // raw base64, no data: prefix required
  mimeType?: string
  language?: string // BCP-47 language hint for Vision, e.g. "lo", "th", "en"
}

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

    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
    if (!apiKey) {
      return json({ error: 'OCR provider is not configured (missing GOOGLE_VISION_API_KEY secret)' }, 500)
    }

    const body = (await req.json()) as Partial<ScanRequestBody>
    if (!body.imageBase64) {
      return json({ error: 'imageBase64 is required' }, 400)
    }

    const language = body.language ?? 'lo'

    const visionResponse = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: body.imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: [language] },
          },
        ],
      }),
    })

    const visionResult = await visionResponse.json()
    const result = visionResult.responses?.[0]

    if (result?.error) {
      return json({ error: result.error.message ?? 'OCR provider failed to process the image' }, 502)
    }
    if (!visionResponse.ok) {
      return json({ error: visionResult.error?.message ?? 'OCR provider request failed' }, 502)
    }

    const text: string = result?.fullTextAnnotation?.text ?? ''

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
