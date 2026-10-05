"use client";

// Shared contract for teacher-voice synthesis providers.
// Every provider resolves to a browser HTMLAudioElement (so play/pause/resume/stop and
// onended keep working) plus an optional dispose() for provider-specific cleanup.
export type TtsProviderName = "puter";

export type TtsSynthesizeOptions = {
  /** Reserved for providers that can abort an in-flight request (Puter.js does not). */
  signal?: AbortSignal;
  language?: string;
};

export type TtsSynthesis = {
  audio: HTMLAudioElement;
  dispose: () => void;
};

export type TtsSynthesizer = (text: string, options?: TtsSynthesizeOptions) => Promise<TtsSynthesis>;
