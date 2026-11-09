"""Word timestamps for one audio file with faster-whisper (optional dependency).

Usage: python whisper_words.py <audio> [model=base] [language=auto]
Prints JSON: {"language": "tr", "words": [{"word": "...", "start": 0.12, "end": 0.40}, ...]}
The first run downloads the model (~150 MB for "base"). Everything else runs offline.
"""
import json
import sys


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    audio = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"
    language = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] not in ("auto", "und", "") else None
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio, word_timestamps=True, language=language, vad_filter=False)
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)})
    # ASCII-escaped JSON: immune to the console code page on Windows (cp1254 would garble ğ, ş, ı ...)
    print(json.dumps({"language": info.language, "words": words}, ensure_ascii=True))


if __name__ == "__main__":
    main()
