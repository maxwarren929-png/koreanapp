const prompt = `This image shows a Korean dish. Identify its name in Korean and English. List its likely main ingredients. Then generate a simplified home-cookable recipe with steps, assuming the cook may not have access to specialty Korean ingredients — suggest substitutes where relevant. Respond ONLY with valid JSON in this exact shape: { "name_kr": "", "name_en": "", "ingredients": [], "steps": [], "notes": "" }. No preamble, no markdown fences, just the JSON object. /no_think`
const OPENCODE_API_KEY = 'sk-Q18dVHx6ifgkeWny29sLfMMnOfNiOZZrDBrPEHm8E7UJx9KxtbCOpgX6Z8Hz8ctY'

const stripCodeFences = (value) => value
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim()

const parseRecipe = (value) => {
  const cleaned = stripCodeFences(value)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object returned')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const requestRecipe = async (image) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
    if (response.status !== 429 || attempt === 1) return { response, completion }

    const retryAfter = Number(response.headers.get('Retry-After'))
    const delay = Number.isFinite(retryAfter) ? Math.min(Math.max(retryAfter * 1000, 500), 2000) : 500
    await wait(delay)
  }
}

const isRecipe = (value) => {
  if (!value || typeof value !== 'object') return false
  return typeof value.name_kr === 'string'
    && typeof value.name_en === 'string'
    && Array.isArray(value.ingredients)
    && value.ingredients.every((item) => typeof item === 'string')
    && Array.isArray(value.steps)
    && value.steps.every((item) => typeof item === 'string')
    && typeof value.notes === 'string'
}

const json = (body, status, corsHeaders) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
})

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    const isAllowed = origin === env.ALLOWED_ORIGIN || isLocal
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    }

    if (request.method === 'OPTIONS') {
      return isAllowed
        ? new Response(null, { status: 204, headers: corsHeaders })
        : json({ error: 'Origin not allowed.' }, 403, corsHeaders)
    }

    const url = new URL(request.url)
    if (url.pathname !== '/api/analyze' || request.method !== 'POST') {
      return json({ error: 'Not found.' }, 404, corsHeaders)
    }

    if (!isAllowed) return json({ error: 'Origin not allowed.' }, 403, corsHeaders)
    let image
    try {
      const body = await request.json()
      image = body?.image
    } catch {
      return json({ error: 'The request was not valid JSON.' }, 400, corsHeaders)
    }

    if (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 16 * 1024 * 1024) {
      return json({ error: 'Please choose a valid image under 16 MB and try again.' }, 400, corsHeaders)
    }

    try {
      const { response, completion } = await requestRecipe(image)
      if (!response.ok) {
        const providerMessage = completion?.error?.message || 'Unknown error'
        console.error('OpenCode request failed:', response.status, providerMessage)
        if (response.status === 429) {
          return json({ error: 'MiMo is busy right now. Wait a few seconds, then try again.' }, 429, corsHeaders)
        }
        if (response.status === 401 || response.status === 403) {
          return json({ error: 'The MiMo API key was not accepted.' }, 502, corsHeaders)
        }
        return json({ error: 'OpenCode could not read this dish right now. Please try again shortly.' }, 502, corsHeaders)
      }

      try {
        const rawContent = completion?.choices?.[0]?.message?.content
        const outputText = typeof rawContent === 'string'
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent.map((part) => part?.text || '').join('')
            : ''
        const recipe = parseRecipe(outputText)
        if (!isRecipe(recipe)) throw new Error('Unexpected recipe shape')
        return json(recipe, 200, corsHeaders)
      } catch {
        return json({ error: 'We found the dish, but could not format its recipe. Please try the photo again.' }, 502, corsHeaders)
      }
    } catch (error) {
      console.error('Recipe analysis failed:', error instanceof Error ? error.message : 'Unknown error')
      return json({ error: 'We could not read this dish right now. Please try again.' }, 502, corsHeaders)
    }
  },
}
