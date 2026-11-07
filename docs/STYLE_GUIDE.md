# Style guide: the look in numbers

A style is a set of measurable values, not adjectives. All pixel values are at 1080 px width in a standard two-shot, where 1 stage unit ≈ 1 px; close-ups scale them up like real objects. `da style check <id>` measures every limit marked ✓.

## Global rules (every pack)
| rule | value | checked |
|---|---|---|
| Distinct colours (skin tones excluded) | ≤ `limits.maxColors` (paper 7, jöle 9, riso 5) | ✓ |
| Caption text contrast | ≥ 4.5 : 1 (WCAG AA) against its box, outline or the paper | ✓ |
| Outline width when a pack uses lines | ≥ `limits.minLinePx` (≥ 3 px) | ✓ |
| Push-in per frame | 0.05 – 0.4 % (no static holds) | ✓ |
| Pan speed | ≤ 60 px/frame (pack limits are lower) | ✓ |
| Character frame rate | divides 30/60 (15 = "on twos") | ✓ |
| Turkish glyphs in every font | ğ ş ı İ ö ü ç â î û | ✓ |
| Word caption size | 84–112 px; line captions 58–60 px, ≤ 2 lines, ≤ 86–88 % of the width | qa |
| Caption safe area | 4 % from every edge; never over a face | qa |
| Faces | the speaker's face is never cut by the frame edge while talking | qa |
| Minimum shot | 0.8 s; single holds ≤ 4.5 s | lint |
| Reaction lead | expression changes 4 frames before the trigger word | lint |
| Fine textures | dot or grain pitch ≥ 12 px so H.264 does not smear it | guide |
| Loudness | −14 ± 1 LUFS, true peak ≤ −1 dBTP | qa |

## The three packs

| | **Kesik Kâğıt** (`kesik-kagit`, default) | **Jöle** (`jole`) | **Riso Çizgi** (`riso-cizgi`) |
|---|---|---|---|
| Family / body | paper / paper-cut | gummy / gummy | line / lanky-line |
| Palette | paper `#F3EBDD`, ink `#22304A`, terracotta `#D9653B`, mustard `#E3A72F`, teal `#2F7F7A`, sage `#9DB89A`, blush `#F2B8A2` (7) | night `#1B1440`→`#2A1E5C`, outline `#120B2E`, pink `#FF4F8B`, cyan `#3CD6F0`, lime `#B6F03C`, tangerine `#FF9A3C`, lilac `#B79CFF`, white (9) | paper `#F6F1E7`, ink blue `#1F5AA6`, fluo pink `#FF48B0`, yellow `#FFD400` (4) |
| Lines | none; separation by a layer shadow 6 px down-right, opacity 0.22, blur 0 | 9 px uniform, round joins | 5 px monoline, ±2.2 px tremble re-drawn every 15 f (2 Hz) |
| Edges | ±1.5 px cut-edge jitter re-cut every 4 f | clean | clean (the line trembles) |
| Texture | paper grain 3.5 % (6 px cells, overlay) | gloss highlight on bodies (55 % white) | halftone dots, 14 px pitch, 3 bands on the wall/sky + under the feet; fills printed 8/5 px off-register (multiply) |
| Character | head 38 % of height, trapezoid torso, 2-segment strip arms (58 px) with split pins | one blob, no neck, 2.0–2.6 "heads" tall, eye height 13 % of body | about 4 heads tall (head 26 %), stick limbs, big brows |
| Motion | characters on twos (15 fps), camera on ones; expressions snap with a 2-frame 4 % squash | 30 fps; squash ≤ 12 %, spring 3 Hz, overshoot 0.5; expressions blend over 5 f; bob 2.5 % @ 0.6 Hz | 30 fps; expressions blend over 6 f; sway 1°, breath 1 % |
| Camera | push 0.12 %/f; pan ≤ 18 px/f; roll ±1.5° on strong close-ups | push 0.25 %/f; punch-in 8 % / 7 f; roll ±3°; shake 14 px / 7 f; pan ≤ 40 px/f | push 0.08 %/f; pan ≤ 8 px/f; no roll |
| Cuts / scenes | hard cut / paper slide 10 f with torn edge and cast shadow | cut (whip 8 f on every third speaker change) / iris 12 f | 4 f dissolve / ink-band wipe 14 f |
| Captions | word: cream on an ink paper strip, Baloo 2 700, 92 px, stepped pop | word: white with a 20 px outline, Baloo 2 800, 112 px, UPPERCASE (Turkish-aware), spring pop | word: Fraunces italic 600, 84 px, ink; line mode highlights in pink |
| Music | 92 bpm, warm, kalimba | 112 bpm, playful, marimba | 84 bpm, calm, bell |

The preview sheets of each pack are in `styles/<id>/preview/sheet.png` (`da style preview <id>`).

## Originality
These packs are original directions. A pack must not reproduce an existing channel's, show's or brand's look, characters, logos or fonts. Generic techniques (paper cut-out, outlines, halftone) are fine; specific identities are not.
