const OPENCODE_API_KEY = 'sk-Q18dVHx6ifgkeWny29sLfMMnOfNiOZZrDBrPEHm8E7UJx9KxtbCOpgX6Z8Hz8ctY'
const ALLOWED_ORIGIN = 'https://maxwarren929-png.github.io'

const prompt = `This image shows a Korean dish. Identify its name in Korean and English. List its likely main ingredients. Then generate a simplified home-cookable recipe with steps, assuming the cook may not have access to specialty Korean ingredients — suggest substitutes where relevant. Respond ONLY with valid JSON in this exact shape: { "name_kr": "", "name_en": "", "ingredients": [], "steps": [], "notes": "" }. No preamble, no markdown fences, just the JSON object. /no_think`

const isRecipe = (value) => value
  && typeof value === 'object'
  && typeof value.name_kr === 'string'
  && typeof value.name_en === 'string'
  && Array.isArray(value.ingredients)
  && value.ingredients.every((item) => typeof item === 'string')
  && Array.isArray(value.steps)
  && value.steps.every((item) => typeof item === 'string')
  && typeof value.notes === 'string'

const parseRecipe = (value) => {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object returned')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

const json = (body, status, headers) => Response.json(body, {
  status,
  headers: { ...headers, 'Cache-Control': 'no-store' },
})

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || ''
    const headers = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return origin === ALLOWED_ORIGIN
        ? new Response(null, { status: 204, headers })
        : json({ error: 'Origin not allowed.' }, 403, headers)
    }

    if (request.method !== 'POST') return json({ error: 'Not found.' }, 404, headers)
    if (origin !== ALLOWED_ORIGIN) return json({ error: 'Origin not allowed.' }, 403, headers)

    let image
    try {
      image = (await request.json())?.image
    } catch {
      return json({ error: 'The request was not valid JSON.' }, 400, headers)
    }

    if (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 4 * 1024 * 1024) {
      return json({ error: 'Please take a new photo and try again.' }, 400, headers)
    }

    try {
      const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENCODE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mimo-v2.5-free',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: image } },
              { type: 'text', text: prompt },
            ],
          }],
          temperature: 0.2,
          max_tokens: 4000,
        }),
      })

      const completion = await response.json().catch(() => null)
      if (!response.ok) {
        if (response.status === 429) {
          return json({ error: 'MiMo is busy right now. Wait a few seconds, then try again.' }, 429, headers)
        }
        if (response.status === 401 || response.status === 403) {
          return json({ error: 'The MiMo API key was not accepted.' }, 502, headers)
        }
        return json({ error: 'MiMo could not read this dish right now.' }, 502, headers)
      }

      const rawContent = completion?.choices?.[0]?.message?.content
      const outputText = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((part) => part?.text || '').join('')
          : ''
      const recipe = parseRecipe(outputText)
      if (!isRecipe(recipe)) throw new Error('Unexpected recipe shape')
      return json(recipe, 200, headers)
    } catch (error) {
      console.error('Recipe analysis failed:', error instanceof Error ? error.message : 'Unknown error')
      return json({ error: 'Could not scan this dish. Please try again.' }, 502, headers)
    }
  },
}
