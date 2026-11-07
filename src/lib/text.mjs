// Language-aware text helpers. Turkish casing rules are honoured (I/ı, İ/i) so names and
// keywords match regardless of how the user typed them. Nothing here is Turkish-only.

/** Lowercase with Turkish dotted/dotless I handled, then strip diacritics and keep [a-z0-9]. */
export function foldKey(s) {
  return String(s)
    .replace(/I/g, 'ı').replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/œ/g, 'oe')
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, '');
}

export function slug(s) {
  const parts = String(s).split(/[\s_\-.]+/).map(foldKey).filter(Boolean);
  return parts.join('-') || 'x';
}

/** Lowercase that respects Turkish when the text looks Turkish (keeps the original letters). */
export function lower(s, lang) { return lang === 'tr' ? s.toLocaleLowerCase('tr') : s.toLowerCase(); }
export function upper(s, lang) { return lang === 'tr' ? s.toLocaleUpperCase('tr') : s.toUpperCase(); }

const VOWEL_RE = /[aeiouyıöüâêîôûàèìòùáéíóúäëïöüåæøœãõąęų]/i;
const ROUND_RE = /[oöuüôûòùóúøœõų]/i;
const CJK_RE = /[぀-ヿ㐀-鿿가-힯]/;

export function isVowel(ch) { return VOWEL_RE.test(ch); }
export function isRoundVowel(ch) { return ROUND_RE.test(ch); }

/** Vowel nuclei of a word (consecutive vowels count once). CJK: one nucleus per character. */
export function nuclei(word) {
  const w = String(word).normalize('NFC');
  if (CJK_RE.test(w)) return [...w].filter((ch) => CJK_RE.test(ch)).map(() => 'a');
  const out = [];
  let prev = false;
  for (const ch of w) {
    const v = VOWEL_RE.test(ch);
    if (v && !prev) out.push(ch);
    prev = v;
  }
  return out;
}

export function syllables(word) { return Math.max(1, nuclei(word).length); }

/** Split spoken text into word tokens (punctuation stays attached to the word it follows). */
export function tokenize(text) {
  return String(text).trim().split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t));
}

export function stripPunct(w) { return String(w).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); }

const TR_HINT = /[ğşıİĞŞ]|\b(ve|bir|bu|ne|da|de|mi|mı|mu|mü|çok|ama|için|ben|sen|evet|hayır|şey|gibi)\b/i;
const EN_HINT = /\b(the|and|you|is|are|what|this|that|it|to|of|not|yes|no|i|we)\b/i;

export function detectLanguage(text) {
  const t = String(text);
  const tr = (t.match(new RegExp(TR_HINT.source, 'gi')) || []).length;
  const en = (t.match(new RegExp(EN_HINT.source, 'gi')) || []).length;
  if (tr === 0 && en === 0) return CJK_RE.test(t) ? 'cjk' : 'und';
  return tr >= en ? 'tr' : 'en';
}

/** Every distinct non-space character, for font coverage checks. */
export function distinctChars(text) {
  return [...new Set([...String(text)].filter((ch) => !/\s/.test(ch)))];
}
