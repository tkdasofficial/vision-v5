// Instruction parser + deterministic constraint checks (words, scripts, commentary, sections).
// Pure and browser-safe. Only extracts what the user explicitly wrote; never invents requirements.

export type Script = "latin" | "devanagari" | "bengali" | "arabic" | "cyrillic" | "cjk";
export type WordRange = { min: number | null; max: number | null; per: "item" | "total" };
export type ScriptRule = { part: "dialogue" | "description" | "all"; script: Script; language: string };
export type Instructions = {
  words: WordRange | null;
  maxChars: number | null;
  scripts: ScriptRule[];
  noCommentary: boolean;
  /** Continuity/consistency was asked for — subjective, checked by the reviewer, never claimed as verified. */
  consistency: boolean;
};
export type SectionIssue = { code: string; message: string; items?: number[] };

const LANG_SCRIPT: Record<string, Script> = {
  english: "latin", spanish: "latin", french: "latin", german: "latin", hinglish: "latin", romanized: "latin",
  hindi: "devanagari", marathi: "devanagari", nepali: "devanagari", sanskrit: "devanagari", devanagari: "devanagari",
  bengali: "bengali", bangla: "bengali", arabic: "arabic", urdu: "arabic", russian: "cyrillic",
  chinese: "cjk", japanese: "cjk",
};
const SCRIPT_RE: Record<Script, RegExp> = {
  latin: /\p{Script=Latin}/gu, devanagari: /\p{Script=Devanagari}/gu, bengali: /\p{Script=Bengali}/gu,
  arabic: /\p{Script=Arabic}/gu, cyrillic: /\p{Script=Cyrillic}/gu, cjk: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu,
};

export function parseInstructions(text: string): Instructions {
  const t = text.slice(0, 20000);
  let words: WordRange | null = null;
  const per = (s: string) => (/\b(per|each|every)\b/i.test(s) ? "item" : "total") as WordRange["per"];
  const range = /(\d{1,4})\s*(?:-|–|—|to)\s*(\d{1,4})\s*words?\b([^.\n]{0,30})/i.exec(t);
  if (range) words = { min: Number(range[1]), max: Number(range[2]), per: per(range[3] + t.slice(Math.max(0, range.index - 30), range.index)) };
  else {
    const max = /\b(?:under|at most|no more than|maximum(?: of)?|max|up to|within)\s*(\d{1,5})\s*words?\b([^.\n]{0,30})/i.exec(t);
    const min = /\b(?:at least|minimum(?: of)?|no fewer than|more than)\s*(\d{1,5})\s*words?\b([^.\n]{0,30})/i.exec(t);
    if (max || min) words = { min: min ? Number(min[1]) : null, max: max ? Number(max[1]) : null, per: per((max?.[2] ?? "") + (min?.[2] ?? "")) };
  }
  if (words && words.min != null && words.max != null && words.min > words.max) [words.min, words.max] = [words.max, words.min];

  const chars = /\b(?:under|at most|no more than|max(?:imum)?|within)\s*(\d{1,6})\s*char(?:acter)?s\b/i.exec(t);

  const scripts: ScriptRule[] = [];
  const langs = Object.keys(LANG_SCRIPT).join("|");
  const partOf = (s: string): ScriptRule["part"] =>
    /dialog(?:ue)?s?|speech|conversation|lines spoken/i.test(s) ? "dialogue" : /descriptions?|narration|narrative|prose|actions?/i.test(s) ? "description" : "all";
  const reA = new RegExp(`\\b(${langs})\\b(?:\\s*\\((?:in\\s+)?(\\w+)\\))?\\s+(dialog(?:ue)?s?|speech|conversations?|descriptions?|narration|prose)(?:\\s+(?:in|using)\\s+(\\w+)(?:\\s+script)?)?`, "gi");
  const reB = new RegExp(`\\b(dialog(?:ue)?s?|speech|descriptions?|narration|prose)\\s+(?:must be |should be |are |is |written )?in\\s+(${langs})\\b(?:\\s*(?:\\(|in |using )\\s*(\\w+))?`, "gi");
  const add = (lang: string, part: ScriptRule["part"], scriptWord?: string) => {
    const script = (scriptWord && LANG_SCRIPT[scriptWord.toLowerCase()]) || LANG_SCRIPT[lang.toLowerCase()];
    if (script && !scripts.some((s) => s.part === part)) scripts.push({ part, script, language: lang.toLowerCase() });
  };
  for (const m of t.matchAll(reA)) add(m[1], partOf(m[3]), m[4] ?? m[2]);
  for (const m of t.matchAll(reB)) add(m[2], partOf(m[1]), m[3]);

  const noCommentary = /\b(no|without)\s+(?:any\s+)?(?:extra|additional|other)?\s*(commentary|comments|explanations?|preamble|intro(?:duction)?|notes)\b|\b(only|just)\s+(?:return|output|give)?\s*(?:the\s+)?(story|output|answer|code|json|list|scenes?)\s*(?:only|,|\.|$)|\b(?:return|output)\s+only\b/i.test(t);
  const consistency = /\b(consistent|consistency|continuity|continuous|coherent)\b/i.test(t);
  return { words, maxChars: chars ? Number(chars[1]) : null, scripts, noCommentary, consistency };
}

