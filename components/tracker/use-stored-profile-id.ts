"use client";

// Reads the saved profile id from localStorage without a hydration mismatch.
// Returns undefined while the value is not yet known (server render and first client render),
// null when no profile has been saved on this device, and the id otherwise.

import { useSyncExternalStore } from "react";

export const PROFILE_ID_KEY = "claimkaro-profile-id";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot(): string | null | undefined {
  try {
    return window.localStorage.getItem(PROFILE_ID_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null | undefined {
  return undefined;
}

export function useStoredProfileId(): string | null | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
