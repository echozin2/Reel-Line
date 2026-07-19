// Vercel serverless function. Calls OpenAI's image API server-side so the
// key never reaches the browser. Set OPENAI_API_KEY in your Vercel
// project's Environment Variables (same place as ANTHROPIC_API_KEY).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing OPENAI_API_KEY. Add it in your Vercel project settings." });
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt." });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1-mini",
        prompt,
        size: "1024x1024",
        quality: "low", // cheap + fast — fine for testing, bump to "medium"/"high" later
        n: 1,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || "OpenAI image API error", detail: data });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({ error: "No image returned from OpenAI." });
    }

    return res.status(200).json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
