"use client";

// Puter.js teacher voice provider.
//
// Puter.js is a keyless, client-side SDK ("User-Pays" model): nothing secret is shipped to
// the browser and no server endpoint is required. The script is loaded lazily on first use.
import type { TtsSynthesis } from "./types";

const PUTER_SDK_URL = "https://js.puter.com/v2/";
const PUTER_SCRIPT_ATTRIBUTE = "data-ai-faculty-puter";
const PUTER_TEXT_LIMIT = 3000; // Puter rejects speech text of 3000 characters or more.

// Currently supported Puter TTS configuration.

// Provider `gemini` with the documented model/voice, plus natural-language `instructions`
// for the faculty persona. Verified against docs.puter.com/AI/txt2speech (current).
export const PUTER_TTS_CONFIG = {
  provider: "gemini",
  model: "gemini-2.5-flash-preview-tts",
  voice: "Puck",
  instructions: "Speak like a friendly, warm Indian college professor teaching a student. Be natural, clear and conversational, with a moderate classroom pace.",
} as const;

type PuterTxt2Speech = (text: string, options?: Record<string, unknown>) => Promise<HTMLAudioElement>;
type PuterGlobal = { ai?: { txt2speech?: PuterTxt2Speech } };

declare global {
  interface Window { puter?: PuterGlobal }
}

let puterLoad: Promise<PuterGlobal> | null = null;

// Lazily inject and await the Puter.js SDK (cached after the first successful load).
export function loadPuterSdk(): Promise<PuterGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("The teacher voice is only available in the browser."));
  if (window.puter?.ai?.txt2speech) return Promise.resolve(window.puter);
  if (puterLoad) return puterLoad;

  puterLoad = new Promise<PuterGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[${PUTER_SCRIPT_ATTRIBUTE}]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.puter?.ai?.txt2speech) resolve(window.puter);
      else { puterLoad = null; reject(new Error("Puter.js loaded but text-to-speech is unavailable.")); }
    };
    const onError = () => { puterLoad = null; reject(new Error("Could not load the Puter.js voice SDK.")); };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = PUTER_SDK_URL;
      script.async = true;
      script.setAttribute(PUTER_SCRIPT_ATTRIBUTE, "true");
      document.head.appendChild(script);
    }
  });
  return puterLoad;
}

export async function synthesizeWithPuter(text: string, options: { language?: string } = {}): Promise<TtsSynthesis> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) throw new Error("There is no speech text to read.");
  if (trimmed.length >= PUTER_TEXT_LIMIT) throw new Error("The speech text is too long for the voice provider.");

  const puter = await loadPuterSdk();
  const txt2speech = puter.ai?.txt2speech;
  if (typeof txt2speech !== "function") throw new Error("Puter text-to-speech is unavailable in this browser.");

  const languageInstruction = options.language ? ` Teach in ${options.language}; pronounce technical terms naturally for that language.` : "";
  const audio = await txt2speech.call(puter.ai, trimmed, { ...PUTER_TTS_CONFIG, instructions: `${PUTER_TTS_CONFIG.instructions}${languageInstruction}` });
  if (!audio || typeof audio.play !== "function") throw new Error("Puter returned no playable audio.");

  // Puter owns the audio element and its data URI; the voice layer pauses/clears it on release.
  return { audio, dispose: () => { /* nothing to release */ } };
}
