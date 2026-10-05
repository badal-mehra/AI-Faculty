"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { synthesizeSpeech } from "./providers";
import type { TtsSynthesis } from "./providers/types";

export type VoiceStatus = "idle" | "loading" | "speaking" | "paused" | "error";
export type QueuedSpeech = { lessonId: string; stepId: number; text: string; language?: string };

export type TeacherVoice = {
  speak: (text: string, language?: string) => Promise<void>;
  enqueue: (speech: QueuedSpeech) => void;
  prefetch: (speech: QueuedSpeech[]) => void;
  playQueued: (lessonId: string, stepId: number) => Promise<void>;
  cancelQueued: (lessonId: string, fromStep?: number) => void;
  clearQueue: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => Promise<void>;
  status: VoiceStatus;
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
};

export type TeacherVoiceOptions = { onEnded?: (stepId?: number) => void };
const isBrowser = typeof window !== "undefined";
const queueKey = (lessonId: string, stepId: number) => `${lessonId}:${stepId}`;

/**
 * How long any single voice operation may take before the lesson stops waiting for it.
 *
 * Every await in this hook is a promise from a provider or from the browser's media stack, and every one
 * of them can hang: a TTS endpoint that never answers, an audio resource that never loads, or `play()`
 * returning a promise that never settles — which is exactly what a blocked autoplay policy does. A hook
 * with an unbounded await has no failure path, so the status stays `loading` forever, the step's `ended`
 * event never arrives, and the lesson stops dead on that step with no way forward for the student.
 *
 * A timeout is not a fallback that guesses; it releases the audio, reports the voice as unavailable, and
 * lets the explanation stand on screen as text, which is what a silent lesson is.
 */
const VOICE_OPERATION_TIMEOUT_MS = 15000;

/** Rejects with `message` if `promise` has not settled within `ms`. */
function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

type QueueItem = QueuedSpeech & {
  key: string;
  status: "queued" | "generating" | "ready" | "playing" | "completed";
  synthesis?: TtsSynthesis;
};

