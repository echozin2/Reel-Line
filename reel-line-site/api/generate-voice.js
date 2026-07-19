// Vercel serverless function. Calls OpenAI's text-to-speech API server-side
// so the key never reaches the browser. Reuses OPENAI_API_KEY — no new
// account needed if you already set that up for image generation.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing OPENAI_API_KEY. Add it in your Vercel project settings." });
  }

  const { text, voice, instructions } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "Missing text." });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: voice || "onyx",
        input: text,
        ...(instructions ? { instructions } : {}),
        response_format: "mp3",
      }),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: errData?.error?.message || "OpenAI TTS error" });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
