// Keywords that mark a call as high-severity (shown in red / highlighted).
// Matching is a case-insensitive substring check against the call type.
// 'break & enter' is a full phrase, not the standalone words 'break'/'enter',
// so it only matches break-and-enter incidents (BREAK & ENTER, BREAK & ENTER
// IN PROGRESS, ATTEMPT BREAK & ENTER), not unrelated types.
export const EMERGENCY_KEYWORDS = [
  'gun',
  'knife',
  'stabb',
  'shoot',
  'homicide',
  'break & enter',
  'robbery',
];

export function isEmergencyCall(callType) {
  if (!callType) return false;
  const lowercaseType = callType.toLowerCase();
  return EMERGENCY_KEYWORDS.some((keyword) => lowercaseType.includes(keyword));
}
