import React, { useState, useEffect, useRef } from "react";
import {
  Circle, Copy, Check, Loader2, Play, RefreshCw,
  Sparkles, FileText, Image as ImageIcon, Mic, LayoutTemplate, ArrowRight, Film, Download
} from "lucide-react";

// ---------- palette / tokens ----------
const C = {
  bg: "#060A0E",
  panel: "#0E161D",
  panelAlt: "#141F28",
  line: "#1F2E38",
  bone: "#EAF4F4",
  boneDim: "#8FA3AB",
  rec: "#FF3B30",
  tape: "#2DE5E0",
  green: "#4C9F70",
};

// Bump this every time a new App.jsx is uploaded — shows in the top bar
// so it's obvious at a glance whether the live site matches the latest file.
const BUILD = "16";

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
  const [channelName, setChannelName] = useState("FORM FORGE");
  const [channelTagline, setChannelTagline] = useState("Move. Train. Improve.");
  const [channelLogo, setChannelLogo] = useState(null); // data URL of uploaded logo
  const [characterName, setCharacterName] = useState("Flex");
  const [useLogoForIntro, setUseLogoForIntro] = useState(true);
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
  const [customCharacter, setCustomCharacter] = useState("");
  const [testPrompt, setTestPrompt] = useState("FLEX — reflective dark helmet with a glowing cyan chevron visor pattern, no human face, black tech-hoodie with a thin glowing cyan zip-line — gripping a barbell racked at chest height, mid-rep on a bench press, elbows bent to 90 degrees, viewed from a low three-quarter angle, soft cyan glow on his chest, composed on the left side of frame with the right half left as plain empty studio background");
  const [testFocus, setTestFocus] = useState("Chest");
  const [testTip, setTestTip] = useState("The bar grinds to a near-halt mid-press.");
  const [testSide, setTestSide] = useState("left");
  const [testImage, setTestImage] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testErr, setTestErr] = useState("");
  const [loadingVisuals, setLoadingVisuals] = useState(false);
  const [errVisuals, setErrVisuals] = useState("");
  const [genImages, setGenImages] = useState({}); // key -> data URL
  const [loadingImages, setLoadingImages] = useState({}); // key -> bool
  const [errImages, setErrImages] = useState({}); // key -> string
  const [loadingAll, setLoadingAll] = useState(false);
  const [allProgress, setAllProgress] = useState("");

  const [voiceDirection, setVoiceDirection] = useState("");
  const [loadingVoiceDir, setLoadingVoiceDir] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState("openai"); // "openai" | "elevenlabs"
  const [oaiVoice, setOaiVoice] = useState("onyx");
  const [elKey, setElKey] = useState("");
  const [elVoiceId, setElVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState("");
  const [errAudio, setErrAudio] = useState("");

  const [thumbBrief, setThumbBrief] = useState("");
  const [loadingThumb, setLoadingThumb] = useState(false);
  const [errThumb, setErrThumb] = useState("");

  const [assembling, setAssembling] = useState(false);
  const [assembleProgress, setAssembleProgress] = useState("");
  const [assembledVideoUrl, setAssembledVideoUrl] = useState(null);
  const [errAssemble, setErrAssemble] = useState("");
  const canvasRef = useRef(null);

  const done = {
    concept: !!selectedConcept,
    script: !!script,
    visuals: !!visuals,
    voice: !!voiceDirection,
    thumbnail: !!thumbBrief,
  };

  // Auto-generate the script the moment a concept is picked (if it hasn't
  // been generated yet), and auto-generate visual prompts the moment a
  // script exists — no extra click needed to kick each stage off. Manual
  // "Regenerate" buttons still work normally afterward.
  useEffect(() => {
    if (activeIdx === 1 && selectedConcept && !script && !loadingScript) {
      genScript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, selectedConcept]);

  useEffect(() => {
    if (activeIdx === 2 && script && !visuals && !loadingVisuals) {
      genVisuals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, script]);

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
        ? `You are a YouTube strategist for faceless AI-fitness channels. You MUST call the web_search tool at least twice before writing your answer — do this even if you're already confident, because the goal is real, checkable sources, not just what you already know. Search for credible sources (established fitness science sites, sports medicine orgs, reputable coaching resources) about this niche. Only make claims you actually found in search results — NOT invented studies, NOT fabricated statistics. Never write a first-person "I did X for 30 days" narrative — you have no body and did nothing. Frame titles around real, verifiable training principles. After searching, respond with ONLY raw JSON, no markdown fences, no commentary, no search narration in the final answer. Schema: [{"title": string, "thumbnailConcept": string, "hook": string}] with exactly 3 items. Titles make a bold, specific promise grounded in what you found. thumbnailConcept describes a single dynamic image concept (diagram/demonstration/comparison) in one sentence. hook is the first line the video should open with, and must not claim a personal result that didn't happen.`
        : `You are a YouTube strategist for faceless AI-fitness channels. You reverse-engineer what gets clicks BEFORE any script exists. Return ONLY raw JSON, no markdown fences, no commentary. Schema: [{"title": string, "thumbnailConcept": string, "hook": string}] with exactly 3 items. Titles make a bold, specific promise. thumbnailConcept describes a single dynamic image concept (pose/composition/before-after) in one sentence. hook is the first line the video should open with.`;
      const user = `Niche: ${useNiche}\n${useAngle ? "Angle/constraint: " + useAngle : ""}\nGenerate 3 distinct title + thumbnail concept pairs.`;
      const { text, sources } = await askClaude(user, sys, { maxTokens: 3000, useSearch: contentStyle === "research" });
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
      const introGreeting = characterName.trim()
        ? `What's up, I'm ${characterName.trim()}${channelName.trim() ? " from " + channelName.trim() : ""}`
        : `Hello, this is ${channelName.trim()}`;
      const introInstruction = channelName.trim() || characterName.trim()
        ? `The very first beat of the script must be this intro, spoken close to verbatim: "${introGreeting}${channelTagline.trim() ? "... " + channelTagline.trim() : "."}" Pair it with a [SCENE: ...] cue for a bold, confident introduction shot of the character (no readable on-image text needed — the words are spoken and captioned, not drawn on screen). This intro is one of the 8-10 total scene cues, not extra. Immediately after it, cut straight into the hook that delivers on the title's promise — no filler between the intro and the hook.`
        : `Start directly with the hook — no channel intro.`;
      const outroInstruction = channelTagline.trim()
        ? `The script's very last line must be close to verbatim: "Well, that's it — and remember... ${channelTagline.trim().toUpperCase()}... catch you next time!" (keep that rhythm and structure; light wording tweaks are fine, but the tagline shout and "catch you next time" close must stay).`
        : `Close with a short, natural sign-off line specific to this video's topic.`;
      const sys = contentStyle === "research"
        ? `You write scripts for faceless AI-fitness YouTube videos in a sarcastic, dryly funny, playful tone throughout — not a serious textbook voice. Light jabs, wit, and humor are welcome even while explaining real mechanisms; never sacrifice accuracy for a joke, but never sound dry or overly earnest either. You MUST call the web_search tool at least twice before writing the script — do this even if you're already confident, because the goal is real, checkable sources, not just what you already know. Search for credible sources on the specific claims this script needs — NOT invented studies, NOT fabricated statistics, NOT a fake personal "I did this" narrative. Explain the real mechanism behind each claim (e.g. how progressive overload, hip-hinge mechanics, or EPOC actually work) in plain language, based on what you found. If search doesn't turn up something solid, state the general textbook-level finding instead of inventing specifics. ${introInstruction} The title and thumbnail are already locked — the script's only job is to deliver on that exact promise. HARD LIMIT: this is a SHORT-FORM video that must land close to 2 MINUTES SPOKEN — write 220-280 words total. This is a RANGE, not a ceiling: fewer than 220 words is just as wrong as more than 280. A 34-second script is a failure — pad out real explanation, examples, and detail to reach the range, never leave it short. CRITICAL REQUIREMENT: insert 5-6 bracketed visual cues total, like [SCENE: description of what's on screen], spread evenly across the script (roughly one every 40-50 words) so an editor can generate a matching STATIC AI IMAGE later — never more than 6, since more images than that isn't needed for a video this short. Every cue must describe a single still image — one frozen moment, pose, or composition — never a video shot, clip, or camera movement. Never use words like "slow-motion", "clip", "footage", "pans across", "zooms in", or any phrase implying motion over time; describe what a single photo would show at that instant instead. Also never describe a title card, on-screen text overlay, graphic slamming onto screen, or any typography treatment — describe a physical scene featuring the character instead (there is a separate, code-drawn overlay for text; you never need to invent one). Also never describe a graph, chart, bar chart, percentage breakdown, data visualization, or comparison graphic of any kind, and never describe a split-image, multi-panel, or side-by-side layout within one cue — none of these render reliably from an AI image generator. If you want to compare things (like different grip widths), describe ONE specific physical moment instead (e.g. the character's hands in one specific grip position) rather than a chart of the data. Never use the word "gym" in a cue — describe the specific concrete elements instead (a barbell, a bench, a rack) without naming the whole room. If this video is about a specific exercise or piece of equipment (e.g. bench press, deadlift, a specific machine), most of your scene cues MUST actually show that exercise/equipment being performed or used — the character holding the barbell, lying on the bench, mid-rep — not just standing in a generic pose reacting to the camera. A bench press video with no image of an actual bench press is a failed script. Always end with a real conclusion — never let the script just trail off mid-explanation. The final 25-35 words must: (1) tie the payoff directly back to the title/hook's promise, (2) give one clear, concrete takeaway the viewer can act on right now, and (3) ${outroInstruction} After searching, output ONLY the final script as plain text — no markdown headers, no search narration, no commentary. BEFORE YOU FINISH: check that your very first sentence is the intro line specified above, word for word — a script that starts anywhere else (straight into the hook, straight into content) is wrong even if everything else is correct. It counts toward your word budget, it is not optional, and it is not something to cut to save space. Then count your words: if you are over 280, cut content from the middle, never the intro. If you are under 220, you are NOT done — go back and add more real explanation, detail, or examples until you are in the 220-280 range. Do not submit a short script. Count your [SCENE: ...] cues too — if there are more than 6, remove some; if fewer than 5, this is also wrong.`
        : `You write scripts for faceless AI-fitness YouTube videos in a sarcastic, dryly funny, playful tone throughout — not a serious textbook voice. Light jabs, wit, and humor are welcome. ${introInstruction} The title and thumbnail are already locked — the script's only job is to deliver on that exact promise. HARD LIMIT: this is a SHORT-FORM video that must land close to 2 MINUTES SPOKEN — write 220-280 words total. This is a RANGE, not a ceiling: fewer than 220 words is just as wrong as more than 280. A 34-second script is a failure — pad out real explanation, examples, and detail to reach the range, never leave it short. CRITICAL REQUIREMENT: insert 5-6 bracketed visual cues total, like [SCENE: description of what's on screen], spread evenly across the script (roughly one every 40-50 words) so an editor can generate a matching STATIC AI IMAGE later — never more than 6, since more images than that isn't needed for a video this short. Every cue must describe a single still image — one frozen moment, pose, or composition — never a video shot, clip, or camera movement. Never use words like "slow-motion", "clip", "footage", "pans across", "zooms in", or any phrase implying motion over time; describe what a single photo would show at that instant instead. Also never describe a title card, on-screen text overlay, graphic slamming onto screen, or any typography treatment — describe a physical scene featuring the character instead (there is a separate, code-drawn overlay for text; you never need to invent one). Also never describe a graph, chart, bar chart, percentage breakdown, data visualization, or comparison graphic of any kind, and never describe a split-image, multi-panel, or side-by-side layout within one cue — none of these render reliably from an AI image generator. If you want to compare things (like different grip widths), describe ONE specific physical moment instead (e.g. the character's hands in one specific grip position) rather than a chart of the data. Never use the word "gym" in a cue — describe the specific concrete elements instead (a barbell, a bench, a rack) without naming the whole room. If this video is about a specific exercise or piece of equipment (e.g. bench press, deadlift, a specific machine), most of your scene cues MUST actually show that exercise/equipment being performed or used — the character holding the barbell, lying on the bench, mid-rep — not just standing in a generic pose reacting to the camera. A bench press video with no image of an actual bench press is a failed script. Always end with a real conclusion — never let the script just trail off mid-explanation. The final 25-35 words must: (1) tie the payoff directly back to the title/hook's promise, (2) give one clear, concrete takeaway the viewer can act on right now, and (3) ${outroInstruction} Plain text only, no markdown headers. BEFORE YOU FINISH: check that your very first sentence is the intro line specified above, word for word — a script that starts anywhere else (straight into the hook, straight into content) is wrong even if everything else is correct. It counts toward your word budget, it is not optional, and it is not something to cut to save space. Then count your words: if you are over 280, cut content from the middle, never the intro. If you are under 220, you are NOT done — go back and add more real explanation, detail, or examples until you are in the 220-280 range. Do not submit a short script. Count your [SCENE: ...] cues too — if there are more than 6, remove some; if fewer than 5, this is also wrong.`;
      const user = `Title: ${selectedConcept.title}\nThumbnail concept: ${selectedConcept.thumbnailConcept}\nOpening hook: ${selectedConcept.hook}\nNiche: ${niche}`;
      const { text, sources } = await askClaude(user, sys, { maxTokens: 4000, useSearch: contentStyle === "research" });
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
      const hasCustom = customCharacter.trim().length > 0;
      const sys = hasCustom
        ? `You extract every [SCENE: ...] cue from a fitness video script and prepare AI image-generation prompts. The user has already written their own exact base character description below, used ONCE to generate a reference image: "${customCharacter.trim()}". Return ONLY raw JSON, no fences: {"scenes": [{"cue": string, "prompt": string, "subject": "character"|"object", "side": "left"|"right"}]}.

COMPOSITION RULE — every scene leaves ONE full side of the frame as plain, empty background (matching the studio backdrop, nothing else in it) — this space is reserved for a text panel added afterward. "side" = which side the subject occupies; the empty space is always the opposite side. Alternate sides across scenes for visual variety.

SUBJECT CHOICE — "subject": "character" when the script moment is about the character doing something; "object" when the script names a specific concrete thing (a calendar, a plate of food, a supplement bottle, a specific tool) that would be a clearer, more literal visual than the character standing there — in that case the image features THAT OBJECT prominently instead, styled to match (same lighting, same plain backdrop, same side-composition rule). Ground this choice in the literal noun the script uses at that moment. Don't force the character into every single scene if the script is actually talking about something else.

Each scene "prompt" (70-110 words): if subject is "character", this is an edit instruction on the reference image — start by briefly restating the character's most distinctive, identity-critical traits (2-3 words each, drawn from the description above) in one short clause so identity doesn't drift during the edit, THEN describe what changes: the action/pose tied to the exact script moment, which side of the frame he's composed on, and confirm the opposite side is empty plain background. If subject is "object", this is a full prompt (generated fresh, no reference) describing that object concretely, in a clean product-photography style consistent with the rest of the video, positioned on the specified side with the opposite side empty.

CRITICAL — GROUND EVERY SCENE IN THE ACTUAL SCRIPT: read the specific sentence(s) around each [SCENE: ...] cue and depict THAT EXACT claim, mechanism, or named thing — never a generic pose. MECHANICAL RULE: if the cue names specific equipment or an exercise, the prompt MUST explicitly describe it being held/used/visible — a scene about a barbell with no barbell in the prompt is wrong. These are STATIC IMAGES, not video — never describe motion or camera movement. Never ask for text/words/labels in the image. Never describe a multi-panel or side-by-side comparison within one image — that's what the side/subject split above is for. Ready to paste directly into an image tool.`
        : `You extract every [SCENE: ...] cue from a fitness video script and prepare AI image-generation prompts for a character named FLEX. Return ONLY raw JSON, no fences: {"basePrompt": string, "scenes": [{"cue": string, "prompt": string, "focus": string, "tip": string, "subject": "flex"|"object", "side": "left"|"right"}]}. basePrompt describes FLEX in this EXACT style, used ONCE to generate a single reference image: a photorealistic CGI android fitness coach — reflective dark helmet head with a subtle glowing cyan dot/chevron visor pattern where the eyes would be, no visible human face. Athletic build in a sleek black performance tech-hoodie with a thin glowing cyan line running down the center zip, black joggers, black-and-white athletic sneakers. Clean, polished product-render quality — sharp reflections, realistic fabric and material detail, NOT a flat illustration, NOT a cartoon. Background: alone on a bright, clean white-to-light-grey studio backdrop with faint geometric tech linework — minimal, uncluttered, premium product photography. Even, soft studio lighting with a subtle cyan rim-light. basePrompt itself should be 70-110 words, concrete about build, materials, and this exact photoreal CGI style — not vague.

COMPOSITION RULE — every scene leaves ONE full side of the frame as plain, empty background (matching the studio backdrop, nothing else in it, no character or object bleeding into it) — this space is reserved for a text info panel added afterward. "side" = which side the subject (FLEX or the object) occupies in that scene; the empty reserved space is always the opposite side. Alternate sides across scenes for visual variety unless the content strongly favors one framing.

SUBJECT CHOICE — "subject": "flex" when the script moment is about FLEX performing an action or exercise; "object" when the script names a specific concrete thing (a calendar, a plate of food, a supplement bottle, a specific piece of equipment on its own) that would be a clearer, more literal visual than FLEX standing there — in that case the image features THAT OBJECT prominently instead of FLEX, rendered in the same clean CGI product-photography style, same lighting, same studio background, same side-composition rule. Ground this choice in the literal noun the script uses — if it says "calendar", show a calendar; if it's about food, show the actual food. Don't force FLEX into every scene if the script is actually talking about something else.

"focus" = the single muscle group or topic that scene's script segment is actually about (e.g. "Legs", "Chest", "Nutrition", "Schedule") — used for a soft cyan glow highlight when subject is "flex" (on the relevant body part), or omitted/left empty when subject is "object". "tip" = a short (max 8 words) genuine paraphrase of the specific point the script makes at that moment — never invent numbers, sets, reps, or stats not actually in the script; keep it qualitative if the script gives no number.

Each scene "prompt" (70-110 words): if subject is "flex", this is an edit instruction on the FLEX reference image — start by briefly restating his invariant, unchanging traits in one short clause (reflective dark helmet with the glowing cyan visor pattern, no human face, black tech-hoodie with the cyan zip-line) so his identity doesn't drift during the edit, THEN describe what changes: the action/pose/equipment tied to the exact script moment, which side of frame he's composed on, the cyan glow on the "focus" body part, and confirm the opposite side stays empty plain background. Do not redescribe secondary details (exact fabric texture, background linework) — just the identity-critical traits plus the change. If subject is "object", this is a full prompt (no reference image used) describing that object concretely and specifically, styled to match FLEX's clean product-photography aesthetic (same lighting, same plain backdrop, subtle cyan accent allowed), positioned on the specified side, opposite side empty.

CRITICAL — GROUND EVERY SCENE IN THE ACTUAL SCRIPT: read the specific sentence(s) around each [SCENE: ...] cue and depict THAT EXACT claim, mechanism, or named thing — never a generic pose. MECHANICAL RULE, NO EXCEPTIONS: if the cue, tip, or script segment names specific equipment (bar, barbell, bench, dumbbell, plate, machine, band, etc.) or a specific exercise, the "prompt" MUST explicitly describe FLEX gripping/holding/positioned on that exact equipment, visible in frame — a scene whose tip says "the bar grinds to a halt" but whose prompt doesn't mention a bar is WRONG, fix it before responding. Never use the word "gym" or describe gym flooring/walls/racks — only the specific item itself, isolated on the plain backdrop. These are STATIC IMAGES, not video — never describe motion, slow-motion, or camera movement. Never ask for text/words/labels in the image (rendered unreliably). Never describe a multi-panel or side-by-side comparison within one image — that's what the side/subject split above is for. Ready to paste directly into an image tool.`;
      const user = `Title: ${selectedConcept?.title || ""}\nNiche: ${niche}\nScript:\n${script}`;
      const { text } = await askClaude(user, sys, { maxTokens: 6000 });
      const parsed = extractJson(text);
      setVisuals(hasCustom ? { basePrompt: customCharacter.trim(), scenes: parsed.scenes || parsed } : parsed);
    } catch (e) {
      setErrVisuals(e.message || "Something went wrong.");
    } finally {
      setLoadingVisuals(false);
    }
  }

  async function genTestImage() {
    setTestLoading(true);
    setTestErr("");
    try {
      const reference = genImages.base || null;
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: testPrompt, referenceImage: reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
      setTestImage(data.image);
    } catch (e) {
      setTestErr(e.message || "Test generation failed.");
    } finally {
      setTestLoading(false);
    }
  }

  async function genImage(key, prompt, isRetry, referenceOverride) {
    if (key === "scene-0" && channelName.trim() && channelLogo && useLogoForIntro) {
      setGenImages((prev) => ({ ...prev, [key]: channelLogo }));
      setErrImages((prev) => ({ ...prev, [key]: "" }));
      return channelLogo;
    }
    if (key !== "base" && referenceOverride === undefined && !genImages.base) {
      setErrImages((prev) => ({ ...prev, [key]: "Generate the base character image first (use Generate All Images, or generate 'base' individually before this one)." }));
      return null;
    }
    setLoadingImages((prev) => ({ ...prev, [key]: true }));
    if (!isRetry) setErrImages((prev) => ({ ...prev, [key]: "" }));
    try {
      // Use the base FLEX image as a visual reference for every scene after
      // it, via OpenAI's image-edit endpoint — keeps him consistent without
      // re-describing his whole appearance in every prompt.
      const referenceImage = referenceOverride !== undefined ? referenceOverride : (key !== "base" ? genImages.base : undefined);
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, referenceImage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
      setGenImages((prev) => ({ ...prev, [key]: data.image }));
      setErrImages((prev) => ({ ...prev, [key]: "" }));
      return data.image;
    } catch (e) {
      if (!isRetry) {
        // Likely rate-limited from firing many requests back to back — wait
        // a beat and try this one more time before giving up.
        await new Promise((r) => setTimeout(r, 2000));
        return genImage(key, prompt, true, referenceOverride);
      }
      setErrImages((prev) => ({ ...prev, [key]: e.message || "Image generation failed." }));
      return null;
    } finally {
      setLoadingImages((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function genAllImages() {
    if (!visuals) return;
    const items = [
      { key: "base", prompt: visuals.basePrompt, subject: "flex" },
      ...(visuals.scenes || []).map((s, i) => ({ key: `scene-${i}`, prompt: s.prompt, subject: s.subject || "flex" })),
    ];
    setLoadingAll(true);
    let succeeded = 0;
    let baseImageData = null;
    for (let i = 0; i < items.length; i++) {
      setAllProgress(`Generating ${i + 1} of ${items.length}…`);
      const isBase = items[i].key === "base";
      const isObject = items[i].subject === "object";
      // Object scenes (calendar, food, etc.) generate fresh with no
      // reference — the FLEX reference only applies to FLEX scenes.
      const reference = isBase ? undefined : isObject ? null : baseImageData;
      const result = await genImage(items[i].key, items[i].prompt, false, reference);
      if (isBase) baseImageData = result;
      if (result) succeeded++;
      // Small gap between requests to avoid tripping rate limits.
      if (i < items.length - 1) await new Promise((r) => setTimeout(r, 500));
    }
    setAllProgress(
      succeeded === items.length
        ? ""
        : `${succeeded} of ${items.length} succeeded — ${items.length - succeeded} failed (see red text below each). Try Generate Image on those individually.`
    );
    setLoadingAll(false);
  }


  async function genVoiceDirection() {
    if (!script) return;
    setLoadingVoiceDir(true);
    try {
      const sys = `Give short, practical voice-casting direction for a faceless fitness video voiceover. The script is written in a sarcastic, dryly funny, playful tone — the delivery should match: relaxed, a little cheeky, comfortable landing a joke or a deadpan line, not a serious documentary-narrator voice. 3-4 sentences max: pace, tone, energy, and what to avoid (e.g. "not robotic", "not overly earnest"). Plain text.`;
      const user = `Title: ${selectedConcept?.title || ""}\nNiche: ${niche}\nScript excerpt:\n${script.slice(0, 600)}`;
      const { text } = await askClaude(user, sys);
      setVoiceDirection(text);
    } catch (e) {
      setVoiceDirection("Could not generate direction — write your script into ElevenLabs and test 2-3 voices for authoritative-but-natural tone.");
    } finally {
      setLoadingVoiceDir(false);
    }
  }

  async function genAudioElevenLabs() {
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

  function chunkTextForTTS(text, maxChars) {
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
    const chunks = [];
    let current = "";
    for (const s of sentences) {
      if ((current + s).length > maxChars && current) {
        chunks.push(current.trim());
        current = s;
      } else {
        current += s;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  async function genAudioOpenAI() {
    if (!script) return;
    setLoadingAudio(true);
    setErrAudio("");
    setAudioUrl(null);
    try {
      const cleanScript = script.replace(/\[SCENE:[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
      // gpt-4o-mini-tts can quietly stop early on long input even under its
      // documented limits — chunking sidesteps that regardless of cause.
      const chunks = chunkTextForTTS(cleanScript, 500);
      const blobs = [];
      for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) setAudioProgress(`Generating part ${i + 1} of ${chunks.length}…`);
        const res = await fetch("/api/generate-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunks[i], voice: oaiVoice, instructions: voiceDirection || undefined }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(`Part ${i + 1}/${chunks.length} failed: ` + (data.error || "Request failed (" + res.status + ")"));
        }
        blobs.push(await res.blob());
      }
      const combined = new Blob(blobs, { type: "audio/mpeg" });
      setAudioUrl(URL.createObjectURL(combined));
      setAudioProgress("");
    } catch (e) {
      setErrAudio(e.message || "Voiceover generation failed.");
      setAudioProgress("");
    } finally {
      setLoadingAudio(false);
    }
  }

  function genAudio() {
    return voiceProvider === "openai" ? genAudioOpenAI() : genAudioElevenLabs();
  }

  async function assembleVideo() {
    setErrAssemble("");
    setAssembledVideoUrl(null);

    const orderedScenes = (visuals?.scenes || [])
      .map((s, i) => ({ key: `scene-${i}`, focus: s.focus || "", tip: s.tip || "", side: s.side || "left" }))
      .filter((s) => genImages[s.key]);
    const orderedKeys = orderedScenes.map((s) => s.key);
    if (orderedKeys.length === 0) {
      setErrAssemble("Generate at least one scene image in CH.03 first.");
      return;
    }
    if (!audioUrl) {
      setErrAssemble("Generate the voiceover audio above first.");
      return;
    }

    setAssembling(true);
    setAssembleProgress("Loading images…");

    try {
      const imgs = await Promise.all(
        orderedKeys.map(
          (k) =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error("Couldn't load one of the generated images."));
              img.src = genImages[k];
            })
        )
      );

      let logoImg = null;
      if (channelLogo) {
        logoImg = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = channelLogo;
        });
      }

      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        audio.addEventListener("loadedmetadata", resolve, { once: true });
        audio.addEventListener("error", () => reject(new Error("Couldn't load the voiceover audio.")), { once: true });
      });

      const duration = audio.duration;
      const perImage = duration / imgs.length;
      const transitionTime = Math.min(0.5, perImage * 0.3);

      const canvas = canvasRef.current;
      const cw = 1024;
      const ch = 1536; // portrait — matches the 9:16-ish Shorts/TikTok images
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");

      // Alternate pan direction per image so it's not a static center-zoom
      // every time — subtle left/right/up/down drift alongside the zoom.
      const panDirs = imgs.map((_, i) => [
        [1, 0], [-1, 0], [0, 1], [0, -1],
      ][i % 4]);

      let audioStream;
      try {
        audioStream = audio.captureStream ? audio.captureStream() : audio.mozCaptureStream();
      } catch (e) {
        throw new Error("This browser can't capture audio for recording — try Chrome or Firefox on desktop.");
      }
      if (!audioStream || audioStream.getAudioTracks().length === 0) {
        throw new Error("This browser can't capture audio for recording — try Chrome or Firefox on desktop.");
      }

      const canvasStream = canvas.captureStream(30);
      const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()]);

      const mimeType = window.MediaRecorder && MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(combined, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const stopped = new Promise((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          setAssembledVideoUrl(URL.createObjectURL(blob));
          resolve();
        };
      });

      setAssembleProgress("Recording…");

      function wrapText(text, maxWidth) {
        const wds = text.split(" ");
        const lines = [];
        let current = "";
        for (const w of wds) {
          const test = current ? current + " " + w : w;
          if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = w;
          } else {
            current = test;
          }
        }
        if (current) lines.push(current);
        return lines;
      }

      function drawFrame() {
        const t = Math.min(audio.currentTime, duration);
        const idx = Math.min(imgs.length - 1, Math.floor(t / perImage));
        const localT = t - idx * perImage;
        const img = imgs[idx];
        const nextImg = imgs[idx + 1];
        const [px, py] = panDirs[idx];

        ctx.clearRect(0, 0, cw, ch);

        const drawImg = (image, alpha, dirX, dirY, progress) => {
          const zoom = 1 + 0.1 * progress;
          const baseScale = Math.max(cw / image.width, ch / image.height);
          const scale = baseScale * zoom;
          const w = image.width * scale;
          const h = image.height * scale;
          // pan drift capped so it never reveals empty canvas edges
          const maxDriftX = Math.max(0, (w - cw) / 2);
          const maxDriftY = Math.max(0, (h - ch) / 2);
          const driftX = dirX * maxDriftX * 0.6 * progress;
          const driftY = dirY * maxDriftY * 0.6 * progress;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.drawImage(image, (cw - w) / 2 - driftX, (ch - h) / 2 - driftY, w, h);
          ctx.restore();
        };

        drawImg(img, 1, px, py, localT / perImage);
        if (nextImg && localT > perImage - transitionTime) {
          const fadeT = (localT - (perImage - transitionTime)) / transitionTime;
          const [npx, npy] = panDirs[idx + 1];
          drawImg(nextImg, fadeT, npx, npy, 0);
        }

        // HUD info panel — code-drawn (never AI-rendered) so the text is
        // always accurate and legible. Content is the real focus/tip pulled
        // from the script for this scene, not invented stats.
        const scene = orderedScenes[idx];
        if (scene && (scene.focus || scene.tip)) {
          const marginSide = 40;
          const panelW = cw * 0.46;
          const pad = 26;

          ctx.font = "600 28px Arial, sans-serif";
          const tipLines = scene.tip ? wrapText(scene.tip.toUpperCase(), panelW - pad * 2) : [];
          const logoSize = 44;
          const headerH = logoImg ? logoSize + 16 : 0;
          const focusH = scene.focus ? 42 : 0;
          const tipH = tipLines.length * 34;
          const panelH = pad * 2 + headerH + focusH + tipH + (tipLines.length ? 10 : 0);
          const panelX = scene.side === "left" ? cw - panelW - marginSide : marginSide;
          const panelY = (ch - panelH) / 2;

          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = "#0B1420";
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(panelX, panelY, panelW, panelH, 18) : ctx.rect(panelX, panelY, panelW, panelH);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#2DE5E0";
          ctx.stroke();
          ctx.restore();

          let cursorY = panelY + pad;

          if (logoImg) {
            const lw = logoImg.width, lh = logoImg.height;
            const s = logoSize / Math.max(lw, lh);
            ctx.drawImage(logoImg, panelX + pad, cursorY, lw * s, lh * s);
            cursorY += headerH;
          }

          if (scene.focus) {
            ctx.font = "700 28px Arial, sans-serif";
            ctx.fillStyle = "#2DE5E0";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(("FOCUS: " + scene.focus).toUpperCase(), panelX + pad, cursorY, panelW - pad * 2);
            cursorY += focusH;
          }

          if (tipLines.length) {
            ctx.font = "600 28px Arial, sans-serif";
            ctx.fillStyle = "#FFFFFF";
            tipLines.forEach((line, i) => {
              ctx.fillText(line, panelX + pad, cursorY + i * 34, panelW - pad * 2);
            });
          }
        }

        if (!audio.ended && !audio.paused) {
          requestAnimationFrame(drawFrame);
        }
      }

      recorder.start();
      await audio.play();
      requestAnimationFrame(drawFrame);

      await new Promise((resolve) => audio.addEventListener("ended", resolve, { once: true }));

      // Hold the last frame briefly and fade to black instead of cutting
      // off the instant the audio stops — reads as an intentional ending.
      await new Promise((resolveOutro) => {
        const outroStart = performance.now();
        const outroDuration = 700;
        function outroFrame() {
          const elapsed = performance.now() - outroStart;
          const p = Math.min(1, elapsed / outroDuration);
          drawFrame();
          ctx.save();
          ctx.globalAlpha = p;
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, cw, ch);
          ctx.restore();
          if (p < 1) {
            requestAnimationFrame(outroFrame);
          } else {
            resolveOutro();
          }
        }
        outroFrame();
      });

      recorder.stop();
      await stopped;
      setAssembleProgress("Done");
    } catch (e) {
      setErrAssemble(e.message || "Couldn't assemble the video in this browser.");
    } finally {
      setAssembling(false);
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
        <div className="f-mono text-xs" style={{ color: C.boneDim }}>BUILD {BUILD}</div>
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
            <div
              className="inline-block f-mono text-xs font-bold px-2.5 py-1 rounded mb-3"
              style={{ background: C.tape, color: "#060A0E" }}
            >
              BUILD {BUILD}
            </div>
            <p className="text-sm mb-4" style={{ color: C.boneDim }}>Package first, script never. Give a niche and we reverse-engineer titles people click.</p>

            <div className="rounded-lg p-3 mb-4" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
              <label className="f-mono text-[11px] block mb-1" style={{ color: C.tape }}>CHANNEL BRANDING — opens every script</label>
              <input
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Character name (e.g. Flex)"
                className="f-body w-full rounded-lg px-3 py-2 text-sm outline-none mb-2"
                style={{ background: C.panel, color: C.bone, border: `1px solid ${C.line}` }}
              />
              <div className="flex gap-2">
                <input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Channel name"
                  className="f-body flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: C.panel, color: C.bone, border: `1px solid ${C.line}` }}
                />
                <input
                  value={channelTagline}
                  onChange={(e) => setChannelTagline(e.target.value)}
                  placeholder="Tagline"
                  className="f-body flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: C.panel, color: C.bone, border: `1px solid ${C.line}` }}
                />
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: C.boneDim }}>
                Leave blank to skip the intro entirely.
              </p>

              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <label className="f-mono text-[11px] block mb-1.5" style={{ color: C.tape }}>LOGO (optional)</label>
                <div className="flex items-center gap-3">
                  {channelLogo && (
                    <img src={channelLogo} alt="Logo preview" className="rounded" style={{ width: 44, height: 44, objectFit: "contain", background: C.panel, border: `1px solid ${C.line}` }} />
                  )}
                  <label
                    className="f-mono text-xs px-3 py-2 rounded-lg cursor-pointer"
                    style={{ background: C.panel, color: C.boneDim, border: `1px solid ${C.line}` }}
                  >
                    {channelLogo ? "REPLACE" : "UPLOAD LOGO"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setChannelLogo(reader.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {channelLogo && (
                    <button
                      onClick={() => setChannelLogo(null)}
                      className="f-mono text-xs px-2 py-2"
                      style={{ color: C.rec }}
                    >
                      REMOVE
                    </button>
                  )}
                </div>
                {channelLogo && (
                  <label className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: C.boneDim }}>
                    <input
                      type="checkbox"
                      checked={useLogoForIntro}
                      onChange={(e) => setUseLogoForIntro(e.target.checked)}
                    />
                    Use this logo for the intro scene instead of AI-generating one
                  </label>
                )}
              </div>
            </div>

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

            <div className="rounded-lg p-3 mb-4" style={{ background: C.bg, border: `1px dashed ${C.tape}` }}>
              <label className="f-mono text-[11px] block mb-1" style={{ color: C.tape }}>QUICK TEST — no script needed</label>
              <p className="text-[11px] mb-3" style={{ color: C.boneDim }}>
                Try a prompt + panel text directly to check the look before running the full pipeline.
              </p>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={3}
                className="f-body w-full rounded-lg px-3 py-2 text-xs outline-none mb-2"
                style={{ background: C.panel, color: C.bone, border: `1px solid ${C.line}` }}
              />
              <div className="flex flex-wrap gap-2 mb-2">
                <input
                  value={testFocus}
                  onChange={(e) => setTestFocus(e.target.value)}
                  placeholder="Focus"
                  className="f-body rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: C.panel, color: C.bone, border: `1px solid ${C.line}`, width: 110 }}
                />
                <input
                  value={testTip}
                  onChange={(e) => setTestTip(e.target.value)}
                  placeholder="Tip"
                  className="f-body flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: C.panel, color: C.bone, border: `1px solid ${C.line}`, minWidth: 160 }}
                />
                <select
                  value={testSide}
                  onChange={(e) => setTestSide(e.target.value)}
                  className="f-mono rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: C.panel, color: C.bone, border: `1px solid ${C.line}` }}
                >
                  <option value="left">Subject: left</option>
                  <option value="right">Subject: right</option>
                </select>
              </div>
              <p className="mb-3 text-[11px]" style={{ color: C.boneDim }}>
                {genImages.base
                  ? "Will use the base FLEX image as reference automatically."
                  : "No base FLEX image generated yet — this will render fresh from text alone. Generate the base image in the main section below first for a truer test."}
              </p>
              <PrimaryButton onClick={genTestImage} loading={testLoading} icon={ImageIcon}>
                GENERATE TEST IMAGE
              </PrimaryButton>
              {testErr && <p className="text-xs mt-2" style={{ color: C.rec }}>{testErr}</p>}
              {testImage && (
                <div className="relative mt-3">
                  <img src={testImage} alt="" className="rounded-lg w-full block" style={{ border: `1px solid ${C.line}` }} />
                  {(testFocus || testTip) && (
                    <div
                      className="absolute rounded-lg px-3 py-2"
                      style={{
                        top: "38%",
                        [testSide === "left" ? "right" : "left"]: "5%",
                        width: "42%",
                        background: "rgba(11,20,32,0.85)",
                        border: "1.5px solid #2DE5E0",
                      }}
                    >
                      {testFocus && <p className="f-mono text-[10px] font-bold mb-0.5" style={{ color: "#2DE5E0" }}>FOCUS: {testFocus.toUpperCase()}</p>}
                      {testTip && <p className="f-mono text-[10px] leading-snug" style={{ color: "#FFFFFF" }}>{testTip.toUpperCase()}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!script ? (
              <p className="text-sm" style={{ color: C.boneDim }}>Generate a script in CH.02 first.</p>
            ) : (
              <>
                <p className="text-sm mb-3" style={{ color: C.boneDim }}>
                  Each scene composes FLEX (or a relevant object your script names, like food or a calendar) on one side, with the info panel in the empty space on the other — pulling real focus/tip content from your script, never invented stats. Paste your own character description below to override FLEX entirely.
                </p>

                <label className="f-mono text-[11px] block mb-1" style={{ color: C.tape }}>CUSTOM CHARACTER (optional)</label>
                <textarea
                  value={customCharacter}
                  onChange={(e) => setCustomCharacter(e.target.value)}
                  rows={3}
                  placeholder="e.g. A muscular flat 2D vector illustration character, matte grey skin, smooth featureless mask with two white oval eyes, clean minimal studio background..."
                  className="f-body w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4"
                  style={{ background: C.bg, color: C.bone, border: `1px solid ${C.line}` }}
                />

                <PrimaryButton onClick={genVisuals} loading={loadingVisuals} icon={ImageIcon}>
                  {visuals ? "REGENERATE PROMPTS" : "GENERATE VISUAL PROMPTS"}
                </PrimaryButton>
                {errVisuals && <p className="text-xs mt-2" style={{ color: C.rec }}>{errVisuals}</p>}

                {visuals && (
                  <div className="mt-3">
                    <PrimaryButton onClick={genAllImages} loading={loadingAll} icon={ImageIcon}>
                      GENERATE ALL IMAGES
                    </PrimaryButton>
                    {allProgress && <p className="text-[11px] mt-1.5" style={{ color: loadingAll ? C.boneDim : C.rec }}>{allProgress}</p>}
                    <p className="text-[11px] mt-1.5" style={{ color: C.boneDim }}>
                      Generates the base character plus every scene, one at a time — you can still regenerate any single image below.
                    </p>
                  </div>
                )}

                {visuals && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.tape}` }}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="f-mono text-[11px]" style={{ color: C.tape }}>BASE CHARACTER</span>
                        <CopyBtn text={visuals.basePrompt} />
                      </div>
                      <p className="text-xs mb-2" style={{ color: C.bone }}>{visuals.basePrompt}</p>
                      <button
                        onClick={() => genImage("base", visuals.basePrompt)}
                        disabled={loadingImages.base}
                        className="f-mono flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-opacity"
                        style={{ background: C.tape, color: "#0B0D0F", opacity: loadingImages.base ? 0.5 : 1 }}
                      >
                        {loadingImages.base ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                        {loadingImages.base ? "GENERATING…" : genImages.base ? "REGENERATE IMAGE" : "GENERATE IMAGE"}
                      </button>
                      {errImages.base && <p className="text-[11px] mt-1" style={{ color: C.rec }}>{errImages.base}</p>}
                      {genImages.base && (
                        <img src={genImages.base} alt="" className="mt-2 rounded-lg w-full" style={{ border: `1px solid ${C.line}` }} />
                      )}
                    </div>
                    {visuals.scenes?.map((s, i) => {
                      const key = `scene-${i}`;
                      return (
                        <div key={i} className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="f-mono text-[11px]" style={{ color: C.boneDim }}>SCENE {String(i + 1).padStart(2, "0")}</span>
                            <CopyBtn text={s.prompt} />
                          </div>
                          <p className="text-[11px] italic mb-1" style={{ color: C.boneDim }}>{s.cue}</p>
                          {(s.focus || s.tip) && (
                            <p className="text-[11px] mb-1.5" style={{ color: C.tape }}>
                              {s.focus && <span className="f-mono">FOCUS: {s.focus}</span>}
                              {s.focus && s.tip && "  ·  "}
                              {s.tip}
                            </p>
                          )}
                          <p className="text-xs mb-2" style={{ color: C.bone }}>{s.prompt}</p>
                          <button
                            onClick={() => genImage(key, s.prompt, false, s.subject === "object" ? null : undefined)}
                            disabled={loadingImages[key]}
                            className="f-mono flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-opacity"
                            style={{ background: C.tape, color: "#0B0D0F", opacity: loadingImages[key] ? 0.5 : 1 }}
                          >
                            {loadingImages[key] ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                            {loadingImages[key] ? "GENERATING…" : genImages[key] ? "REGENERATE IMAGE" : "GENERATE IMAGE"}
                          </button>
                          {errImages[key] && <p className="text-[11px] mt-1" style={{ color: C.rec }}>{errImages[key]}</p>}
                          {genImages[key] && (
                            <div className="relative mt-2">
                              <img src={genImages[key]} alt="" className="rounded-lg w-full block" style={{ border: `1px solid ${C.line}` }} />
                              {(s.focus || s.tip) && (
                                <div
                                  className="absolute rounded-lg px-3 py-2"
                                  style={{
                                    top: "38%",
                                    [s.side === "left" ? "right" : "left"]: "5%",
                                    width: "42%",
                                    background: "rgba(11,20,32,0.85)",
                                    border: "1.5px solid #2DE5E0",
                                  }}
                                >
                                  {s.focus && (
                                    <p className="f-mono text-[10px] font-bold mb-0.5" style={{ color: "#2DE5E0" }}>
                                      FOCUS: {s.focus.toUpperCase()}
                                    </p>
                                  )}
                                  {s.tip && (
                                    <p className="f-mono text-[10px] leading-snug" style={{ color: "#FFFFFF" }}>
                                      {s.tip.toUpperCase()}
                                    </p>
                                  )}
                                </div>
                              )}
                              <p className="f-mono text-[10px] mt-1" style={{ color: C.boneDim }}>
                                Preview only — this exact panel gets drawn onto the final video in CH.04.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                  <span className="f-mono text-[11px] block mb-2" style={{ color: C.tape }}>GENERATE VOICEOVER AUDIO</span>

                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setVoiceProvider("openai")}
                      className="f-mono flex-1 text-xs px-3 py-2 rounded-lg transition-colors"
                      style={{
                        background: voiceProvider === "openai" ? C.tape : C.bg,
                        color: voiceProvider === "openai" ? "#0B0D0F" : C.boneDim,
                        border: `1px solid ${voiceProvider === "openai" ? C.tape : C.line}`,
                      }}
                    >
                      OPENAI (NO EXTRA KEY)
                    </button>
                    <button
                      onClick={() => setVoiceProvider("elevenlabs")}
                      className="f-mono flex-1 text-xs px-3 py-2 rounded-lg transition-colors"
                      style={{
                        background: voiceProvider === "elevenlabs" ? C.tape : C.bg,
                        color: voiceProvider === "elevenlabs" ? "#0B0D0F" : C.boneDim,
                        border: `1px solid ${voiceProvider === "elevenlabs" ? C.tape : C.line}`,
                      }}
                    >
                      ELEVENLABS
                    </button>
                  </div>

                  {voiceProvider === "openai" ? (
                    <>
                      <p className="text-xs mb-3" style={{ color: C.boneDim }}>
                        Uses the same OpenAI key already set up for images — nothing extra to add. Uses the voice direction above to guide tone automatically.
                      </p>
                      <label className="f-mono text-[11px] block mb-1" style={{ color: C.tape }}>VOICE</label>
                      <select
                        value={oaiVoice}
                        onChange={(e) => setOaiVoice(e.target.value)}
                        className="f-mono w-full rounded-lg px-3 py-2 text-xs outline-none mb-3"
                        style={{ background: C.bg, color: C.bone, border: `1px solid ${C.line}` }}
                      >
                        <option value="onyx">Onyx — deep, authoritative</option>
                        <option value="echo">Echo — warm, approachable</option>
                        <option value="ash">Ash — bold, strong presence</option>
                        <option value="fable">Fable — animated, energetic</option>
                        <option value="nova">Nova — clear, polished</option>
                        <option value="alloy">Alloy — neutral, balanced</option>
                        <option value="coral">Coral — warm, friendly</option>
                        <option value="sage">Sage — calm, measured</option>
                        <option value="shimmer">Shimmer — bright, upbeat</option>
                      </select>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}

                  <PrimaryButton onClick={genAudio} loading={loadingAudio} icon={Play} disabled={voiceProvider === "elevenlabs" && !elKey.trim()}>
                    GENERATE VOICEOVER
                  </PrimaryButton>
                  {audioProgress && <p className="text-[11px] mt-1.5" style={{ color: C.boneDim }}>{audioProgress}</p>}
                  {errAudio && <p className="text-xs mt-2" style={{ color: C.rec }}>{errAudio}</p>}
                  {audioUrl && <audio controls src={audioUrl} className="w-full mt-3" />}
                </div>

                {audioUrl && (
                  <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
                    <span className="f-mono text-[11px] block mb-2" style={{ color: C.tape }}>ASSEMBLE VIDEO (BETA)</span>
                    <p className="text-xs mb-3" style={{ color: C.boneDim }}>
                      Stitches your generated scene images from CH.03 with this voiceover — pan + zoom transitions, timed to the audio length. Runs in your browser, works best in Chrome or Firefox on desktop. Stay on this screen while it processes. More scene images = more variety, so generate as many as you can in CH.03 first.
                    </p>
                    <PrimaryButton onClick={assembleVideo} loading={assembling} icon={Film}>
                      STITCH VIDEO
                    </PrimaryButton>
                    {assembling && <p className="text-[11px] mt-2" style={{ color: C.boneDim }}>{assembleProgress}</p>}
                    {errAssemble && <p className="text-xs mt-2" style={{ color: C.rec }}>{errAssemble}</p>}
                    {assembledVideoUrl && (
                      <div className="mt-3">
                        <video controls src={assembledVideoUrl} className="w-full rounded-lg" style={{ border: `1px solid ${C.line}` }} />
                        <a
                          href={assembledVideoUrl}
                          download="reel-line-video.webm"
                          className="f-mono inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded text-xs"
                          style={{ background: C.green, color: "#0B0D0F" }}
                        >
                          <Download size={12} /> DOWNLOAD VIDEO
                        </a>
                      </div>
                    )}
                    <canvas ref={canvasRef} style={{ display: "none" }} />
                  </div>
                )}

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
