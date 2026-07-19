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
    const tools = useSearch
      ? [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }]
      : undefined;

    let messages = [{ role: "user", content: prompt }];
    let allContent = [];
    let lastData = null;
    let iterations = 0;

    // Long web-search turns can come back with stop_reason "pause_turn" —
    // the response is incomplete and must be continued by sending the
    // paused assistant content back in a follow-up request. Loop until the
    // turn actually ends.
    while (iterations < 6) {
      const body = {
        model: "claude-sonnet-5",
        max_tokens: maxTokens || 2000,
        system,
        messages,
      };
      if (tools) body.tools = tools;

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

      lastData = data;
      allContent = allContent.concat(data.content || []);

      if (data.stop_reason === "pause_turn") {
        messages = [...messages, { role: "assistant", content: data.content }];
        iterations++;
        continue;
      }
      break;
    }

    const textBlocks = allContent.filter((b) => b.type === "text");

    // With search, Claude often emits short narration ("Let me check...")
    // before/between searches, then the real final answer as the LAST text
    // block. Without search there's normally just one block, so join is
    // equivalent either way.
    const text = useSearch && textBlocks.length > 1
      ? (textBlocks[textBlocks.length - 1].text || "").trim()
      : textBlocks.map((b) => b.text).join("\n").trim();

    const sources = [];
    const seen = new Set();
    for (const block of allContent) {
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
