// Keywords that mark a call as high-severity (shown in red / highlighted).
// Matching is a case-insensitive substring check against the call type.
// 'break & enter' is a full phrase, not the standalone words 'break'/'enter',
// so it only matches break-and-enter incidents (BREAK & ENTER, BREAK & ENTER
// IN PROGRESS, ATTEMPT BREAK & ENTER), not unrelated types.
export const EMERGENCY_KEYWORDS = [
  'gun',
  'knife',
  'shoot',
  'homicide',
  'break & enter',
  'robbery',
];

// Call types excluded from severity even though they contain a keyword
// above (e.g. 'SOUND OF GUNSHOTS' contains 'gun', but is not itself
// treated as high-severity). Matched case-insensitively, exact type only.
export const EMERGENCY_EXCLUDED_TYPES = ['SOUND OF GUNSHOTS'];

export function isEmergencyCall(callType) {
  if (!callType) return false;
  if (EMERGENCY_EXCLUDED_TYPES.includes(callType.toUpperCase())) return false;
  const lowercaseType = callType.toLowerCase();
  return EMERGENCY_KEYWORDS.some((keyword) => lowercaseType.includes(keyword));
}
