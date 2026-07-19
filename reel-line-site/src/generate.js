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

  const { system, prompt, maxTokens, useSearch } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt." });
  }

  try {
    const body = {
      model: "claude-sonnet-5",
      max_tokens: maxTokens || 2000,
      system,
      messages: [{ role: "user", content: prompt }],
    };

    if (useSearch) {
      // Real, live web search — Claude decides when to search and the
      // results come back grounded with actual source URLs.
      body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || "Anthropic API error", detail: data });
    }

    const content = data.content || [];
    const textBlocks = content.filter((b) => b.type === "text");

    // When search is involved, Claude often emits short intermediate text
    // ("Let me check...") between searches, then a final full answer. The
    // LAST text block is the actual deliverable; earlier ones are narration.
    // Without search, there's normally just one block, so join is safe either way.
    const text = useSearch && textBlocks.length > 1
      ? (textBlocks[textBlocks.length - 1].text || "").trim()
      : textBlocks.map((b) => b.text).join("\n").trim();

    // Pull real source URLs out of the web search tool results.
    const sources = [];
    const seen = new Set();
    for (const block of content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.url && !seen.has(r.url)) {
            seen.add(r.url);
            sources.push({ title: r.title || r.url, url: r.url });
          }
        }
      }
    }

    return res.status(200).json({ text, sources });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
