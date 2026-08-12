# Bapsang · 밥상

Bapsang turns a photo of a Korean dish into a practical home recipe. It identifies the dish in Korean and English, provides ingredients and method, suggests accessible substitutions, and keeps saved recipes in the browser.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and add an [OpenCode API key](https://opencode.ai/auth):

   ```env
   OPENCODE_API_KEY=your_opencode_api_key
   OPENCODE_MODEL=mimo-v2.5-free
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

- The OpenCode API key stays on the server and is never included in the browser bundle.
- Photos are resized in the browser before analysis.
- Photos are analyzed by OpenCode's free MiMo V2.5 model. OpenCode states that data submitted to this limited-time free model may be used to improve the model, so do not submit personal or confidential images.
- Saved recipes and their photos live only in browser `localStorage`.
- There is no account system or database.

AI-generated recipes should be checked for allergies and safe cooking temperatures.
