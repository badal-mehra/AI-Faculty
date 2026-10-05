"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Visualizer, VisualMode } from "./visual/Visualizer";
import { VisualModePicker } from "./visual/VisualModePicker";
import { StarterTopics } from "./visual/StarterTopics";
import { StepRail } from "./visual/StepRail";
import { useTeacherVoice } from "@/lib/tts/useTeacherVoice";
import { executeBoardActions, getBoardState } from "@/lib/board/engine";
import { BoardAction, BoardState, emptyBoardState } from "@/lib/board/types";
import { applyVisualActions, getVisualScene, settleVisualScene } from "@/lib/visual/engine";
import { parseVisualActions } from "@/lib/visual/validate";
import { composeScene, compositionLogLine } from "@/lib/visual/composition";
import { VisualScene, emptyVisualScene } from "@/lib/visual/types";
import { detectRepresentationIntent } from "@/lib/teaching/representation";
import { applyVisual3DActions, getVisual3DScene } from "@/lib/visual3d/engine";
import { Visual3DScene, emptyVisual3DScene } from "@/lib/visual3d/types";
import { TEACHING_LANGUAGES, TeachingLanguage, TeachingLessonResponse, TeachingResponse } from "@/lib/teaching/types";
import type { LessonProgressView } from "@/lib/teaching/objective";
import { deriveLessonState } from "@/lib/teaching/objective";

// SAFETY cap only. A deep lesson is as long as its objective requires; this bound exists so a
// provider that never advances cannot loop forever, and it is never a length target.
const MAX_CONTINUOUS_STEPS = 80;

// User-facing messages only. Provider/validation details never reach the student.
const START_FAILURE_MESSAGE = "Couldn't start the lesson. Please try again.";
const FOLLOW_UP_FAILURE_MESSAGE = "Couldn't answer that right now. Please try again.";

/**
 * SYNCHRONIZATION TIMINGS.
 *
 * `VOICE_START_TIMEOUT_MS` is how long the teacher's voice may stay silent after a step appears before we
 * conclude it is not going to speak at all in this browser. It is short on purpose: the explanation is
 * already rendered as text, so waiting longer only keeps the student looking at one step.
 * `VOICE_QUIET_TIMEOUT_MS` is the backstop for audio that starts and then stops reporting, and is sized
 * for the longest speech the prompt asks for plus generous margin for a slow voice.
 */
const WATCHDOG_TICK_MS = 2000;
const VOICE_START_TIMEOUT_MS = 8000;
const VOICE_LOADING_TIMEOUT_MS = 30000;
const VOICE_QUIET_TIMEOUT_MS = 75000;

