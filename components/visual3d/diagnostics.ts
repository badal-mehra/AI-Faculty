"use client";

// ASSET LOADING + FAILURE DIAGNOSTICS.
//
// A missing model must NEVER look like a successful lesson: every load failure is detected, logged,
// reported to the development diagnostics channel and rendered with the registry's documented
// fallback primitive while the parent can decide whether to fall back to the 2D diagram.

export type AssetFailure = {
  assetId: string;
  path: string | null;
  reason: string;
  at: number;
};

type Listener = (failure: AssetFailure) => void;

const listeners = new Set<Listener>();
const failures = new Map<string, AssetFailure>();

export function onAssetFailure(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportAssetFailure(assetId: string, path: string | null, reason: string): void {
  const failure: AssetFailure = { assetId, path, reason, at: Date.now() };
  const previous = failures.get(assetId);
  // One report per asset per reason keeps a retried load from flooding the console.
  if (previous && previous.reason === reason) return;
  failures.set(assetId, failure);
  // eslint-disable-next-line no-console
  console.error(`[3D asset] failed to load "${assetId}"${path ? ` (${path})` : ""}: ${reason}`);
  for (const listener of listeners) listener(failure);
}

export function getAssetFailures(): AssetFailure[] {
  return Array.from(failures.values());
}

export function clearAssetFailures(): void {
  failures.clear();
}