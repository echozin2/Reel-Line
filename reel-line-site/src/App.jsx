import React, { useState, useEffect } from "react";
import {
  Circle, Copy, Check, Loader2, Play, RefreshCw,
  Sparkles, FileText, Image as ImageIcon, Mic, LayoutTemplate, ArrowRight
} from "lucide-react";

// ---------- palette / tokens ----------
const C = {
  bg: "#0B0D0F",
  panel: "#15181B",
  panelAlt: "#1B1F23",
  line: "#2A2F34",
  bone: "#EDEAE2",
  boneDim: "#9AA0A6",
  rec: "#FF3B30",
  tape: "#F5C518",
  green: "#4C9F70",
};

const STAGES = [
  { id: "concept", ch: "CH.01", title: "Hook & Package", icon: Sparkles },
  { id: "script", ch: "CH.02", title: "Script", icon: FileText },
  { id: "visuals", ch: "CH.03", title: "AI Visuals", icon: ImageIcon },
  { id: "voice", ch: "CH.04", title: "Voiceover", icon: Mic },
  { id: "thumbnail", ch: "CH.05", title: "Thumbnail Brief", icon: LayoutTemplate },
];

async function askClaude(userPrompt, system, opts = {}) {
  const { maxTokens, useSearch } = opts;
  let res;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, prompt: userPrompt, maxTokens, useSearch }),
    });
  } catch (networkErr) {
    throw new Error("Network error reaching the server: " + networkErr.message);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed (" + res.status + ")");
  }
  if (!data.text) throw new Error("Empty response from Claude.");
  return { text: data.text, sources: data.sources || [] };
}

function extractJson(text) {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // fall through
  }
  const candidates = ["{", "["].map((c) => cleaned.indexOf(c)).filter((i) => i !== -1);
  const first = candidates.length ? Math.min(...candidates) : -1;
  const last = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (first !== -1 && last > first) {
    return JSON.parse(cleaned.slice(first, last + 1));
  }
  throw new Error("Could not parse a response from Claude.");
}

function stripFences(s) {
  return s.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
}

function useTimecode() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function CopyBtn({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="f-mono flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors"
      style={{ background: copied ? C.green : C.panelAlt, color: copied ? "#0B0D0F" : C.boneDim, border: `1px solid ${C.line}` }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function StageHeader({ stage, active, done }) {
  const Icon = stage.icon;
  return (
    <div className="flex items-center gap-3 mb-1">
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 34, height: 34,
          background: done ? C.green : active ? C.rec : C.panelAlt,
          color: done || active ? "#0B0D0F" : C.boneDim,
          border: `1px solid ${done ? C.green : active ? C.rec : C.line}`,
          flexShrink: 0,
        }}
      >
        <Icon size={16} />
      </div>
      <div>
        <div className="f-mono text-[11px] tracking-widest" style={{ color: C.tape }}>{stage.ch}</div>
        <div className="f-display text-lg font-semibold" style={{ color: C.bone }}>{stage.title}</div>
      </div>
    </div>
  );
}

function TextArea({ value, onChange, rows = 6, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="f-body w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
      style={{ background: C.bg, color: C.bone, border: `1px solid ${C.line}` }}
    />
  );
}

function SourceList({ sources }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
      <span className="f-mono text-[11px] block mb-1.5" style={{ color: C.tape }}>SOURCES</span>
      <div className="space-y-1">
        {sources.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="block text-[11px] truncate underline"
            style={{ color: C.boneDim }}
          >
            {s.title}
          </a>
        ))}
      </div>
    </div>
  );
}