export function Classroom() {
  const [board, setBoard] = useState(emptyBoardState);
  const [visualScene, setVisualScene] = useState<VisualScene>(emptyVisualScene);
  const [visual3dScene, setVisual3dScene] = useState<Visual3DScene>(emptyVisual3DScene);
  const [visualMode, setVisualMode] = useState<VisualMode>("auto");
  // The stage the PIPELINE chose, learned from the first batch. Auto must not decide this by asking
  // "has any step so far contained a 3D action": that test flips mid-lesson, and a lesson that switched
  // stages left the student looking at an empty viewport while its finished diagram sat behind it.
  const [lessonRepresentation, setLessonRepresentation] = useState<"2d" | "3d" | null>(null);
  // Has the student CHOSEN a view themselves? Once they have, that choice is authoritative and is
  // never second-guessed — neither by the words in their question nor by the asset catalogue. It is
  // also a preference, so it survives "Start a new lesson" rather than silently reverting to Auto.
  const [visualModeChosen, setVisualModeChosen] = useState(false);
  // What the teacher is pointing at right now (set by clicking an object). Everything else subdues.
  const [visualFocusId, setVisualFocusId] = useState<string | null>(null);
  const [speech, setSpeech] = useState("");
  const [question, setQuestion] = useState("");
  const [activeQuestion, setActiveQuestion] = useState("");
  const [language, setLanguage] = useState<TeachingLanguage>("English");
  const [studentQuestion, setStudentQuestion] = useState("");
  const [lessonStep, setLessonStep] = useState(1);
  // Mirrors `activeLessonStepRef` in state so the step controls re-render when the lesson moves. Reading
  // the ref during render would work only because every step change happens to set some other state.
  const [activeStepNumber, setActiveStepNumber] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Question availability is INDEPENDENT of lesson playback: the student can ask while a lesson
  // plays and after it completes, as long as the session (lessonStarted) still exists.
  const [askInFlight, setAskInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continuousTeaching, setContinuousTeaching] = useState(false);
  const [lessonStarted, setLessonStarted] = useState(false);
  // The teacher stopped adding steps. Whether the LESSON is finished is derived, not set here.
  const [teacherFinished, setTeacherFinished] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  // Objective-based lesson state, owned by the server: the planned stages, the ones already taught
  // and whether the topic has actually been covered. The UI never infers completion itself.
  const [progress, setProgress] = useState<LessonProgressView | null>(null);

  const stepRequestIdRef = useRef(0);
  const askRequestIdRef = useRef(0);
  const askInFlightRef = useRef(false);
  const inFlightIdRef = useRef<number | null>(null);
  const continuousRef = useRef(false);
  const continuousStepCountRef = useRef(0);
  const advanceRef = useRef<() => void>(() => {});
  const lessonIdRef = useRef("lesson-0");
  const lessonStepsRef = useRef(new Map<number, TeachingResponse>());
  // Scene state immediately BEFORE each step, and immediately AFTER it. A lesson step's actions are
  // INCREMENTAL — re-applying one to a scene it already built duplicates its objects — so replay and
  // "go back" restore a snapshot and then re-apply, rather than re-applying onto the current scene.
  // That makes replay exact and structurally incapable of duplicating a shape.
  const sceneBeforeStepRef = useRef(new Map<number, { board: BoardState; visual: VisualScene; visual3d: Visual3DScene }>());
  const sceneAfterStepRef = useRef(new Map<number, { board: BoardState; visual: VisualScene; visual3d: Visual3DScene }>());
  const activeLessonStepRef = useRef<number | null>(null);
  // A replay restores the pre-step scene now and re-applies the step on the next commit, so the step is
  // applied to its own starting scene rather than to the one it already built.
  const pendingReplayRef = useRef<TeachingResponse | null>(null);
  const progressRef = useRef<LessonProgressView | null>(null);
  const questionRef = useRef("");
  const languageRef = useRef<TeachingLanguage>("English");
  // Read inside request callbacks, which capture an empty dependency list on purpose: they must always
  // see the CURRENT mode, not the one they closed over.
  const visualModeRef = useRef<VisualMode>("auto");
  visualModeRef.current = visualMode;
  // Set while an INTERRUPTION's answer is being applied, so the objects it adds are marked temporary and
  // leave the board when the lesson resumes. Without this the answer's diagram stays for the rest of the
  // lesson, which is how a two-second aside about tau ends up sitting beside the numerical substitution.
  const temporarilyRef = useRef(false);
  const teachingHistoryRef = useRef<string[]>([]);
  // SPEECH / STEP SYNCHRONIZATION WATCHDOG.
  //
  // Progression used to depend entirely on the teacher's audio reporting `ended`. When that event never
  // arrives — autoplay blocked, no audio device, the voice service failing, or simply a step whose audio
  // never fires — the lesson stops dead: `continuousTeaching` is still true, so the Continue button stays
  // hidden and the student is left looking at step one with no way forward. Holding a whole lesson
  // hostage to an audio event is the defect this removes.
  //
  // Two thresholds, because "the voice never started" and "the voice finished but the event was lost" are
  // different failures with different correct responses.
  const watchdogRef = useRef<{ step: number | null; startedAt: number; voiceStartedAt: number }>({ step: null, startedAt: 0, voiceStartedAt: 0 });
  // `onEnded` fires only for the CURRENT teacher audio and drives continuous progression.
  const { speak: speakTeacher, prefetch: prefetchTeacher, playQueued: playQueuedTeacher, stop: stopTeacher, pause: pauseTeacher, resume: resumeTeacher, status: voiceStatus, error: voiceError } = useTeacherVoice({ onEnded: () => advanceRef.current() });

  const executeActions = useCallback((actions: BoardAction[]) => setBoard((current) => executeBoardActions(current, actions)), []);

  // End automatic progression: `complete` = the objective says the topic is covered, `limit` = safety
  // cap, `stop` = user pressed Stop (or a teaching step failed).
  //
  // "Complete" here means the TEACHER is finished, not the student. Whether the LESSON is finished is
  // derived from the objective AND the steps still in hand, below, so the two can never disagree.
  const endContinuous = useCallback((reason: "complete" | "limit" | "stop") => {
    continuousRef.current = false;
    continuousStepCountRef.current = 0;
    setContinuousTeaching(false);
    if (reason === "complete") setTeacherFinished(true);
    if (reason === "limit") setLimitReached(true);
  }, []);

  // Play a lesson step that is already cached locally (no network round-trip per step).
  /**
   * How far the lesson has advanced, which is what the visual lifecycle measures staleness against.
   *
   * Deliberately the number of stages the objective says are TAUGHT rather than the stage the provider
   * labelled this step with. The declared id is the provider's bookkeeping and it repeats: a real
   * Newton's-law run declared `s1 prerequisite` on steps 7, 13, 14 and 15, so a stage index taken from it
   * walked backwards and nothing ever went stale. The objective's own progress is monotone, and it is the
   * thing the gate retires against.
   */
  const stageIndexFor = useCallback((_lessonStep: number) => {
    const covered = progress?.coveredStageIds.length ?? 0;
    const declared = lessonStepsRef.current.get(_lessonStep)?.stage_id;
    const stages = progress?.stages ?? [];
    const declaredIndex = declared ? stages.findIndex((stage) => stage.id === declared) : -1;
    return Math.max(covered, declaredIndex);
  }, [progress]);

  const playStoredLessonStep = useCallback((step: TeachingResponse) => {
    const lessonId = lessonIdRef.current;
    activeLessonStepRef.current = step.lesson_step;
    setActiveStepNumber(step.lesson_step);
    // A lesson step always resumes a clean lesson: the interruption's temporary objects belong to the
    // aside, not to the lesson, and this is the moment they go.
    temporarilyRef.current = false;    // Arm the synchronization watchdog for this step. It is the only thing that can move the lesson on
    // when the audio never reports `ended`.
    watchdogRef.current = { step: step.lesson_step, startedAt: Date.now(), voiceStartedAt: 0 };
    setSpeech(step.speech);
    teachingHistoryRef.current = [...teachingHistoryRef.current, step.speech].slice(-12);
    setLessonStep(step.next_step);
    // Snapshot BEFORE, so Replay and "go back" always have the exact scene this step was built on.
    sceneBeforeStepRef.current.set(step.lesson_step, { board, visual: visualScene, visual3d: visual3dScene });
    setBoard((current) => executeBoardActions(current, step.board_actions));
    // The board applies a step's actions in one atomic scene update, and the step's own timeline decides
    // WHEN each animation starts. Nothing here schedules a timer, so the next step can replace the
    // scene at any moment and the in-flight motion simply stops where it is.
    //
    // The visual context is what makes the board stop being a history: it tells the engine which lesson
    // step and which objective stage this content belongs to, and the lifecycle uses the difference to
    // retire what has stopped being relevant BEFORE laying out what is current.
    //
    // COMPOSITION runs on the result. The lifecycle decides what is stale; composition decides how much may
    // be on screen and whether what remains is actually about this step. Without it the board grows until
    // everything is equally loud, which is how a lesson ends with 57 of its 58 objects belonging to steps
    // the teacher passed three minutes ago.
    setVisualScene((current) => {
      const played = applyVisualActions(current, step.visual_actions, {
        step: step.lesson_step,
        stage: stageIndexFor(step.lesson_step),
        ...(temporarilyRef.current ? { temporary: true } : {}),
      });
      const parsed = parseVisualActions(step.visual_actions);
      if (!parsed) return played;
      const composed = composeScene(played, parsed, {
        step: step.lesson_step,
        stage: stageIndexFor(step.lesson_step),
        ...(step.teaching_intent ? { teachingIntent: step.teaching_intent } : {}),
        ...(temporarilyRef.current ? { temporary: true } : {}),
      });
      console.info(compositionLogLine(composed.diagnostics));
      return composed.scene;
    });
    setVisual3dScene((current) => applyVisual3DActions(current, step.visual3d_actions ?? []));
    const storedSteps = Array.from(lessonStepsRef.current.values()).filter((candidate) => candidate.lesson_step >= step.next_step).slice(0, 3);
    prefetchTeacher(storedSteps.map((candidate) => ({ lessonId, stepId: candidate.lesson_step, text: candidate.speech, language: languageRef.current })));
    void playQueuedTeacher(lessonId, step.lesson_step);
    // A batch that repeats its own step number used to mean "the topic is finished". It no longer
    // does: the batch is not the lesson. Automatic progression continues (advanceContinuous simply
    // asks for the next batch) until the objective says the topic has been covered.
  }, [board, playQueuedTeacher, prefetchTeacher, visual3dScene, visualScene]);

  // Capture the scene a step produced. Runs after React has committed it, which is the only moment the
  // post-step state actually exists.
  useEffect(() => {
    const step = activeLessonStepRef.current;
    if (step === null) return;
    sceneAfterStepRef.current.set(step, { board, visual: visualScene, visual3d: visual3dScene });
  }, [board, visual3dScene, visualScene]);

  // A replay is applied once the restored scene has been committed.
  useEffect(() => {
    const pending = pendingReplayRef.current;
    if (!pending) return;
    pendingReplayRef.current = null;
    playStoredLessonStep(pending);
  }, [playStoredLessonStep, board, visual3dScene, visualScene]);

  // BACK / FORWARD through the steps that have actually been delivered. Moving backwards restores the
  // scene that step produced, so the student sees the board as it was — not the current board minus
  // objects, which is the only way "undo" corrupts a diagram.
  const goToStep = useCallback((delta: -1 | 1) => {
    const current = activeLessonStepRef.current;
    if (current === null) return;
    if (delta === -1) {
      const previous = sceneAfterStepRef.current.get(current - 1);
      const stored = lessonStepsRef.current.get(current - 1);
      if (!previous || !stored) return;
      stopTeacher();
      setBoard(previous.board);
      setVisualScene(previous.visual);
      setVisual3dScene(previous.visual3d);
      activeLessonStepRef.current = current - 1;
      setActiveStepNumber(current - 1);
      setSpeech(stored.speech);
      setLessonStep(current);
      void playQueuedTeacher(lessonIdRef.current, current - 1);
      return;
    }
// FORWARD is available as soon as the next step EXISTS, not only once it has been played. A lesson is
    // delivered as a batch and cached locally, so the step after this one is already in hand — but Next
    // used to be disabled until the teacher had finished speaking it, which made the control useless in
    // precisely the situation it exists for: a student who has understood and wants to keep moving.
    // A step that has already been played is restored from its snapshot; one that has not is applied to
    // the current scene, which is exactly where it would have started.
    const next = sceneBeforeStepRef.current.get(current + 1) ?? { board, visual: visualScene, visual3d: visual3dScene };
    const stored = lessonStepsRef.current.get(current + 1);
    if (!stored) return;
    stopTeacher();
    if (sceneBeforeStepRef.current.has(current + 1)) {
      setBoard(next.board);
      setVisualScene(next.visual);
      setVisual3dScene(next.visual3d);
      activeLessonStepRef.current = current + 1;
      setActiveStepNumber(current + 1);
      setSpeech(stored.speech);
      setLessonStep(stored.next_step);
      void playQueuedTeacher(lessonIdRef.current, current + 1);
      return;
    }
    playStoredLessonStep(stored);
  }, [board, playQueuedTeacher, playStoredLessonStep, stopTeacher, visual3dScene, visualScene]);

  // Navigating by hand takes the lesson off autopilot: the student chose to look at something, so
  // nothing advances underneath them until they say continue.
  const navigateSteps = useCallback((delta: -1 | 1) => {
    endContinuous("stop");
    goToStep(delta);
  }, [endContinuous, goToStep]);

  const canGoBack = activeStepNumber !== null && sceneAfterStepRef.current.has(activeStepNumber - 1);
  const canGoForward = activeStepNumber !== null && lessonStepsRef.current.has(activeStepNumber + 1);
  const canReplay = activeStepNumber !== null && sceneBeforeStepRef.current.has(activeStepNumber);

  // THE lesson STATE — one derivation, used by every control and every note below.
  const deliveredSteps = Math.max(0, ...Array.from(lessonStepsRef.current.keys()));
  const lessonState = deriveLessonState({
    progress: progressRef.current ?? progress,
    deliveredSteps,
    activeStep: activeStepNumber,
  });

  // REPLAY: re-run the current step from the exact scene it started on. Nothing is fetched, no lesson
  // state moves, and the animations play again — so a student who missed a packet travelling, a
  // comparison being made, or a recursion unwinding can simply watch it happen again.
  const replayCurrentStep = useCallback(() => {
    const step = activeLessonStepRef.current;
    if (step === null) return;
    const stored = lessonStepsRef.current.get(step);
    const before = sceneBeforeStepRef.current.get(step);
    if (!stored || !before) return;
    stopTeacher();
    setBoard(before.board);
    setVisualScene(before.visual);
    setVisual3dScene(before.visual3d);
    // Let the restore land before re-applying, so the step is applied to its own starting scene.
    pendingReplayRef.current = stored;
  }, [stopTeacher]);

  // Fetch a BATCH of lesson steps from /api/teaching/lesson and start playing the first one.
  // `starting` begins a brand new lesson (fresh board, step 1); otherwise it continues from the
  // current board + step (used for the next batch and for a mid-lesson language change).
  const requestTeachingLesson = useCallback(async (starting = false) => {
    const requestId = stepRequestIdRef.current + 1;
    stepRequestIdRef.current = requestId;
    inFlightIdRef.current = requestId;
    const boardState = getBoardState(starting ? emptyBoardState() : board);
    const visualState = getVisualScene(starting ? emptyVisualScene() : visualScene);
    const visualState3d = getVisual3DScene(starting ? emptyVisual3DScene() : visual3dScene);
    const step = starting ? 1 : (activeLessonStepRef.current ?? lessonStep);
    if (starting) { setBoard(emptyBoardState()); setVisualScene(emptyVisualScene()); setVisual3dScene(emptyVisual3DScene()); setLessonStep(1); }
    stopTeacher();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/teaching/lesson", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // The student's explicit choice of stage travels with EVERY request, including the interruption. It is
      // a request field because the buttons are a decision made after the question was typed: "Explain
      // the heart" followed by pressing 2D is an instruction the question text cannot express, and
      // re-reading the text silently discarded it.
      body: JSON.stringify({ question: questionRef.current, language: languageRef.current, lessonStep: step, boardState, visualState, visualState3d, previousTeaching: teachingHistoryRef.current, lessonProgress: progressRef.current, representationIntent: visualModeRef.current === "auto" ? null : visualModeRef.current }),
      });
      const payload: TeachingLessonResponse | { error: string; message?: string } = await response.json();
      if (!response.ok || !("steps" in payload) || !Array.isArray(payload.steps) || payload.steps.length === 0) {
        if (stepRequestIdRef.current !== requestId) return;
        throw new Error(START_FAILURE_MESSAGE);
      }
      // A batch that arrives after the student pressed Stop is CACHED, not played.
      //
      // Stop means "do not start anything else", not "throw away the teaching you already paid for".
      // Discarding the response is what made a long lesson — an RC transient response needs eight
      // batches — come back with the server having taught six stages and the classroom believing it had
      // taught none, because every batch that landed during a Stop was thrown away and the lesson had to
      // re-fetch. Caching first and playing second keeps the guarantee Stop actually promises.
      lessonIdRef.current = `lesson-${requestId}`;
      lessonStepsRef.current = new Map(payload.steps.map((item) => [item.lesson_step, item]));
      // The server owns the objective and reports what it covered. The classroom trusts that, and
      // nothing else, when deciding whether the topic has been taught.
      if (payload.progress) {
        progressRef.current = payload.progress;
        setProgress(payload.progress);
      }
      // Stopped, superseded or restarted: the teaching above is kept, and nothing below plays it.
      if (stepRequestIdRef.current !== requestId) return;
      if (payload.progress?.complete) endContinuous("complete");
      const first = payload.steps[0];
      // Learn the stage ONCE, from the batch that defines the lesson, and keep it. An explicit choice
      // the student made still wins; the pipeline's decision only speaks in Auto, where the student
      // expressed no preference of their own.
      const declared = payload.steps.find((item) => item.representation)?.representation ?? null;
      if (declared && visualMode === "auto") setLessonRepresentation(declared);
      prefetchTeacher(payload.steps.slice(0, 4).map((item) => ({ lessonId: lessonIdRef.current, stepId: item.lesson_step, text: item.speech, language: languageRef.current })));
      playStoredLessonStep(first);
    } catch {
      if (stepRequestIdRef.current !== requestId) return;
      endContinuous("stop");
      // A failed FIRST request returns the student to the setup form so they can retry.
      if (starting) setLessonStarted(false);
      setError(START_FAILURE_MESSAGE);
    } finally {
      if (inFlightIdRef.current === requestId) inFlightIdRef.current = null;
      if (stepRequestIdRef.current === requestId) setIsLoading(false);
    }
  }, [board, visualScene, visual3dScene, endContinuous, lessonStep, playStoredLessonStep, prefetchTeacher, stopTeacher]);

  // Advance a continuous lesson when the CURRENT teacher audio actually finishes (the `ended`
  // event) — never on a timer, and never for stale audio.
  const advanceContinuous = useCallback(() => {
    if (!continuousRef.current) return;
    if (continuousStepCountRef.current >= MAX_CONTINUOUS_STEPS) { endContinuous("limit"); return; }
    const currentStep = activeLessonStepRef.current;
    const nextStep = currentStep === null ? null : lessonStepsRef.current.get(currentStep)?.next_step;
    if (nextStep !== null && nextStep !== undefined) {
      const stored = lessonStepsRef.current.get(nextStep);
      if (stored) {
        continuousStepCountRef.current += 1;
        playStoredLessonStep(stored);
        return;
      }
    }
// ONE batch in flight at a time.
//
// Without this, an `ended` event and a Continue press could both ask for the next batch. Two concurrent
// lesson requests means the EARLIER response is discarded as stale when it arrives — a whole batch of
// generated teaching thrown away — and the classroom is left showing progress that is several steps behind
// what the server has already taught, with no completion note and no way for the student to tell.
if (inFlightIdRef.current !== null) return;
continuousStepCountRef.current += 1;
void requestTeachingLesson();
}, [requestTeachingLesson, endContinuous, playStoredLessonStep]);
  useEffect(() => { advanceRef.current = advanceContinuous; }, [advanceContinuous]);

  // THE SYNCHRONIZATION CHECKPOINT.
  //
  // While a lesson is playing, the voice's own `ended` event is what normally moves it on. This is the
  // fallback for when that event cannot be trusted, and it advances exactly once per step:
  //   * the voice never became active within a few seconds — the voice is not available here, and the
  //     explanation is already on screen as text, so the lesson must keep going;
  //   * the voice started and then went quiet for longer than a paragraph of speech could reasonably take.
  // Pausing (teacher paused, student paused) resets the clock, so a paused lesson never advances itself.
  useEffect(() => {
    if (!continuousTeaching) return;
    const timer = setInterval(() => {
      const watchdog = watchdogRef.current;
      const step = activeLessonStepRef.current;
      if (step === null || watchdog.step !== step || watchdog.startedAt === 0) return;
      // A paused lesson must never advance itself: the student pressed pause, so the clock restarts when
      // they press play rather than firing while they are reading.
      if (voiceStatus === "paused") {
        watchdog.startedAt = Date.now();
        watchdog.voiceStartedAt = 0;
        return;
      }
      if (voiceStatus === "speaking") {
        if (watchdog.voiceStartedAt === 0) watchdog.voiceStartedAt = Date.now();
        return;
      }
      const now = Date.now();
      const sinceStart = now - watchdog.startedAt;
      const sinceVoice = watchdog.voiceStartedAt > 0 ? now - watchdog.voiceStartedAt : 0;
      const voiceUnavailable = watchdog.voiceStartedAt === 0 && sinceStart >= VOICE_START_TIMEOUT_MS;
      // A voice stuck in `loading` is a provider that is not going to deliver. It gets a longer budget
      // than a voice that never started at all — synthesis legitimately takes a while — but not an
      // unlimited one, because an unbounded wait is how a lesson froze mid-sentence with no way forward.
      const voiceStuckLoading = voiceStatus === "loading" && sinceStart >= VOICE_LOADING_TIMEOUT_MS;
      const voiceWentQuiet = watchdog.voiceStartedAt > 0 && sinceVoice >= VOICE_QUIET_TIMEOUT_MS;
      if (!voiceUnavailable && !voiceStuckLoading && !voiceWentQuiet) return;
      // Mark it as handled BEFORE advancing, so the audio event that may still arrive cannot advance twice.
      watchdogRef.current = { step, startedAt: 0, voiceStartedAt: 0 };
      advanceContinuous();
    }, WATCHDOG_TICK_MS);
    return () => clearInterval(timer);
  }, [advanceContinuous, continuousTeaching, voiceStatus]);

  const continueTeaching = useCallback(() => {
    const wasActive = continuousRef.current;
    continuousRef.current = true;
    continuousStepCountRef.current = 0;
    setContinuousTeaching(true);
    if (!wasActive) { setTeacherFinished(false); setLimitReached(false); setError(null); }
    // Pull the next step now only when nothing is pending: if Puter audio is loading/playing or
    // paused, the `ended` event advances the lesson; if the voice failed, the student retries with
    // Play so the lesson is never silently skipped.
    if (voiceStatus === "idle" && inFlightIdRef.current === null) {
      continuousStepCountRef.current = 1;
      if (lessonStepsRef.current.size === 0) void requestTeachingLesson();
      else {
        const nextStep = activeLessonStepRef.current === null ? null : lessonStepsRef.current.get(activeLessonStepRef.current)?.next_step;
        const stored = nextStep === null || nextStep === undefined ? undefined : lessonStepsRef.current.get(nextStep);
        if (stored) playStoredLessonStep(stored);
        else void requestTeachingLesson();
      }
    }
  }, [playStoredLessonStep, requestTeachingLesson, voiceStatus]);

  const stopTeaching = useCallback(() => {
    endContinuous("stop");
    // Invalidate any in-flight teaching request so a late step can never start after Stop.
    stepRequestIdRef.current += 1;
    inFlightIdRef.current = null;
    stopTeacher();
  }, [endContinuous, stopTeacher]);


  const chooseVisualMode = useCallback((next: VisualMode) => {
    setVisualMode(next);
    setVisualModeChosen(next !== "auto");
  }, []);

  const startTeaching = useCallback(() => {
    const nextQuestion = question.trim();
    if (!nextQuestion) { setError("Enter a question or topic before starting the lesson."); return; }
    questionRef.current = nextQuestion;
    setActiveQuestion(nextQuestion);
    teachingHistoryRef.current = [];
    endContinuous("stop");
    continuousRef.current = true;
    continuousStepCountRef.current = 0;
    setContinuousTeaching(true);
    setTeacherFinished(false);
    setLimitReached(false);
    setLessonStarted(true);
    // HONOUR AN EXPLICIT REPRESENTATION REQUEST. If the student said "draw", "on the board", "2D
    // diagram", "whiteboard" or "flowchart", the board is pinned to 2D BEFORE the first step is asked
    // for, so an asset catalogue can never decide the representation for them. An explicit 3D request
    // routes the other way, and silence leaves the teacher to choose.
    //
    // A view the student CHOSE ON SCREEN always outranks their wording. Their typing is a guess about
    // a topic they may not have named precisely; the button is the deliberate signal, and quietly
    // overriding it is how a student who asked for 3D ends up watching a 2D diagram with no way to
    // tell why.
    const intent = detectRepresentationIntent(nextQuestion);
    if (!visualModeChosen) {
      if (intent === "2d") setVisualMode("2d");
      else if (intent === "3d") setVisualMode("3d");
    }
    // A new question means a new objective: the old plan and its coverage never carry over.
    progressRef.current = null;
    setProgress(null);
    void requestTeachingLesson(true);
  }, [endContinuous, question, requestTeachingLesson, visualModeChosen]);

  // A starter topic is a complete question, so it goes through exactly the same path as a typed one —
  // including the view the student picked. Anything else would be a second, divergent way to start.
  const startWithTopic = useCallback((topic: string) => {
    setQuestion(topic);
    setError(null);
    questionRef.current = topic;
    setActiveQuestion(topic);
    teachingHistoryRef.current = [];
    endContinuous("stop");
    continuousRef.current = true;
    continuousStepCountRef.current = 0;
    setContinuousTeaching(true);
    setTeacherFinished(false);
    setLimitReached(false);
    setLessonStarted(true);
    const intent = detectRepresentationIntent(topic);
    if (!visualModeChosen) {
      if (intent === "2d") setVisualMode("2d");
      else if (intent === "3d") setVisualMode("3d");
    }
    progressRef.current = null;
    setProgress(null);
    void requestTeachingLesson(true);
  }, [endContinuous, requestTeachingLesson, visualModeChosen]);

  const startNewLesson = useCallback(() => {
    stopTeaching();
    activeLessonStepRef.current = null;
    lessonStepsRef.current = new Map();
    teachingHistoryRef.current = [];
    progressRef.current = null;
    setProgress(null);
    setSpeech("");
    setVisualScene(emptyVisualScene());
    setVisual3dScene(emptyVisual3DScene());
    // A view the student deliberately picked is a preference, not part of the lesson, so it stays.
    // Only an INFERRED view is dropped, because it was inferred from the question being replaced.
    if (!visualModeChosen) setVisualMode("auto");
    // A new lesson is a new stage decision, so the previous lesson's stage is forgotten.
    setLessonRepresentation(null);
    setVisualFocusId(null);
    setLessonStarted(false);
    setTeacherFinished(false);
    setLimitReached(false);
    setError(null);
  }, [stopTeaching, visualModeChosen]);

  // Explicit student interruption / follow-up.
  // Works DURING a lesson AND AFTER it completes, for as long as the lesson session still exists
  // (`lessonStarted`), which is independent of playback state. Asking SUPERSEDES any pending
  // lesson-batch fetch, so a slow background load can never block the student. `stopTeacher`
  // silences the current step, the diagram is never reset, the answer is applied + spoken, and
  // mid-lesson the lesson resumes from the same step.
  const askQuestion = useCallback(async () => {
    const interruption = studentQuestion.trim();
    if (!interruption || askInFlightRef.current || !lessonStarted) return;
    // INTERRUPTION: finish every in-flight board animation before the answer is applied. The student
    // gets a settled, complete drawing rather than a half-drawn arrow, and nothing is left running
    // behind the answer — the animation system stays consistent and the lesson can resume afterwards.
    setVisualScene((current) => settleVisualScene(current));
    // A dedicated request id: an in-flight LESSON request must be able to finish (or be discarded)
    // without ever being able to leave the Ask control stuck in its disabled state.
    const requestId = askRequestIdRef.current + 1;
    askRequestIdRef.current = requestId;
    askInFlightRef.current = true;
    setStudentQuestion("");
    // Supersede any in-flight lesson request so we can answer immediately (never block the student).
    stepRequestIdRef.current += 1;
    inFlightIdRef.current = null;
    const boardState = getBoardState(board);
    const visualState = getVisualScene(visualScene);
    const visualState3d = getVisual3DScene(visual3dScene);
    const step = activeLessonStepRef.current ?? lessonStep;
    stopTeacher();
    setIsLoading(false);
    setAskInFlight(true);
    setError(null);
    try {
      const response = await fetch("/api/teaching", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questionRef.current, language: languageRef.current, lessonStep: step, boardState, visualState, visualState3d, previousTeaching: teachingHistoryRef.current, studentQuestion: interruption }),
      });
      const payload: TeachingResponse | { error: string; message?: string } = await response.json();
      if (askRequestIdRef.current !== requestId) return;
      if (!response.ok || !("speech" in payload)) throw new Error(FOLLOW_UP_FAILURE_MESSAGE);
      // Show + speak the answer WITHOUT touching the lesson step, so the lesson is not restarted.
      setSpeech(payload.speech);
      teachingHistoryRef.current = [...teachingHistoryRef.current, payload.speech].slice(-8);
      setBoard((current) => executeBoardActions(current, payload.board_actions));
      // Interruptions may add to the diagram/3D scene but NEVER reset it (visual state is preserved).
      // What they add is TEMPORARY: it belongs to the aside, and the lifecycle removes it as soon as the
      // lesson resumes. The previous behaviour appended the answer's diagram permanently, so a two-second
      // aside about tau ended up sitting beside the numerical substitution for the rest of the lesson.
      temporarilyRef.current = true;
      setVisualScene((current) => {
        const played = applyVisualActions(current, payload.visual_actions, { step, stage: stageIndexFor(step), temporary: true });
        const parsed = parseVisualActions(payload.visual_actions);
        if (!parsed) return played;
        // An aside gets the same composition budget as a lesson step: a two-second answer may add a small
        // diagram, but it may not fill the board the lesson is using.
        const composed = composeScene(played, parsed, { step, stage: stageIndexFor(step), temporary: true });
        console.info(compositionLogLine(composed.diagnostics));
        return composed.scene;
      });
