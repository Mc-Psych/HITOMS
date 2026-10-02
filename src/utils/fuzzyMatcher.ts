/**
 * Fuzzy Matching and Pre-populated Value Validation Utility
 *
 * Checks raw uploaded template strings against valid pre-populated lists (Departments,
 * Roles, Asset Types, Conditions, Statuses). Flags non-matching values, indicates
 * issue types, and suggests/selects the closest valid option.
 */

export interface FieldMatchResult<T extends string = string> {
  rawValue: string;
  matchedValue: T;
  isExactMatch: boolean;
  issueType: string | null; // e.g. 'NON_MATCHING_DEPARTMENT'
  issueDescription: string | null; // e.g. 'Non-matching Department: "Pharmaci" (Auto-selected closest: "Pharmacy")'
}

/**
 * Calculates string similarity score between 0 and 1.
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  // Character set overlap
  const set1 = new Set(s1.split(''));
  const set2 = new Set(s2.split(''));
  let intersection = 0;
  for (const char of set1) {
    if (set2.has(char)) intersection++;
  }
  const union = new Set([...set1, ...set2]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Match a raw string against a list of valid pre-populated options.
 * Returns the closest match and flags the non-matching issue if not exact.
 */
export function matchOptionWithFallback<T extends string>(
  rawValue: string | undefined | null,
  validOptions: T[],
  defaultFallback: T,
  fieldName: string // e.g. 'Department', 'Asset Type', 'Role', 'Condition', 'Status'
): FieldMatchResult<T> {
  const cleanRaw = (rawValue || '').trim();

  if (!cleanRaw) {
    return {
      rawValue: cleanRaw,
      matchedValue: defaultFallback,
      isExactMatch: true,
      issueType: null,
      issueDescription: null,
    };
  }

  // 1. Check exact match (case-insensitive)
  const exact = validOptions.find(
    (opt) => opt.toLowerCase().trim() === cleanRaw.toLowerCase()
  );
  if (exact) {
    return {
      rawValue: cleanRaw,
      matchedValue: exact,
      isExactMatch: true,
      issueType: null,
      issueDescription: null,
    };
  }

  // 2. Find closest match
  let bestMatch: T = defaultFallback;
  let maxScore = -1;

  for (const opt of validOptions) {
    const score = calculateSimilarity(cleanRaw, opt);
    if (score > maxScore) {
      maxScore = score;
      bestMatch = opt;
    }
  }

  return {
    rawValue: cleanRaw,
    matchedValue: bestMatch,
    isExactMatch: false,
    issueType: `NON_MATCHING_${fieldName.toUpperCase().replace(/\s+/g, '_')}`,
    issueDescription: `Non-matching ${fieldName}: "${cleanRaw}" (Auto-selected closest system option: "${bestMatch}")`,
  };
}
