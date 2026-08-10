import { useEffect, useState } from 'react';
import { SEED_CALL_TYPES, mergeCallTypes } from '../lib/knownCallTypes';

const STORAGE_KEY = 'c4s-known-call-types';

function loadStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStored(types) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
  } catch {
    // Storage unavailable (private browsing, quota, etc). The seed list and
    // whatever is currently live still work; only the "remember it for next
    // time" behavior is lost.
  }
}

/**
 * Every call type ever confirmed to exist: the hardcoded seed list, plus
 * anything saved from a past visit, plus anything in `liveTypes` right now.
 * Any type not seen before is persisted, so the option list only grows.
 */
export function useKnownCallTypes(liveTypes) {
  const [known, setKnown] = useState(() => mergeCallTypes(SEED_CALL_TYPES, loadStored()));

  useEffect(() => {
    setKnown((prev) => {
      const merged = mergeCallTypes(prev, liveTypes);
      if (merged.length !== prev.length) {
        saveStored(merged);
        return merged;
      }
      return prev;
    });
  }, [liveTypes]);

  return known;
}
