# Deployment

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

## Deploy the frontend to GitHub Pages

The repository includes a GitHub Actions workflow that builds and deploys the frontend to:

`https://maxwarren929-png.github.io/koreanapp/`

GitHub Pages is static hosting, so it cannot run the API proxy or safely store the OpenCode key. The included Cloudflare Worker provides that private API layer.

### 1. Deploy the API Worker

Create a Cloudflare account, then run:

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put OPENCODE_API_KEY
npm run deploy
```

Paste your OpenCode key only when Wrangler asks for it. The command prints a Worker URL similar to:

`https://bapsang-api.<your-subdomain>.workers.dev`

### 2. Connect GitHub Pages to the Worker

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables**, then create:

```text
Name: VITE_API_URL
Value: https://bapsang-api.<your-subdomain>.workers.dev
```

Do not add `OPENCODE_API_KEY` to the Pages workflow. After setting `VITE_API_URL`, run the **Deploy to GitHub Pages** workflow or push a commit to `main`.

In **Settings → Pages**, select **GitHub Actions** as the source if GitHub has not selected it automatically.

## Other production hosting

The bundled Express server can also serve the full application on a Node host:

```bash
npm run build
npm start
```

The production server uses `PORT` when set and otherwise listens on port `8787`.

## Data and privacy

- The OpenCode API key stays on the server and is never included in the browser bundle.
- GitHub Pages receives only the public Worker URL through `VITE_API_URL`.
- Photos are resized in the browser before analysis.
- Photos are analyzed by OpenCode's free MiMo V2.5 model. OpenCode states that data submitted to this limited-time free model may be used to improve the model, so do not submit personal or confidential images.
- Saved recipes and their photos live only in browser `localStorage`.
- There is no account system or database.

AI-generated recipes should be checked for allergies and safe cooking temperatures.
