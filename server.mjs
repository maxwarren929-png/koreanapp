import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 8787)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(express.json({ limit: '16mb' }))

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

  if (!process.env.OPENCODE_API_KEY) {
    return res.status(503).json({ error: 'The recipe service is not configured yet. Add OPENCODE_API_KEY to your environment.' })
  }

  try {
    const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENCODE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENCODE_MODEL || 'mimo-v2.5-free',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } },
          ],
        }],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    })

    const completion = await response.json().catch(() => null)
    if (!response.ok) {
      const providerMessage = completion?.error?.message
      console.error('OpenCode request failed:', response.status, providerMessage || 'Unknown provider error')
      if (response.status === 401 || response.status === 403) {
        return res.status(502).json({ error: 'The OpenCode API key was not accepted. Check OPENCODE_API_KEY and try again.' })
      }
      return res.status(502).json({ error: 'OpenCode could not read this dish right now. Please try again shortly.' })
    }

    try {
      const rawContent = completion?.choices?.[0]?.message?.content
      const outputText = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((part) => part?.text || '').join('')
          : ''
      const recipe = JSON.parse(stripCodeFences(outputText))
      if (!isRecipe(recipe)) throw new Error('Unexpected recipe shape')
      return res.json(recipe)
    } catch {
      return res.status(502).json({ error: 'We found the dish, but could not format its recipe. Please try the photo again.' })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.error('OpenCode recipe analysis failed:', message)
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
