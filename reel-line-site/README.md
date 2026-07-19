# Reel Line

A standalone web app for the faceless AI-fitness content pipeline: niche →
title/thumbnail concepts → script → AI visual prompts → voiceover direction →
thumbnail brief.

This version runs on your own hosting, so it isn't dependent on Claude.ai's
artifact runtime. Claude calls happen through a small serverless function
(`api/generate.js`) that keeps your API key on the server, never in the
browser.

## 1. Get an Anthropic API key

1. Go to https://console.anthropic.com
2. Create an API key under **API Keys**
3. You'll need a small amount of credit on the account (this app's calls are
   short — a few cents covers a lot of testing)

## 2. Deploy to Vercel (easiest path)

1. Push this folder to a GitHub repo
2. Go to https://vercel.com, **Add New → Project**, import that repo
3. Vercel will auto-detect it as a Vite app — leave the defaults
4. Before deploying, add an environment variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** the key from step 1
5. Click **Deploy**

That's it — Vercel builds the frontend and deploys `api/generate.js` as a
serverless function automatically. Your live URL will look like
`https://reel-line-yourname.vercel.app`.

## 3. Local development

```bash
npm install
npm i -g vercel        # one-time
vercel dev              # runs both the frontend and the /api function together
```

`vercel dev` will ask you to link the project and pull your env vars the
first time. If you'd rather not install the Vercel CLI, you can run
`npm run dev` for the frontend only, but the Claude-powered buttons won't
work locally without something serving `/api/generate` — `vercel dev` is the
simplest way to get both running together.

## Notes

- **ElevenLabs (voiceover)** is optional and entirely client-side — you paste
  your own ElevenLabs API key into the app itself (Stage 4), and it's used
  only in your browser tab to call ElevenLabs directly. It's never sent to
  our server or stored anywhere.
- **Whisk** (Google's AI image tool) has no public API, so Stage 3 produces
  copy-paste-ready prompts rather than generating images directly.
- To change the Claude model, edit the `model` field in `api/generate.js`.
