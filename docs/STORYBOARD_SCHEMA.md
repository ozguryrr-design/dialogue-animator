# build/storyboard.json

The only input a renderer needs (plus the style pack). Schema: `schemas/storyboard.schema.json`. Times are in seconds. Stage units: characters are about 900 units tall, the ground is at y = 0, up is negative y, and 1 unit ≈ 1 px in a 1080×1920 two-shot.

```jsonc
{
  "version": 1,
  "meta":   { "title": "Çay Krizi", "seed": 7, "language": "tr", "timingSource": "per-line-audio", "estimatedTiming": false },
  "video":  { "width": 1080, "height": 1920, "fps": 30, "duration": 22.84, "frames": 686 },
  "style":  { "id": "kesik-kagit", "family": "paper", "body": "paper-cut" },
  "characters": [ { "id": "deniz", "name": "Deniz", "colors": { "skin": "#F6D3B8", "body": "#E3A72F", … }, … } ],  // palette-resolved
  "scenes": [ {
      "id": "s1", "label": "Mutfak", "setting": "kitchen", "start": 0, "end": 15.47,
      "cast": ["deniz", "su"], "positions": { "deniz": -286, "su": 286 }, "facing": { "deniz": 1, "su": -1 },
      "background": { "place": "interior", "wall": "wall", "floor": "floor",
                      "props": [ { "id": "s1-p5", "type": "teapot", "x": 20, "y": -430, "s": 0.95 } ] } } ],
  "lines": [ { "id": "l01", "speaker": "deniz", "scene": "s1", "start": 0.4, "end": 2.33, "text": "Günaydın! Çay demledin mi?",
               "emotion": "neutral", "gesture": "wave", "trigger": null, "words": [ { "w": "Günaydın!", "s": 0.42, "e": 0.98 } ] } ],
  "shots": [ { "id": "sh03", "scene": "s1", "start": 3.53, "end": 4.68, "type": "insert", "focus": null, "subjects": [], "prop": "s1-p5",
               "transitionIn": { "type": "cut", "frames": 0 }, "why": "cutaway: teapot",
               "camera": { "from": { "x": 20, "y": -556, "h": 777, "roll": 0 }, "to": { "x": 20, "y": -556, "h": 745, "roll": 0 }, "ease": "linear" } } ],
  "events": [
    { "t": 4.68, "type": "expression", "target": "deniz", "value": "surprised", "why": "says l03" },
    { "t": 1.10, "type": "fx", "target": "su", "value": "question", "dur": 0.9, "scene": "s1" },
    { "t": 0.27, "type": "gesture", "target": "deniz", "value": "wave", "dur": 1.3 },
    { "t": 6.1, "type": "shake", "amp": 14, "frames": 7 },
    { "t": 4.68, "type": "punch", "amount": 0.08, "frames": 7, "until": 6.97 },
    { "t": 2.0, "type": "look", "target": "kai", "value": -1 }
  ],
  "tracks": {
    "mouth":  { "deniz": [0, 0, 34, 81, …] },     // openness 0..100 per frame
    "round":  { "deniz": "000011100…" },          // 1 = rounded vowel this frame
    "blinks": { "deniz": [1.21, 4.9] }            // blink start times
  },
  "captions": { "mode": "word", "items": [ { "start": 0.42, "end": 0.98, "text": "Günaydın!", "speaker": "deniz", "line": "l01", "words": […] } ] },
  "audio": { "voice": "build/voice.wav" },
  "lint": { "warnings": [], "stats": { "shots": 11, "avgShot": 2.08, "speakerOnScreen": 0.95 } }
}
```

## Camera math
`h` is the visible height in stage units; `scale = outputHeight / h`. View transform: translate to the frame centre, rotate `roll`, scale, translate `(-x, -y)`. Within a shot the camera interpolates linearly `from → to` (unclamped, so a transition window can extend a shot by a few frames). Transitions are centred on `shot.start` and last `transitionIn.frames`.

## Editing by hand
You can edit any value and re-run `da stills`, `da render` and `da qa`. Running `da board` again overwrites the file, so put lasting changes in `dialogue.json`, the characters, or `project.json → director` instead.
