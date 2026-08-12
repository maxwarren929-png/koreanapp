# Bapsang · 밥상

Bapsang turns a photo of a Korean dish into a practical home recipe. It identifies the dish in Korean and English, provides ingredients and method, suggests accessible substitutions, and keeps saved recipes in the browser.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and add an OpenAI API key:

   ```env
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4o-mini
   ```

3. Start the web app and API proxy:

   ```bash
   npm run dev
   ```

Open [http://localhost:5173](http://localhost:5173).

## Production

```bash
npm run build
npm start
```

The production server uses `PORT` when set and otherwise listens on port `8787`.

## Data and privacy

- The OpenAI API key stays on the server and is never included in the browser bundle.
- Photos are resized in the browser before analysis.
- Saved recipes and their photos live only in browser `localStorage`.
- There is no account system or database.

AI-generated recipes should be checked for allergies and safe cooking temperatures.