export function useTeacherVoice(options: TeacherVoiceOptions = {}): TeacherVoice {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const queueRef = useRef(new Map<string, QueueItem>());
  const cacheRef = useRef(new Map<string, TtsSynthesis>());
  const drainRunningRef = useRef(false);
  const queueGenerationRef = useRef(0);
  const currentKeyRef = useRef<string | null>(null);
  const onEndedRef = useRef<((stepId?: number) => void) | null>(options.onEnded ?? null);

  useEffect(() => { onEndedRef.current = options.onEnded ?? null; });

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try { audio.pause(); } catch { /* ignore */ }
      audio.removeAttribute("src");
      try { audio.load(); } catch { /* ignore */ }
      audioRef.current = null;
    }
    const dispose = disposeRef.current;
    if (dispose) {
      disposeRef.current = null;
      try { dispose(); } catch { /* ignore */ }
    }
    currentKeyRef.current = null;
  }, []);

  const clearQueue = useCallback(() => {
    queueGenerationRef.current += 1;
    for (const item of queueRef.current.values()) item.synthesis?.dispose();
    queueRef.current.clear();
    cacheRef.current.clear();
  }, []);

  const drainQueue = useCallback(async () => {
    if (drainRunningRef.current || !isBrowser) return;
    drainRunningRef.current = true;
    try {
      while (true) {
        const item = Array.from(queueRef.current.values()).find((candidate) => candidate.status === "queued");
        if (!item) return;
        item.status = "generating";
        const generation = queueGenerationRef.current;
        // Synthesis is bounded: a provider that never answers must not leave this item pending forever,
        // because `playQueued` is waiting on it.
        const controller = new AbortController();
        const deadline = setTimeout(() => controller.abort(), VOICE_OPERATION_TIMEOUT_MS);
        try {
          const synthesis = await synthesizeSpeech(item.text, { signal: controller.signal, language: item.language });
          if (generation !== queueGenerationRef.current || queueRef.current.get(item.key) !== item) { synthesis.dispose(); continue; }
          item.synthesis = synthesis;
          item.status = "ready";
          cacheRef.current.set(item.key, synthesis);
        } catch (caught) {
          if (generation === queueGenerationRef.current && queueRef.current.get(item.key) === item) {
            item.status = "completed";
            setError(caught instanceof Error ? caught.message : "The teacher voice is unavailable right now.");
          }
        } finally {
          clearTimeout(deadline);
        }
      }
    } finally {
      drainRunningRef.current = false;
    }
  }, []);

  const enqueue = useCallback((speech: QueuedSpeech) => {
    if (!speech.text.trim()) return;
    const key = queueKey(speech.lessonId, speech.stepId);
    if (queueRef.current.has(key)) return;
    queueRef.current.set(key, { ...speech, key, status: "queued" });
    void drainQueue();
  }, [drainQueue]);

  const prefetch = useCallback((speech: QueuedSpeech[]) => {
    speech.slice(0, 4).forEach(enqueue);
  }, [enqueue]);

  const startSynthesis = useCallback(async (text: string, id: number, controller: AbortController, item?: QueueItem, cachedSynthesis?: TtsSynthesis, language?: string) => {
    const synthesis = cachedSynthesis ?? await synthesizeSpeech(text, { signal: controller.signal, language });
    if (id !== requestIdRef.current) { synthesis.dispose(); return; }
    if (item) item.status = "playing";
    disposeRef.current = synthesis.dispose;
    const audio = synthesis.audio;
    audioRef.current = audio;
    audio.onended = () => {
      if (id !== requestIdRef.current) return;
      if (item) { item.status = "completed"; cacheRef.current.delete(item.key); }
      releaseAudio();
      setStatus("idle");
      onEndedRef.current?.(item?.stepId);
    };
    audio.onerror = () => {
      if (id === requestIdRef.current) { if (item) item.status = "completed"; releaseAudio(); setStatus("error"); setError("Voice playback failed in this browser."); }
    };
    await withDeadline(audio.play(), VOICE_OPERATION_TIMEOUT_MS, "The teacher voice did not start in this browser.");
    if (id === requestIdRef.current) setStatus("speaking");
  }, [releaseAudio]);

  const playQueued = useCallback(async (lessonId: string, stepId: number) => {
    const key = queueKey(lessonId, stepId);
    const item = queueRef.current.get(key);
    if (!item) return;
    if (item.status === "generating" || item.status === "queued") {
      // Bounded wait. Waiting for a synthesis that will never arrive is what froze a lesson mid-way.
      const giveUpAt = Date.now() + VOICE_OPERATION_TIMEOUT_MS;
      await new Promise<void>((resolve) => {
        const check = () => {
          const current = queueRef.current.get(key);
          if (!current || current.status === "ready" || current.status === "completed" || Date.now() > giveUpAt) resolve();
          else window.setTimeout(check, 20);
        };
        check();
      });
    }
    const ready = queueRef.current.get(key);
    if (!ready || ready.status !== "ready" || !ready.synthesis) {
      if (ready?.status !== "completed") {
        const item_ = ready;
        if (item_) item_.status = "completed";
        setError("The teacher voice is unavailable right now.");
      }
      setStatus("error");
      return;
    }
    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    releaseAudio();
    currentKeyRef.current = key;
    setError(null);
    setStatus("loading");
    await startSynthesis(ready.text, id, new AbortController(), ready, ready.synthesis);
  }, [releaseAudio, startSynthesis]);

  const cancelQueued = useCallback((lessonId: string, fromStep = 0) => {
    for (const [key, item] of queueRef.current) {
      if (item.lessonId === lessonId && item.stepId >= fromStep && key !== currentKeyRef.current) {
        item.synthesis?.dispose();
        cacheRef.current.delete(key);
        queueRef.current.delete(key);
      }
    }
  }, []);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    releaseAudio();
    clearQueue();
    setStatus("idle");
  }, [clearQueue, releaseAudio]);

  const speak = useCallback(async (text: string, language?: string) => {
    const trimmed = text?.trim() ?? "";
    if (!isBrowser || !trimmed) return;
    clearQueue();
    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    releaseAudio();
    setError(null);
    setStatus("loading");
    try {
      // `startSynthesis` is bounded on both sides (synthesis and playback), and a failure here is reported
      // rather than left pending, so the classroom's own synchronization watchdog can take over.
      await withDeadline(
        startSynthesis(trimmed, id, controller, undefined, undefined, language),
        VOICE_OPERATION_TIMEOUT_MS * 2,
        "The teacher voice did not start in this browser.",
      );
    }
    catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (id !== requestIdRef.current) return;
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "The teacher voice is unavailable right now.");
    }
  }, [clearQueue, releaseAudio, startSynthesis]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused && !audio.ended) { audio.pause(); setStatus("paused"); }
  }, []);

  const resume = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    try { await audio.play(); setStatus("speaking"); }
    catch (caught) { setStatus("error"); setError(caught instanceof Error ? caught.message : "Voice playback failed in this browser."); }
  }, []);

  useEffect(() => () => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    clearQueue();
    releaseAudio();
  }, [clearQueue, releaseAudio]);

  return { speak, enqueue, prefetch, playQueued, cancelQueued, clearQueue, stop, pause, resume, status, isSpeaking: status === "speaking", isLoading: status === "loading", error };
}
