// MODEL HEALTH.
//
// Availability is learned, not assumed:
//   404 (model not found)  -> the model does not exist for this key: disable it for the process.
//   429 (rate limited)     -> long cooldown, do not hammer it.
//   502/503 (unavailable)  -> short cooldown, fall through to the next healthy model.
//   success                -> clear the cooldown.
export type GeminiModelHealth = {
  failureCount: number;
  lastFailureTime?: number;
  cooldownUntil?: number;
  lastSuccessTime?: number;
  /** Set once the API reports the model does not exist; it is never retried again. */
  unavailable?: boolean;
  unavailableReason?: string;
};

const MODEL_COOLDOWN_MS = 15_000;
const RATE_LIMIT_COOLDOWN_MS = 90_000;
const DISABLED_MODEL_TTL_MS = 6 * 60 * 60_000;

const healthByModel = new Map<string, GeminiModelHealth>();
let preferredModel: string | undefined;

export function getGeminiModelHealth(model: string): GeminiModelHealth {
  return { ...stateFor(model) };
}

function stateFor(model: string): GeminiModelHealth {
  const existing = healthByModel.get(model);
  if (existing) return existing;
  const state: GeminiModelHealth = { failureCount: 0 };
  healthByModel.set(model, state);
  return state;
}

export function isGeminiModelAvailable(model: string, now = Date.now()): boolean {
  const state = stateFor(model);
  if (state.unavailable) {
    // Re-probe very occasionally so a newly published model can recover.
    if (!state.lastFailureTime || now - state.lastFailureTime > DISABLED_MODEL_TTL_MS) state.unavailable = false;
    else return false;
  }
  const cooldownUntil = state.cooldownUntil;
  return cooldownUntil === undefined || cooldownUntil <= now;
}

/** A 404 means the model id does not exist for this key: stop calling it. */
export function markGeminiModelUnavailable(model: string, reason: string, now = Date.now()): void {
  const state = stateFor(model);
  state.unavailable = true;
  state.unavailableReason = reason;
  state.lastFailureTime = now;
  state.cooldownUntil = undefined;
}

export function recordGeminiFailure(model: string, status: number | undefined, now = Date.now()): void {
  const state = stateFor(model);
  state.failureCount += 1;
  state.lastFailureTime = now;
  state.cooldownUntil = now + (status === 429 ? RATE_LIMIT_COOLDOWN_MS : MODEL_COOLDOWN_MS);
}

export function recordGeminiSuccess(model: string, now = Date.now()): void {
  const state = stateFor(model);
  state.failureCount = 0;
  state.cooldownUntil = undefined;
  state.lastSuccessTime = now;
  preferredModel = model;
}

/**
 * The last model that answered successfully is tried first. Availability probing shows that the
 * healthy model changes over time (some ids answer, some return 503/429), so remembering the winner
 * keeps latency low instead of re-probing the whole pool on every single lesson step.
 */
export function getPreferredGeminiModel(): string | undefined {
  return preferredModel;
}

export function clearGeminiHealth(): void {
  healthByModel.clear();
  preferredModel = undefined;
}