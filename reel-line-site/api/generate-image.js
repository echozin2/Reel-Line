// Vercel serverless function. Calls OpenAI's image API server-side so the
// key never reaches the browser. Set OPENAI_API_KEY in your Vercel
// project's Environment Variables (same place as ANTHROPIC_API_KEY).
//
// Two modes:
// - No referenceImage: plain text-to-image generation (used once, for the
//   base FLEX image).
// - referenceImage provided: uses the images/edits endpoint, which keeps
//   the character visually consistent with the reference instead of us
//   re-describing his whole appearance in every single prompt.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing OPENAI_API_KEY. Add it in your Vercel project settings." });
  }

  const { prompt, referenceImage } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt." });
  }

  try {
    let upstream;

    if (referenceImage) {
      const base64Data = referenceImage.split(",")[1] || referenceImage;
      const buffer = Buffer.from(base64Data, "base64");
      const blob = new Blob([buffer], { type: "image/png" });

      const form = new FormData();
      form.append("model", "gpt-image-1.5");
      form.append("prompt", prompt);
      form.append("image", blob, "reference.png");
      form.append("size", "1024x1536");
      form.append("quality", "medium");
      form.append("input_fidelity", "high"); // preserve FLEX's distinctive features through pose/scene changes

      upstream = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` }, // fetch sets the multipart boundary itself
        body: form,
      });
    } else {
      upstream = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1.5",
          prompt,
          size: "1024x1536", // portrait — closest available size to 9:16 Shorts/TikTok
          quality: "medium", // ~$0.034/image — real quality tier, not the mini model
          n: 1,
        }),
      });
    }

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
