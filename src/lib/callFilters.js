// Pure helpers for filtering and counting calls.
// Deliberately imports nothing so its tests run without the CRA/axios ESM issue.

/**
 * Stable identity for a call.
 * OBJECTID is NOT usable: the upstream layer is truncate-and-reloaded and
 * reassigns IDs to different incidents within minutes.
 */
export function callKey(call) {
  return `${call.OCCURRENCE_TIME}|${call.LATITUDE}|${call.LONGITUDE}`;
}

/**
 * OR within a category, AND across categories. An empty Set means "no constraint".
 * Comparison is exact equality — substring matching would conflate
 * ASSAULT with ASSAULT IN PROGRESS and break every count on the page.
 */
export function filterCalls(calls, selection) {
  const { divisions, types } = selection;
  return calls.filter(
    (call) =>
      (divisions.size === 0 || divisions.has(call.DIVISION)) &&
      (types.size === 0 || types.has(call.CALL_TYPE))
  );
}