function PrimaryButton({ onClick, loading, children, icon: Icon = Play, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="f-mono flex items-center gap-2 px-4 py-2 rounded text-xs font-medium tracking-wide transition-opacity"
      style={{ background: C.rec, color: "#0B0D0F", opacity: loading || disabled ? 0.5 : 1 }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {loading ? "GENERATING…" : children}
    </button>
  );
}

export default function App() {
  const timecode = useTimecode();
  const [activeIdx, setActiveIdx] = useState(0);

  const [niche, setNiche] = useState("");
  const [angle, setAngle] = useState("");
  const [loadingNiche, setLoadingNiche] = useState(false);
  const [contentStyle, setContentStyle] = useState("story"); // "story" | "research"

  const [concepts, setConcepts] = useState(null);
  const [conceptSources, setConceptSources] = useState([]);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [loadingConcepts, setLoadingConcepts] = useState(false);
  const [errConcepts, setErrConcepts] = useState("");

  const [script, setScript] = useState("");
  const [scriptSources, setScriptSources] = useState([]);
  const [loadingScript, setLoadingScript] = useState(false);
  const [errScript, setErrScript] = useState("");

  const [visuals, setVisuals] = useState(null);
  const [loadingVisuals, setLoadingVisuals] = useState(false);
  const [errVisuals, setErrVisuals] = useState("");

  const [voiceDirection, setVoiceDirection] = useState("");
  const [loadingVoiceDir, setLoadingVoiceDir] = useState(false);
  const [elKey, setElKey] = useState("");
  const [elVoiceId, setElVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [errAudio, setErrAudio] = useState("");

  const [thumbBrief, setThumbBrief] = useState("");
  const [loadingThumb, setLoadingThumb] = useState(false);
  const [errThumb, setErrThumb] = useState("");

  const done = {
    concept: !!selectedConcept,
    script: !!script,
    visuals: !!visuals,
    voice: !!voiceDirection,
    thumbnail: !!thumbBrief,
  };

  async function genRandomNiche(andRun) {
    setLoadingNiche(true);
    setErrConcepts("");
    try {
      const sys = `You come up with fresh, specific sub-niches for faceless AI-fitness YouTube channels — the kind with real search demand but not oversaturated. Return ONLY raw JSON, no fences: {"niche": string, "angle": string}. niche is 3-6 words, specific (not just "fitness"). angle is a one-line contrarian or specific constraint that makes it stand out.`;
      const user = `Give me one idea, different from generic ones like "home workouts" or "weight loss tips". Surprise me.`;
      const { text } = await askClaude(user, sys);
      const parsed = extractJson(text);
      setNiche(parsed.niche || "");
      setAngle(parsed.angle || "");
      if (andRun) await genConcepts(parsed.niche, parsed.angle);
    } catch (e) {
      setErrConcepts(e.message || "Couldn't pick a niche — try again.");
    } finally {
      setLoadingNiche(false);
    }
  }

  async function genConcepts(nicheOverride, angleOverride) {
    const useNiche = nicheOverride !== undefined ? nicheOverride : niche;
    const useAngle = angleOverride !== undefined ? angleOverride : angle;
    if (!useNiche || !useNiche.trim()) return;
    setLoadingConcepts(true);
    setErrConcepts("");
    setConcepts(null);
    setConceptSources([]);
    setSelectedConcept(null);
    try {
      const sys = contentStyle === "research"
        ? `You are a YouTube strategist for faceless AI-fitness channels. Use web search to find real, credible sources (established fitness science sites, sports medicine orgs, reputable coaching resources) about this niche before writing anything. Only make claims you actually found in search results — NOT invented studies, NOT fabricated statistics. Never write a first-person "I did X for 30 days" narrative — you have no body and did nothing. Frame titles around real, verifiable training principles. After searching, respond with ONLY raw JSON, no markdown fences, no commentary, no search narration in the final answer. Schema: [{"title": string, "thumbnailConcept": string, "hook": string}] with exactly 3 items. Titles make a bold, specific promise grounded in what you found. thumbnailConcept describes a single dynamic image concept (diagram/demonstration/comparison) in one sentence. hook is the first line the video should open with, and must not claim a personal result that didn't happen.`
        : `You are a YouTube strategist for faceless AI-fitness channels. You reverse-engineer what gets clicks BEFORE any script exists. Return ONLY raw JSON, no markdown fences, no commentary. Schema: [{"title": string, "thumbnailConcept": string, "hook": string}] with exactly 3 items. Titles make a bold, specific promise. thumbnailConcept describes a single dynamic image concept (pose/composition/before-after) in one sentence. hook is the first line the video should open with.`;
      const user = `Niche: ${useNiche}\n${useAngle ? "Angle/constraint: " + useAngle : ""}\nGenerate 3 distinct title + thumbnail concept pairs.`;
      const { text, sources } = await askClaude(user, sys, { useSearch: contentStyle === "research" });
      const parsed = extractJson(text);
      setConcepts(parsed);
      setConceptSources(sources);
    } catch (e) {
      setErrConcepts(e.message || "Something went wrong.");
    } finally {
      setLoadingConcepts(false);
    }
  }

  async function genScript() {
    if (!selectedConcept) return;
    setLoadingScript(true);
    setErrScript("");
    try {
      const sys = contentStyle === "research"
        ? `You write scripts for faceless AI-fitness YouTube videos. Use web search to find real, credible sources on the specific claims this script needs before writing — NOT invented studies, NOT fabricated statistics, NOT a fake personal "I did this" narrative. Explain the real mechanism behind each claim (e.g. how progressive overload, hip-hinge mechanics, or EPOC actually work) in plain language, based on what you found. If search doesn't turn up something solid, state the general textbook-level finding instead of inventing specifics. The title and thumbnail are already locked — the script's only job is to deliver on that exact promise, starting with a hook in the first 10 seconds. Every 15-25 words, insert a bracketed visual cue like [SCENE: description of what's on screen] so an editor can generate matching AI visuals later. Write 550-750 words. After searching, output ONLY the final script as plain text — no markdown headers, no search narration, no commentary.`
        : `You write scripts for faceless AI-fitness YouTube videos. The title and thumbnail are already locked — the script's only job is to deliver on that exact promise, starting with a hook in the first 10 seconds. Every 15-25 words, insert a bracketed visual cue like [SCENE: description of what's on screen] so an editor can generate matching AI visuals later. Write 550-750 words. Plain text only, no markdown headers.`;
      const user = `Title: ${selectedConcept.title}\nThumbnail concept: ${selectedConcept.thumbnailConcept}\nOpening hook: ${selectedConcept.hook}\nNiche: ${niche}`;
      const { text, sources } = await askClaude(user, sys, { maxTokens: 3000, useSearch: contentStyle === "research" });
      setScript(text);
      setScriptSources(sources);
    } catch (e) {
      setErrScript(e.message || "Something went wrong.");
    } finally {
      setLoadingScript(false);
    }
  }

  async function genVisuals() {
    if (!script) return;
    setLoadingVisuals(true);
    setErrVisuals("");
    try {
      const sys = `You extract every [SCENE: ...] cue from a fitness video script and prepare AI image-generation prompts for Whisk. Return ONLY raw JSON, no fences: {"basePrompt": string, "scenes": [{"cue": string, "prompt": string}]}. basePrompt describes ONE consistent faceless/anonymized AI fitness presenter avatar (build, styling, lighting, art style) matching the niche and title's tone — this is the character every scene reuses. Each scene prompt restates the base character briefly plus the specific action/pose/setting for that cue, ready to paste directly into an image generator.`;
      const user = `Title: ${selectedConcept?.title || ""}\nNiche: ${niche}\nScript:\n${script}`;
      const { text } = await askClaude(user, sys, { maxTokens: 3000 });
      const parsed = extractJson(text);
      setVisuals(parsed);
    } catch (e) {
      setErrVisuals(e.message || "Something went wrong.");
    } finally {
      setLoadingVisuals(false);
    }
  }

  async function genVoiceDirection() {
    if (!script) return;
    setLoadingVoiceDir(true);
    try {
      const sys = `Give short, practical voice-casting direction for an ElevenLabs voiceover of a faceless fitness video. 3-4 sentences max: pace, tone, energy, and what to avoid (e.g. "not robotic"). Plain text.`;
      const user = `Title: ${selectedConcept?.title || ""}\nNiche: ${niche}\nScript excerpt:\n${script.slice(0, 600)}`;
      const { text } = await askClaude(user, sys);
      setVoiceDirection(text);
    } catch (e) {
      setVoiceDirection("Could not generate direction — write your script into ElevenLabs and test 2-3 voices for authoritative-but-natural tone.");
    } finally {
      setLoadingVoiceDir(false);
    }
  }

  async function genAudio() {
    if (!elKey.trim() || !script) return;
    setLoadingAudio(true);
    setErrAudio("");
    setAudioUrl(null);
    try {
      const cleanScript = script.replace(/\[SCENE:[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}`, {
        method: "POST",
        headers: { "xi-api-key": elKey.trim(), "Content-Type": "application/json", "Accept": "audio/mpeg" },
        body: JSON.stringify({ text: cleanScript, model_id: "eleven_multilingual_v2" }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error("ElevenLabs error (" + res.status + "): " + t.slice(0, 150));
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErrAudio(e.message || "Voiceover generation failed.");
    } finally {
      setLoadingAudio(false);
    }
  }

  async function genThumbBrief() {
    if (!selectedConcept) return;
    setLoadingThumb(true);
    setErrThumb("");
    try {
      const sys = `Write a short thumbnail production brief for Canva. Plain text, 4 short labeled lines: TEXT OVERLAY (max 3 words, all caps), LAYOUT (composition/pose direction), CONTRAST (color/lighting note), VARIATIONS (2-3 quick variant ideas to A/B test).`;
      const user = `Title: ${selectedConcept.title}\nThumbnail concept: ${selectedConcept.thumbnailConcept}\nNiche: ${niche}`;
      const { text } = await askClaude(user, sys);
      setThumbBrief(text);
    } catch (e) {
      setErrThumb(e.message || "Something went wrong.");
    } finally {
      setLoadingThumb(false);
    }
  }

  return (
    <div className="min-h-screen f-body" style={{ background: C.bg }}>
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2" style={{ background: "#000", borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2">
          <Circle size={10} fill={C.rec} color={C.rec} className="rec-dot" />
          <span className="f-mono text-xs tracking-widest" style={{ color: C.bone }}>REC</span>
          <span className="f-mono text-xs" style={{ color: C.boneDim }}>{timecode}</span>
        </div>
        <div className="f-display text-sm font-semibold tracking-tight" style={{ color: C.bone }}>
          REEL LINE <span style={{ color: C.tape }}>·</span> <span style={{ color: C.boneDim, fontWeight: 500 }}>faceless fitness pipeline</span>
        </div>
        <div className="f-mono text-xs" style={{ color: C.boneDim }}>05 STAGES</div>
      </div>

      <div className="flex overflow-x-auto px-4 py-3 gap-2" style={{ borderBottom: `1px solid ${C.line}` }}>
        {STAGES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveIdx(i)}
            className="f-mono text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors"
            style={{
              background: activeIdx === i ? C.tape : C.panel,
              color: activeIdx === i ? "#0B0D0F" : done[s.id] ? C.green : C.boneDim,
              border: `1px solid ${activeIdx === i ? C.tape : C.line}`,
            }}
          >
            {done[s.id] && <Check size={11} />}
            {s.ch} {s.title}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {activeIdx === 0 && (
          <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <StageHeader stage={STAGES[0]} active done={done.concept} />
            <p className="text-sm mb-4" style={{ color: C.boneDim }}>Package first, script never. Give a niche and we reverse-engineer titles people click.</p>

            <label className="f-mono text-[11px] block mb-1" style={{ color: C.tape }}>NICHE / TOPIC</label>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. calisthenics for beginners, home ab workouts, fat loss over 40"
              className="f-body w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-3"
              style={{ background: C.bg, color: C.bone, border: `1px solid ${C.line}` }}
            />
            <label className="f-mono text-[11px] block mb-1" style={{ color: C.tape }}>ANGLE / CONSTRAINT (optional)</label>
            <input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="e.g. no equipment, contrarian take, beginner-safe"
              className="f-body w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4"
              style={{ background: C.bg, color: C.bone, border: `1px solid ${C.line}` }}
            />

            <label className="f-mono text-[11px] block mb-1" style={{ color: C.tape }}>CONTENT STYLE</label>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setContentStyle("story")}
                className="f-mono flex-1 text-xs px-3 py-2 rounded-lg transition-colors"
                style={{
                  background: contentStyle === "story" ? C.tape : C.bg,
                  color: contentStyle === "story" ? "#0B0D0F" : C.boneDim,
                  border: `1px solid ${contentStyle === "story" ? C.tape : C.line}`,
                }}
              >
                PERSONAL STORY
              </button>
              <button
                onClick={() => setContentStyle("research")}
                className="f-mono flex-1 text-xs px-3 py-2 rounded-lg transition-colors"
                style={{
                  background: contentStyle === "research" ? C.tape : C.bg,
                  color: contentStyle === "research" ? "#0B0D0F" : C.boneDim,
                  border: `1px solid ${contentStyle === "research" ? C.tape : C.line}`,
                }}
              >
                RESEARCH-BACKED
              </button>
            </div>
            <p className="text-[11px] mb-4" style={{ color: C.boneDim }}>
              {contentStyle === "research"
                ? "Grounded in established exercise-science principles — no invented studies, no fake \"I did X for 30 days\" claims."
                : "Dramatized first-person framing (e.g. \"I did X for 30 days\") — a proven attention pattern, but not a real account of anything."}
            </p>

            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={() => genConcepts()} loading={loadingConcepts} disabled={!niche.trim()} icon={Sparkles}>
                GENERATE 3 CONCEPTS
              </PrimaryButton>
              <button
                onClick={() => genRandomNiche(true)}
                disabled={loadingNiche || loadingConcepts}
                className="f-mono flex items-center gap-2 px-4 py-2 rounded text-xs font-medium tracking-wide transition-opacity"
                style={{ background: "transparent", color: C.tape, border: `1px solid ${C.tape}`, opacity: loadingNiche || loadingConcepts ? 0.5 : 1 }}
              >
                {loadingNiche ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {loadingNiche ? "PICKING…" : "SURPRISE ME"}
              </button>
            </div>
            <p className="text-[11px] mt-2" style={{ color: C.boneDim }}>Surprise me picks a fresh sub-niche + angle and generates concepts right away.</p>
            {errConcepts && <p className="text-xs mt-2" style={{ color: C.rec }}>{errConcepts}</p>}

            {concepts && (
              <div className="mt-4 space-y-2">
                {concepts.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedConcept(c)}
                    className="w-full text-left rounded-lg p-3 transition-colors"
                    style={{ background: selectedConcept === c ? C.panelAlt : C.bg, border: `1px solid ${selectedConcept === c ? C.tape : C.line}` }}
                  >
                    <div className="f-display text-sm font-semibold mb-1" style={{ color: C.bone }}>{c.title}</div>
                    <div className="text-xs mb-1" style={{ color: C.boneDim }}>Thumbnail: {c.thumbnailConcept}</div>
                    <div className="f-mono text-[11px]" style={{ color: C.tape }}>Hook: "{c.hook}"</div>
                  </button>
                ))}
              </div>
            )}
            <SourceList sources={conceptSources} />

            {selectedConcept && (
              <div className="mt-4 flex justify-end">
                <button onClick={() => setActiveIdx(1)} className="f-mono flex items-center gap-1.5 text-xs" style={{ color: C.green }}>
                  NEXT: SCRIPT <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}

        {activeIdx === 1 && (
          <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <StageHeader stage={STAGES[1]} active done={done.script} />
            {!selectedConcept ? (
              <p className="text-sm" style={{ color: C.boneDim }}>Pick a concept in CH.01 first.</p>
            ) : (
              <>
                <div className="rounded-lg p-3 mb-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                  <div className="f-display text-sm font-semibold" style={{ color: C.bone }}>{selectedConcept.title}</div>
                </div>
                <PrimaryButton onClick={genScript} loading={loadingScript} icon={FileText}>
                  {script ? "REGENERATE SCRIPT" : "GENERATE SCRIPT"}
                </PrimaryButton>
                {errScript && <p className="text-xs mt-2" style={{ color: C.rec }}>{errScript}</p>}
                {script && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="f-mono text-[11px]" style={{ color: C.tape }}>SCRIPT — edit freely</span>
                      <CopyBtn text={script} />
                    </div>
                    <TextArea value={script} onChange={setScript} rows={14} />
                    <SourceList sources={scriptSources} />
                  </div>
                )}
                {script && (
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => setActiveIdx(2)} className="f-mono flex items-center gap-1.5 text-xs" style={{ color: C.green }}>
                      NEXT: AI VISUALS <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeIdx === 2 && (
          <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <StageHeader stage={STAGES[2]} active done={done.visuals} />
            {!script ? (
              <p className="text-sm" style={{ color: C.boneDim }}>Generate a script in CH.02 first.</p>
            ) : (
              <>
                <p className="text-sm mb-3" style={{ color: C.boneDim }}>
                  Whisk has no public API, so these prompts are copy-paste — one base character, then a prompt per scene cue.
                </p>
                <PrimaryButton onClick={genVisuals} loading={loadingVisuals} icon={ImageIcon}>
                  {visuals ? "REGENERATE PROMPTS" : "GENERATE VISUAL PROMPTS"}
                </PrimaryButton>
                {errVisuals && <p className="text-xs mt-2" style={{ color: C.rec }}>{errVisuals}</p>}

                {visuals && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.tape}` }}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="f-mono text-[11px]" style={{ color: C.tape }}>BASE CHARACTER</span>
                        <CopyBtn text={visuals.basePrompt} />
                      </div>
                      <p className="text-xs" style={{ color: C.bone }}>{visuals.basePrompt}</p>
                    </div>
                    {visuals.scenes?.map((s, i) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="f-mono text-[11px]" style={{ color: C.boneDim }}>SCENE {String(i + 1).padStart(2, "0")}</span>
                          <CopyBtn text={s.prompt} />
                        </div>
                        <p className="text-[11px] italic mb-1" style={{ color: C.boneDim }}>{s.cue}</p>
                        <p className="text-xs" style={{ color: C.bone }}>{s.prompt}</p>
                      </div>
                    ))}
                  </div>
                )}
                {visuals && (
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => setActiveIdx(3)} className="f-mono flex items-center gap-1.5 text-xs" style={{ color: C.green }}>
                      NEXT: VOICEOVER <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeIdx === 3 && (
          <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <StageHeader stage={STAGES[3]} active done={done.voice} />
            {!script ? (
              <p className="text-sm" style={{ color: C.boneDim }}>Generate a script in CH.02 first.</p>
            ) : (
              <>
                <PrimaryButton onClick={genVoiceDirection} loading={loadingVoiceDir} icon={Mic}>
                  {voiceDirection ? "REGENERATE DIRECTION" : "GET VOICE DIRECTION"}
                </PrimaryButton>
                {voiceDirection && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                    <p className="text-xs" style={{ color: C.bone }}>{voiceDirection}</p>
                  </div>
                )}

                <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
                  <span className="f-mono text-[11px] block mb-2" style={{ color: C.tape }}>OPTIONAL — GENERATE AUDIO WITH ELEVENLABS</span>
                  <p className="text-xs mb-3" style={{ color: C.boneDim }}>
                    Your key stays in this browser tab only — it's sent straight to ElevenLabs, never through our server.
                  </p>
                  <input
                    type="password"
                    value={elKey}
                    onChange={(e) => setElKey(e.target.value)}
                    placeholder="ElevenLabs API key"
                    className="f-mono w-full rounded-lg px-3 py-2 text-xs outline-none mb-2"
                    style={{ background: C.bg, color: C.bone, border: `1px solid ${C.line}` }}
                  />
                  <input
                    value={elVoiceId}
                    onChange={(e) => setElVoiceId(e.target.value)}
                    placeholder="Voice ID"
                    className="f-mono w-full rounded-lg px-3 py-2 text-xs outline-none mb-3"
                    style={{ background: C.bg, color: C.bone, border: `1px solid ${C.line}` }}
                  />
                  <p className="text-[11px] mb-3" style={{ color: C.boneDim }}>Default is ElevenLabs' premade "Rachel" voice — swap in any voice ID from your account.</p>
                  <PrimaryButton onClick={genAudio} loading={loadingAudio} icon={Play} disabled={!elKey.trim()}>
                    GENERATE VOICEOVER
                  </PrimaryButton>
                  {errAudio && <p className="text-xs mt-2" style={{ color: C.rec }}>{errAudio}</p>}
                  {audioUrl && <audio controls src={audioUrl} className="w-full mt-3" />}
                </div>

                {(voiceDirection || audioUrl) && (
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => setActiveIdx(4)} className="f-mono flex items-center gap-1.5 text-xs" style={{ color: C.green }}>
                      NEXT: THUMBNAIL <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeIdx === 4 && (
          <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <StageHeader stage={STAGES[4]} active done={done.thumbnail} />
            {!selectedConcept ? (
              <p className="text-sm" style={{ color: C.boneDim }}>Pick a concept in CH.01 first.</p>
            ) : (
              <>
                <PrimaryButton onClick={genThumbBrief} loading={loadingThumb} icon={LayoutTemplate}>
                  {thumbBrief ? "REGENERATE BRIEF" : "GENERATE THUMBNAIL BRIEF"}
                </PrimaryButton>
                {errThumb && <p className="text-xs mt-2" style={{ color: C.rec }}>{errThumb}</p>}
                {thumbBrief && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="f-mono text-[11px]" style={{ color: C.tape }}>CANVA BRIEF</span>
                      <CopyBtn text={thumbBrief} />
                    </div>
                    <div className="rounded-lg p-3 whitespace-pre-line text-xs" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.bone }}>
                      {thumbBrief}
                    </div>
                  </div>
                )}
                {thumbBrief && (
                  <div className="mt-5 rounded-lg p-3 text-center" style={{ background: C.panelAlt, border: `1px solid ${C.green}` }}>
                    <span className="f-mono text-xs" style={{ color: C.green }}>REEL COMPLETE — all 5 stages produced</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
