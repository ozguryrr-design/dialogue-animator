// Colour words (English + Turkish) -> generic hex. Style packs snap these to their own palette.
import { foldKey } from '../lib/text.mjs';

export const COLOR_WORDS = {
  red: ['red', 'kirmizi', 'al'],
  orange: ['orange', 'turuncu', 'portakal'],
  yellow: ['yellow', 'sari', 'limon'],
  mustard: ['mustard', 'hardal', 'ochre', 'okr'],
  green: ['green', 'yesil', 'cimen'],
  olive: ['olive', 'zeytin', 'haki', 'khaki'],
  teal: ['teal', 'petrol', 'camgobegi'],
  turquoise: ['turquoise', 'turkuaz', 'cyan'],
  blue: ['blue', 'mavi'],
  lightblue: ['lightblue', 'acikmavi', 'gokmavisi', 'babymavi'],
  navy: ['navy', 'lacivert', 'darkblue', 'koyumavi'],
  purple: ['purple', 'mor', 'violet', 'eflatun'],
  lilac: ['lilac', 'lila', 'lavender', 'lavanta'],
  pink: ['pink', 'pembe'],
  maroon: ['maroon', 'bordo', 'burgundy'],
  brown: ['brown', 'kahverengi', 'kahve', 'kestane', 'chestnut'],
  beige: ['beige', 'bej', 'tan'],
  cream: ['cream', 'krem', 'ivory', 'fildisi'],
  black: ['black', 'siyah', 'kara'],
  white: ['white', 'beyaz', 'ak'],
  gray: ['gray', 'grey', 'gri', 'fume'],
  ginger: ['ginger', 'kizil', 'redhead', 'auburn'],
  blonde: ['blonde', 'blond', 'sarisin'],
};

export const COLOR_HEX = {
  red: '#D33F3F', orange: '#E8833A', yellow: '#E8C33A', mustard: '#E3A72F', green: '#4F9A5A', olive: '#7C7F3A',
  teal: '#2F7F7A', turquoise: '#3CB8B0', blue: '#3A78C3', lightblue: '#8EC3E8', navy: '#22304A', purple: '#7E57C2',
  lilac: '#B79CFF', pink: '#E88FAE', maroon: '#7A2E3A', brown: '#8B5A3C', beige: '#E3D3B5', cream: '#F3EBDD',
  black: '#222222', white: '#F5F5F0', gray: '#8A8A8A', ginger: '#C8642E', blonde: '#E8C870',
};

/** Words for skin tone (index into the pack's skin list, light -> dark). */
export const SKIN_WORDS = [
  { idx: 0, words: ['acikten', 'acik tenli', 'beyaz tenli', 'fair', 'pale', 'light skin', 'lightskinned'] },
  { idx: 1, words: ['pembe tenli', 'rosy'] },
  { idx: 2, words: ['bugday', 'bugdayten', 'olive skin', 'medium skin', 'tan skin'] },
  { idx: 3, words: ['esmer', 'brown skin', 'koyu ten', 'dark skin'] },
  { idx: 4, words: ['siyahi', 'cok koyu', 'deep skin', 'very dark'] },
];

export function colorFromWord(word) {
  const k = foldKey(word);
  if (/^#[0-9a-f]{6}$/i.test(word)) return word.toUpperCase();
  for (const [name, words] of Object.entries(COLOR_WORDS)) if (words.includes(k)) return COLOR_HEX[name];
  return null;
}

/** Accept "#RRGGBB" or a colour word; anything else -> null. */
export function normalizeColor(v) {
  if (!v) return null;
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + v.slice(1).split('').map((x) => x + x).join('')).toUpperCase();
  return colorFromWord(String(v).split(/\s+/).join(''));
}
