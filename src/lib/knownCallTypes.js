// Hand-curated list of call types confirmed present in the live ArcGIS feed.
// The feed publishes no official enum (its CALL_TYPE field has no domain),
// and the set of types in use drifts over time, so this list is built by
// periodically sampling the live feed and merging in anything new.
// Last updated: 2026-08-10.
export const SEED_CALL_TYPES = [
  'ARREST',
  'ASSAULT',
  'ASSAULT IN PROGRESS',
  'ASSAULT JUST OCCURRED',
  'ATTEMPT BREAK & ENTER',
  'BREAK & ENTER',
  'BREAK & ENTER IN PROGRESS',
  'BREAK & ENTER JUST OCCURRED',
  'DAMAGE IN PROGRESS',
  'DAMAGE JUST OCCURRED',
  'DEMONSTRATION',
  'DISORDERLIES',
  'DISPUTE',
  'ESCAPE CUSTODY',
  'FAIL TO REMAIN PERSONAL INJURY COLLISION',
  'FAIL TO REMAIN PROPERTY DAMAGE COLLISION',
  'FIGHT',
  'FIRE',
  'FOUND CHILD',
  'FOUND PROPERTY',
  'FRAUD',
  'HAZARD',
  'HOLDING LOST ELDERLY',
  'IMPAIRED DRIVER',
  'INDECENT EXPOSURE JUST OCCURRED',
  'MISSING CHILD',
  'MISSING ELDERLY',
  'MISSING VULNERABLE PERSON',
  'NOISY PARTY',
  'PERSON WITH A GUN',
  'PERSON WITH A KNIFE',
  'PERSONAL INJURY COLLISION',
  'PROPERTY DAMAGE COLLISION',
  'ROBBERY',
  'SEE AMBULANCE',
  'SEE FIRE DEPT',
  'SOUND OF GUNSHOTS',
  'STABBING',
  'THEFT',
  'THEFT FROM AUTO',
  'THEFT IN PROGRESS',
  'THEFT JUST OCCURRED',
  'THEFT OF VEHICLE',
  'UNKNOWN TROUBLE',
];

/** Union of any number of call-type arrays, deduplicated and sorted. */
export function mergeCallTypes(...lists) {
  const values = new Set();
  lists.forEach((list) => {
    list.forEach((type) => {
      if (type) values.add(type);
    });
  });
  return [...values].sort();
}