/** Word rule: a word is a whitespace-separated token containing at least one letter or digit (any script).
 *  Markdown symbols, labels such as "Scene 3:" and stand-alone punctuation are not counted. */
export function countWords(text: string): number {
  return text.replace(/[*_#>`|]/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export type Section = { num: number; label: string; body: string; start: number; end: number };

/** Splits an answer into labelled sections ("Scene 1", "## Scene 2:", "**Scene 3**"). */
export function splitSections(text: string, noun: string): { preamble: string; sections: Section[] } {
  const re = new RegExp(`^[ \\t]{0,3}(?:#{1,6}\\s*)?(?:[*_]{1,2})?${noun}s?\\s*#?(\\d{1,3})\\b[^\\n]*$`, "gim");
  const heads = [...text.matchAll(re)];
  const sections = heads.map((m, i) => {
    const start = m.index!, end = i + 1 < heads.length ? heads[i + 1].index! : text.length;
    const label = m[0];
    const inline = label.replace(new RegExp(`^[ \\t]*(?:#{1,6}\\s*)?(?:[*_]{1,2})?${noun}s?\\s*#?\\d{1,3}\\s*(?:[*_]{1,2})?\\s*[:.)\\-–—]?\\s*(?:[*_]{1,2})?`, "i"), "");
    return { num: Number(m[1]), label, body: (inline + text.slice(start + label.length, end)).trim(), start, end };
  });
  return { preamble: heads.length ? text.slice(0, heads[0].index!).trim() : text.trim(), sections };
}

/** Dialogue = quoted text, or text after a "Dialogue:" / "Name:" speaker label. Everything else is description. */
export function splitDialogue(body: string): { dialogue: string; description: string } {
  const dialogue: string[] = [];
  let rest = body.replace(/[“"«]([^”"»\n]+)[”"»]/g, (_, q) => { dialogue.push(q); return " "; });
  rest = rest.replace(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:dialog(?:ue)?|speech|[\p{Lu}][\p{L}]{1,20})(?:\*\*)?\s*(?:\([^)]*\))?\s*:\s*(.+)$/gimu, (all, line) => {
    if (/^(?:description|narration|setting|action|duration|scene|note)\b/i.test(all.trim())) return all;
    dialogue.push(line); return " ";
  });
  rest = rest.replace(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:description|narration|setting|action)(?:\*\*)?\s*:\s*/gim, "");
  return { dialogue: dialogue.join(" "), description: rest };
}

function scriptShare(text: string, script: Script): { share: number; letters: number } {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (!letters) return { share: 1, letters: 0 };
  return { share: (text.match(SCRIPT_RE[script]) ?? []).length / letters, letters };
}

const COMMENTARY = /^(?:sure|certainly|of course|here(?:'s| is| are)|i hope|let me know|hope you|feel free|note:|this story|in this story|enjoy)\b/i;

/** Per-section checks. Each issue lists the affected item numbers so correction can target only those sections. */
export function checkInstructions(text: string, ins: Instructions, noun: string | null): SectionIssue[] {
  const issues: SectionIssue[] = [];
  const body = text.replace(/```[\s\S]*?```/g, "");
  const { preamble, sections } = noun ? splitSections(body, noun) : { preamble: body, sections: [] as Section[] };
  const units = sections.length ? sections.map((s) => ({ num: s.num, body: s.body })) : [{ num: 0, body: body.trim() }];

  if (ins.words) {
    const { min, max } = ins.words;
    const out = (n: number) => (min != null && n < min) || (max != null && n > max);
    const rule = min != null && max != null ? `${min}–${max}` : min != null ? `at least ${min}` : `at most ${max}`;
    if (ins.words.per === "item" && sections.length) {
      const bad = units.map((u) => ({ num: u.num, n: countWords(u.body) })).filter((u) => out(u.n));
      if (bad.length) issues.push({ code: "word_count", items: bad.map((b) => b.num), message: `Each ${noun} must have ${rule} words; ${bad.map((b) => `${noun} ${b.num} has ${b.n}`).join(", ")}.` });
    } else {
      const n = countWords(body);
      if (out(n)) issues.push({ code: "word_count", message: `The answer must have ${rule} words; it has ${n}.` });
    }
  }
  if (ins.maxChars && body.trim().length > ins.maxChars) issues.push({ code: "char_count", message: `The answer must be at most ${ins.maxChars} characters; it has ${body.trim().length}.` });

  for (const rule of ins.scripts) {
    const bad: number[] = [];
    let missing = 0;
    for (const u of units) {
      const parts = splitDialogue(u.body);
      const part = rule.part === "dialogue" ? parts.dialogue : rule.part === "description" ? parts.description : u.body;
      const { share, letters } = scriptShare(part, rule.script);
      if (!letters) { if (rule.part === "dialogue") missing++; continue; }
      if (share < 0.9) bad.push(u.num);
    }
    const where = rule.part === "all" ? "text" : rule.part;
    if (bad.length) issues.push({ code: "script", items: sections.length ? bad : undefined, message: `The ${where} must be ${rule.language} written in ${rule.script} script; it isn't in ${sections.length ? `${noun} ${bad.join(", ")}` : "the answer"}.` });
    if (rule.part === "dialogue" && missing === units.length) issues.push({ code: "dialogue_missing", message: `No dialogue was found; write ${rule.language} dialogue in quotes.` });
  }

  if (ins.noCommentary) {
    const pre = preamble.split("\n").map((l) => l.trim()).filter(Boolean);
    const extraIntro = sections.length ? pre.filter((l) => !/^#{1,6}\s|^\*\*[^*]+\*\*$/.test(l)) : pre.filter((l) => COMMENTARY.test(l));
    const last = sections[sections.length - 1];
    const tail = last ? last.body.split("\n").map((l) => l.trim()).filter((l) => COMMENTARY.test(l) || /^---+$/.test(l)) : [];
    if (extraIntro.length || tail.length) issues.push({ code: "commentary", items: !extraIntro.length && last ? [last.num] : undefined, message: "Remove the commentary — return only the requested output, with no intro or closing remarks." });
  }
  return issues;
}

/** Replaces sections in `text` with same-numbered sections from `patch`; returns null when nothing matched. */
export function spliceSections(text: string, patch: string, noun: string, only: number[]): string | null {
  const orig = splitSections(text, noun).sections;
  const repl = new Map(splitSections(patch, noun).sections.filter((s) => only.includes(s.num)).map((s) => [s.num, patch.slice(s.start, s.end).trimEnd()]));
  if (!repl.size) return null;
  let out = text;
  for (const s of [...orig].reverse()) {
    const r = repl.get(s.num);
    if (r != null) out = out.slice(0, s.start) + r + (s.end < text.length ? "\n\n" : "") + out.slice(s.end).replace(/^\s+/, "");
  }
  return out;
}

export function instructionAddendum(ins: Instructions, noun: string | null): string[] {
  const lines: string[] = [];
  if (ins.words) {
    const r = ins.words.min != null && ins.words.max != null ? `${ins.words.min}–${ins.words.max}` : ins.words.min != null ? `at least ${ins.words.min}` : `at most ${ins.words.max}`;
    lines.push(`${ins.words.per === "item" && noun ? `Each ${noun}` : "The whole answer"} must contain ${r} words (labels like "${noun ?? "Item"} 1:" are not counted).`);
  }
  if (ins.maxChars) lines.push(`Keep the answer within ${ins.maxChars} characters.`);
  for (const s of ins.scripts) lines.push(`${s.part === "all" ? "All text" : s.part === "dialogue" ? "All dialogue (in double quotes)" : "All descriptions"} must be ${s.language} in ${s.script} script${s.part === "dialogue" ? "; do not mix in other scripts" : ""}.`);
  if (ins.noCommentary) lines.push("Return only the requested output: no intro, no closing remarks, no notes.");
  if (ins.consistency) lines.push("Keep characters' names, appearance, clothing and the timeline consistent across every part.");
  return lines;
}
