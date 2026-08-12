import 'dotenv/config'
import express from 'express'
import OpenAI from 'openai'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 8787)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(express.json({ limit: '16mb' }))

const recipeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name_kr: { type: 'string' },
    name_en: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['name_kr', 'name_en', 'ingredients', 'steps', 'notes'],
}

const prompt = `This image shows a Korean dish. Identify its name in Korean and English. List its likely main ingredients. Then generate a simplified home-cookable recipe with steps, assuming the cook may not have access to specialty Korean ingredients — suggest substitutes where relevant. Respond ONLY with valid JSON in this exact shape: { "name_kr": "", "name_en": "", "ingredients": [], "steps": [], "notes": "" }. No preamble, no markdown fences, just the JSON object.`

const stripCodeFences = (value) => value
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim()

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

app.post('/api/analyze', async (req, res) => {
  const image = req.body?.image
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Please choose a valid image and try again.' })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'The recipe service is not configured yet. Add OPENAI_API_KEY to your environment.' })
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: image, detail: 'auto' },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'korean_recipe',
          strict: true,
          schema: recipeSchema,
        },
      },
    })

    try {
      const recipe = JSON.parse(stripCodeFences(response.output_text))
      if (!isRecipe(recipe)) throw new Error('Unexpected recipe shape')
      return res.json(recipe)
    } catch {
      return res.status(502).json({ error: 'We found the dish, but could not format its recipe. Please try the photo again.' })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.error('Recipe analysis failed:', message)
    return res.status(502).json({ error: 'We could not read this dish right now. Please check your connection and try again.' })
  }
})

app.use(express.static(path.join(__dirname, 'dist')))
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

const host = process.env.HOST || '0.0.0.0'
app.listen(port, host, () => {
  console.log(`Bapsang server listening on http://${host}:${port}`)
})
