const BANNED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt', 'nigger', 'nigga',
  'faggot', 'retard', 'slut', 'whore', 'cock', 'bastard', 'damn', 'crap',
  'dickhead', 'motherfucker', 'twat', 'wank', 'prick', 'bollocks',
];

const NSFW_PATTERNS = [
  /\bnude?s?\b/i, /\bnaked\b/i, /\bsex\b/i, /\bporn\b/i, /\bxxx\b/i,
  /\bcock\b/i, /\bdick\b/i, /\bpussy\b/i, /\bboobs?\b/i, /\btits?\b/i,
  /\bgenital/i, /\berotic/i, /\bhentai/i, /\bgore\b/i, /\bkill\s+yourself\b/i,
  /\bkys\b/i, /\brape/i, /\bmolest/i, /\bunderage\b/i, /\bloli\b/i,
];

export function filterProfanity(text: string): string {
  let result = text;
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, '*'.repeat(word.length));
  }
  return result;
}

export function detectNSFW(text: string): boolean {
  return NSFW_PATTERNS.some((pattern) => pattern.test(text));
}

export function severityLevel(text: string): 'clean' | 'mild' | 'severe' {
  if (NSFW_PATTERNS.some((p) => p.test(text))) return 'severe';
  if (BANNED_WORDS.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text))) return 'mild';
  return 'clean';
}