setVisual3dScene((current) => applyVisual3DActions(current, payload.visual3d_actions ?? []));
      // THE INTERRUPTION'S VISUALS ARE SCOPED TO THE INTERRUPTION.
      //
      // They are visible while the answer is being explained — the student asked, so the board answers —
      // and gone the moment the lesson moves on. Restoring the exact pre-interruption scene is what makes
      // "ask, get an answer, carry on" leave no mark on the lesson, rather than leaving the aside's
      // diagram sitting beside whatever comes next.
      if (step !== null) {
        const restore = () => {
          const before = sceneBeforeStepRef.current.get(step);
          if (!before) return;
          temporarilyRef.current = false;
          setBoard(before.board);
          setVisualScene(before.visual);
          setVisual3dScene(before.visual3d);
        };
        // If the lesson continues on its own, its next step restores the snapshot anyway; this covers the
        // case where the answer is the last thing spoken before the student does something else.
        if (!continuousRef.current) void speakTeacher(payload.speech, languageRef.current).then(restore);
        else void speakTeacher(payload.speech, languageRef.current);
      } else {
        void speakTeacher(payload.speech, languageRef.current);
      }
    } catch {
      if (askRequestIdRef.current !== requestId) return;
      setError(FOLLOW_UP_FAILURE_MESSAGE);
    } finally {
      if (askRequestIdRef.current === requestId) {
        askInFlightRef.current = false;
        setAskInFlight(false);
      }
    }
  }, [board, visual3dScene, lessonStarted, lessonStep, speakTeacher, stopTeacher, studentQuestion, visualScene]);

  // Changing the language stops the current speech but PRESERVES the board, topic and lesson step,
  // then continues from the current point in the newly selected language (never a restart).
  const changeLanguage = useCallback((nextLanguage: TeachingLanguage) => {
    languageRef.current = nextLanguage;
    setLanguage(nextLanguage);
    if (lessonStarted && activeLessonStepRef.current !== null) {
      stopTeacher();
      void requestTeachingLesson();
    }
  }, [lessonStarted, requestTeachingLesson, stopTeacher]);

  const togglePause = useCallback(() => {
    if (voiceStatus === "paused") void resumeTeacher();
    else if (voiceStatus === "speaking") pauseTeacher();
  }, [pauseTeacher, resumeTeacher, voiceStatus]);

  const paused = voiceStatus === "paused";

  // The student's note-taking aid: the plan the lesson is being taught against, with every stage
  // they have already been taught ticked. It exists so the student can see how far the lesson has to
  // go and write notes against the same outline the teacher is following.
  const outline = progress?.stages ?? [];
  const coveredStages = new Set(progress?.coveredStageIds ?? []);
  const lessonStepsTotal = Math.max(progress?.minSteps ?? 0, progress?.stepsDelivered ?? 0);

  // The stage actually on screen. In Auto the pipeline decides and the decision is remembered; an explicit
  // choice always wins, because the renderer still degrades upward on its own if a 2D request turns out to
  // have no 2D content at all, and it says so on screen when it does.
  const stageMode: VisualMode = visualMode !== "auto" ? visualMode : lessonRepresentation ?? "auto";
  return (
    <main className="classroom">
      <header className="topbar">
        <div className="brand-mark">A</div>
        <div className="brand-text"><strong>AI TEACHER</strong><span>Learn anything, step by step</span></div>
        {lessonStarted && <div className="lesson-chip" title={activeQuestion}><span className="live-dot" />{activeQuestion}</div>}
      </header>
      <div className={`lesson-layout${lessonStarted ? " is-teaching" : ""}`}>
        <div className="board-column">
           <Visualizer
            mode={stageMode}
            board={board}
            scene={visualScene}
            scene3d={visual3dScene}
            focusId={visualFocusId}
            onFocusObject={setVisualFocusId}
            onEraseBoard={(target) => executeActions([{ action: "erase", target }])}
            emptyStage={lessonStarted ? undefined : <StarterTopics onPick={startWithTopic} />}
          />
        </div>
        <aside className="teacher-panel">
          {!lessonStarted ? (
            <div className="teacher-setup">
              <div className="panel-brand">
                <div className="teacher-avatar">AI</div>
                <div><p className="panel-title">AI Teacher</p><p className="panel-subtitle">Your personal tutor</p></div>
              </div>
              <h1 className="panel-heading">What do you want to learn?</h1>
              <label className="field-label" htmlFor="lesson-question">Your question</label>
              <textarea id="lesson-question" className="lesson-textarea" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); startTeaching(); } }} placeholder="Explain photosynthesis..." rows={3} />
              <label className="field-label" htmlFor="lesson-language">Language</label>
              <select id="lesson-language" className="language-select" value={language} onChange={(event) => changeLanguage(event.target.value as TeachingLanguage)}>
                {TEACHING_LANGUAGES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              {/* The view is chosen BEFORE the lesson, not discovered during it. A student who wants a
                  rotating model must be able to say so while deciding what to ask, and must be able to
                  see what each option means without starting a lesson to find out. */}
              <VisualModePicker value={visualMode} onChange={chooseVisualMode} idPrefix="setup-visual-mode" />
              {error && <p className="teaching-error" role="alert">{error}</p>}
              <button className="primary-action" onClick={startTeaching} disabled={isLoading}>{isLoading ? "Starting…" : "Start Teaching"}</button>
              <p className="helper-text">I&apos;ll explain it step by step and you can interrupt me anytime.</p>
            </div>
          ) : (
            <div className="teacher-live">
<div className="live-head"><span className="live-dot" /><strong>AI TEACHER</strong><span className="live-lang">· {language.toUpperCase()}</span></div>
              <VisualModePicker value={visualMode} onChange={chooseVisualMode} compact idPrefix="live-visual-mode" />
              <StepRail
                step={activeStepNumber}
                total={lessonStepsTotal}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                canReplay={canReplay}
                onBack={() => navigateSteps(-1)}
                onForward={() => navigateSteps(1)}
                onReplay={replayCurrentStep}
              />
              <div className="speech-card" aria-live="polite">{askInFlight ? <span className="teaching-loading">Thinking…</span> : isLoading && !speech ? <span className="teaching-loading">Preparing the next step…</span> : (speech || "…")}</div>
              {outline.length > 0 && (
                <div className="lesson-outline" aria-label="Lesson plan">
                  <div className="outline-head">
                    <span className="outline-title">Lesson plan · {coveredStages.size}/{outline.length} stages</span>
                    <span className="outline-steps">{lessonStepsTotal} step{lessonStepsTotal === 1 ? "" : "s"}</span>
                  </div>
                  <ol className="outline-list">
                    {outline.map((stage) => (
                      <li key={stage.id} className={`outline-item${coveredStages.has(stage.id) ? " is-covered" : ""}${progress?.currentStageId === stage.id ? " is-current" : ""}`}>
                        <span className="outline-mark" aria-hidden="true">{coveredStages.has(stage.id) ? "✓" : "•"}</span>
                        <span className="outline-label">{stage.title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="live-actions" data-voice-status={voiceStatus}>
                <button className="ghost-action" onClick={togglePause} disabled={voiceStatus !== "speaking" && !paused}>{paused ? "Resume" : "Pause"}</button>
                <button className="stop-action" onClick={stopTeaching}>Stop</button>
              </div>
              {!continuousTeaching && !lessonState.objectiveComplete && !isLoading && <button className="primary-action continue-action" onClick={continueTeaching}>Continue teaching</button>}
              {/* ONE source of truth. "Lesson complete" is only ever shown when the objective is covered
                  AND there is nothing left to step to — otherwise the panel said "complete" beside a
                  rail reading "Step 2 of 5", and the two statements were both defensible and mutually
                  contradictory. */}
              {lessonState.phase === "complete" ? <p className="status-note is-complete">Lesson complete</p> : null}
              {lessonState.phase === "objective-covered" ? (
                <p className="status-note is-covered">
                  Topic covered{lessonState.remainingCachedSteps > 0 ? ` — ${lessonState.remainingCachedSteps} more step${lessonState.remainingCachedSteps === 1 ? "" : "s"} you can still step through` : ""}.
                </p>
              ) : null}
              {limitReached && !teacherFinished && <p className="status-note">Auto-teaching paused — continue whenever you&apos;re ready.</p>}
              {lessonState.nothingLeft && <button className="primary-action" onClick={startNewLesson}>Start a new lesson</button>}
              <div className="ask-card">
                <label className="field-label" htmlFor="student-question">Ask about this lesson…</label>
                <div className="ask-row">
                  <input id="student-question" value={studentQuestion} onChange={(event) => setStudentQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); askQuestion(); } }} placeholder="e.g. Why does the server send SYN-ACK?" disabled={askInFlight} />
                  <button onClick={askQuestion} disabled={!studentQuestion.trim() || askInFlight}>Ask</button>
                </div>
                <p className="ask-hint">You can interrupt any time — even after the lesson ends.</p>
              </div>
              <label className="field-label" htmlFor="lesson-language-live">Language</label>
              <select id="lesson-language-live" className="language-select" value={language} onChange={(event) => changeLanguage(event.target.value as TeachingLanguage)}>
                {TEACHING_LANGUAGES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              {voiceError && <p className="voice-error" role="status">{voiceError}</p>}
              {error && <p className="teaching-error" role="alert">{error}</p>}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

