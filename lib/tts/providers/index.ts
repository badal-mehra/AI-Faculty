"use client";

// Teacher-voice provider registry.
//
// Puter.js is the ONLY active TTS provider: the classroom never calls a server TTS route and
// never talks to Gemini directly for speech (Puter may use Gemini TTS internally).
// Adding/replacing a provider later remains a one-line change here; Classroom and
// useTeacherVoice() never need to know which provider is active.
import { synthesizeWithPuter } from "./puter";
import type { TtsProviderName, TtsSynthesizer } from "./types";

export const ACTIVE_TTS_PROVIDER: TtsProviderName = "puter";

const PROVIDERS: Record<TtsProviderName, TtsSynthesizer> = {
  puter: synthesizeWithPuter,
};

export const synthesizeSpeech: TtsSynthesizer = (text, options) => PROVIDERS[ACTIVE_TTS_PROVIDER](text, options);
