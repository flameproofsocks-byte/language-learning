#!/usr/bin/env python3
"""Transcribe an audio file with faster-whisper (local, CPU).

CLI: transcribe.py <audio> <lang> <job_dir> [model]

Writes <job_dir>/status.json as it goes so the Next.js API can report progress:
  {"status": "loading" | "running" | "done" | "error",
   "progress": 0..1, "segments": [{"start", "end", "text"}], "error": str | null}
The status file is replaced atomically so readers never see a partial write.

Also imported by playlist.py, which reuses load_model() and transcribe_file().
"""

import json
import os
import sys

from faster_whisper import WhisperModel


def write_json(path, obj):
    """Atomically replace `path` with `obj` as JSON (readers never see a partial write)."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, path)


def load_model(model_name="small"):
    # int8 keeps memory low and is fast enough on CPU; first run downloads the model.
    return WhisperModel(model_name, device="cpu", compute_type="int8")


def transcribe_file(model, audio, lang, on_progress=None):
    """Return [{"start", "end", "text"}, ...]; on_progress(fraction, segments) after each segment."""
    seg_iter, info = model.transcribe(
        audio,
        language=lang,
        vad_filter=True,                  # skip instrumental gaps (avoids hallucinated lyrics)
        condition_on_previous_text=False,  # stops repetition loops common with songs
    )
    segments = []
    if on_progress:
        on_progress(0.0, segments)
    for seg in seg_iter:
        text = seg.text.strip()
        if text:
            segments.append({"start": round(seg.start, 2), "end": round(seg.end, 2), "text": text})
        if on_progress:
            on_progress(min(seg.end / info.duration, 0.99) if info.duration else 0.0, segments)
    return segments


def main():
    audio, lang, job_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    model_name = sys.argv[4] if len(sys.argv) > 4 else "small"
    status_path = os.path.join(job_dir, "status.json")

    def write(status, progress=0.0, segments=None, error=None):
        write_json(status_path, {"status": status, "progress": progress, "segments": segments or [], "error": error})

    try:
        write("loading")
        model = load_model(model_name)
        segments = transcribe_file(model, audio, lang, lambda p, segs: write("running", p, segs))
        write("done", 1.0, segments)
    except Exception as e:  # surface any failure to the UI instead of dying silently
        write("error", 0.0, None, f"{type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
