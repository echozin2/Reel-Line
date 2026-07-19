// Vercel serverless function. Keeps the Anthropic API key on the server —
// it is never sent to the browser. Set ANTHROPIC_API_KEY in your Vercel
// project's Environment Variables (see README.md).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Add it in your Vercel project settings." });
  }

  const { system, prompt, maxTokens } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt." });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: maxTokens || 2000,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || "Anthropic API error", detail: data });
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
