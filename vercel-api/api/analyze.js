const OPENCODE_API_KEY = 'sk-Q18dVHx6ifgkeWny29sLfMMnOfNiOZZrDBrPEHm8E7UJx9KxtbCOpgX6Z8Hz8ctY'
const ALLOWED_ORIGIN = 'https://maxwarren929-png.github.io'

const prompt = `This image shows a Korean dish. Identify its name in Korean and English. List its likely main ingredients. Then generate a simplified home-cookable recipe with steps, assuming the cook may not have access to specialty Korean ingredients — suggest substitutes where relevant. Respond ONLY with valid JSON in this exact shape: { "name_kr": "", "name_en": "", "ingredients": [], "steps": [], "notes": "" }. No preamble, no markdown fences, just the JSON object. /no_think`

const recipeSchema = {
  type: 'OBJECT',
  properties: {
    name_kr: { type: 'STRING' },
    name_en: { type: 'STRING' },
    ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
    notes: { type: 'STRING' },
  },
  required: ['name_kr', 'name_en', 'ingredients', 'steps', 'notes'],
}

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
  const recipe = JSON.parse(cleaned.slice(start, end + 1))
  if (!isRecipe(recipe)) throw new Error('Unexpected recipe shape')
  return recipe
}

const requestMimo = async (image) => {
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
  if (!response.ok) throw new Error(`MiMo request failed with ${response.status}`)

  const rawContent = completion?.choices?.[0]?.message?.content
  const outputText = typeof rawContent === 'string'
    ? rawContent
    : Array.isArray(rawContent)
      ? rawContent.map((part) => part?.text || '').join('')
      : ''
  return parseRecipe(outputText)
}

const requestGemini = async (image) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini is not configured')
  const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/s)
  if (!match) throw new Error('Invalid image data')

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: match[1], data: match[2] } },
          { text: prompt.replace(' /no_think', '') },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
        responseSchema: recipeSchema,
      },
    }),
  })

  const completion = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Gemini request failed with ${response.status}`)
  const outputText = completion?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('') || ''
  return parseRecipe(outputText)
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
      return json(await requestMimo(image), 200, headers)
    } catch (error) {
      console.error('Primary scanner failed:', error instanceof Error ? error.message : 'Unknown error')
    }

    try {
      return json(await requestGemini(image), 200, headers)
    } catch (error) {
      console.error('Backup scanner failed:', error instanceof Error ? error.message : 'Unknown error')
      return json({ error: 'Could not scan this dish. Please try again.' }, 502, headers)
    }
  },
}
