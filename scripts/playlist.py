#!/usr/bin/env python3
"""Playlist job: gather songs (YouTube / YouTube Music link, or an uploaded zip), transcribe each.

Usage: playlist.py <job_dir> <lang> <model> url <playlist_url>
       playlist.py <job_dir> <lang> <model> zip <zip_path>

Layout inside <job_dir>:
  audio/<id>.<ext>      downloaded / extracted audio; kept as audio/<id>.mp3 for finished songs
                        (the export zip bundles it), removed for failed songs
  songs/<id>.json       {"id", "title", "duration", "segments": [{"start","end","text"}]}  (written when done)
  status.json           {"status": "starting"|"running"|"done"|"error", "error",
                         "songs": [{"id","title","state","progress","error"}]}
Song ids are zero-padded playlist positions ("001", "002", ...), so ids stay stable and sortable.
State per song: pending -> downloading -> transcribing -> done | error. One bad song never stops the rest.
"""

import os
import re
import subprocess
import sys
import zipfile

from transcribe import load_model, transcribe_file, write_json

AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".ogg", ".flac", ".opus", ".aac", ".webm"}
MAX_SONGS = 50
MAX_UNZIPPED_BYTES = 1024 * 1024 * 1024
# YouTube extraction needs a JS runtime; Node is already present for Next.js.
YTDLP_COMMON = {"quiet": True, "no_warnings": True, "js_runtimes": {"node": {}}}
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "music.youtube.com", "m.youtube.com", "youtu.be"}

job_dir, lang, model_name, mode, source = sys.argv[1:6]
audio_dir = os.path.join(job_dir, "audio")
songs_dir = os.path.join(job_dir, "songs")
status_path = os.path.join(job_dir, "status.json")
os.makedirs(audio_dir, exist_ok=True)
os.makedirs(songs_dir, exist_ok=True)

state = {"status": "starting", "error": None, "songs": []}


def save():
    write_json(status_path, state)


def fail(msg):
    state["status"] = "error"
    state["error"] = msg
    save()
    sys.exit(1)


def song_id(n):
    return f"{n:03d}"


def add_song(n, title):
    s = {"id": song_id(n), "title": title, "state": "pending", "progress": 0.0, "error": None}
    state["songs"].append(s)
    return s


# ── Gathering ────────────────────────────────────────────────────────────────

def gather_zip(path):
    """Extract audio files (flat, sanitized names) and register them as songs."""
    total = 0
    with zipfile.ZipFile(path) as z:
        members = [
            m for m in z.infolist()
            if not m.is_dir()
            and not os.path.basename(m.filename).startswith(("._", "."))
            and "__MACOSX" not in m.filename
            and os.path.splitext(m.filename)[1].lower() in AUDIO_EXTS
        ]
        members.sort(key=lambda m: m.filename.lower())
        if not members:
            fail("The zip has no audio files (looked for " + ", ".join(sorted(AUDIO_EXTS)) + ").")
        if len(members) > MAX_SONGS:
            fail(f"The zip has {len(members)} songs; the limit is {MAX_SONGS}.")
        for n, m in enumerate(members, 1):
            total += m.file_size
            if total > MAX_UNZIPPED_BYTES:
                fail("The zip is too large once unpacked (limit 1 GB).")
            ext = os.path.splitext(m.filename)[1].lower()
            dest = os.path.join(audio_dir, song_id(n) + ext)
            # Write by id, never by archive path, so entries can't escape the job dir.
            with z.open(m) as src, open(dest, "wb") as out:
                out.write(src.read())
            title = os.path.splitext(os.path.basename(m.filename))[0]
            s = add_song(n, title)
            s["state"] = "downloaded"
    save()


def gather_url(url):
    from urllib.parse import urlparse
    import yt_dlp

    host = (urlparse(url).hostname or "").lower()
    if host.endswith("spotify.com"):
        fail("Spotify audio is DRM-protected and can't be fetched. Use a YouTube / YouTube Music "
             "playlist link, or upload a zip of your own MP3 files.")
    if host not in YOUTUBE_HOSTS:
        fail("Only YouTube and YouTube Music playlist links are supported.")

    with yt_dlp.YoutubeDL({**YTDLP_COMMON, "extract_flat": True, "playlistend": MAX_SONGS}) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
        except yt_dlp.utils.DownloadError as e:
            reason = re.sub(r"\x1b\[[0-9;]*m", "", str(e)).split("YouTube said:")[-1].replace("ERROR:", "").strip()
            fail(f"Couldn't read that playlist: {reason[:200]} (it must be public or unlisted).")
    entries = [e for e in (info.get("entries") or [info]) if e and e.get("id")]
    if not entries:
        fail("Couldn't find any videos at that link (is the playlist public?).")
    for n, e in enumerate(entries, 1):
        s = add_song(n, e.get("title") or f"Track {n}")
        s["url"] = e.get("url") or f"https://www.youtube.com/watch?v={e['id']}"
    save()


def download_song(s):
    import yt_dlp

    opts = {
        **YTDLP_COMMON,
        "noplaylist": True,
        "format": "bestaudio/best",
        "outtmpl": os.path.join(audio_dir, s["id"] + ".%(ext)s"),
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([s["url"]])


def to_mp3(path):
    """Return the path of an mp3 version of `path`, converting with ffmpeg if needed."""
    if path.lower().endswith(".mp3"):
        return path
    dest = os.path.splitext(path)[0] + ".mp3"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", path, "-vn", "-codec:a", "libmp3lame", "-q:a", "2", dest],
        check=True,
    )
    os.remove(path)
    return dest


def duration_of(path):
    """Audio duration in seconds (rounded), or None if ffprobe can't tell."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        return round(float(out), 2)
    except Exception:
        return None


def audio_path(s):
    for f in os.listdir(audio_dir):
        if f.startswith(s["id"] + "."):
            return os.path.join(audio_dir, f)
    return None


# ── Main ─────────────────────────────────────────────────────────────────────

try:
    if mode == "zip":
        gather_zip(source)
    else:
        gather_url(source)

    state["status"] = "running"
    save()
    model = None  # loaded lazily so a download-only failure doesn't pay for the model

    for s in state["songs"]:
        try:
            if s["state"] == "pending":
                s["state"] = "downloading"
                save()
                download_song(s)
            path = audio_path(s)
            if not path:
                raise RuntimeError("download produced no audio file")

            if model is None:
                model = load_model(model_name)
            s["state"] = "transcribing"
            save()

            def on_progress(p, _segs, s=s):
                s["progress"] = round(p, 3)
                save()

            segments = transcribe_file(model, path, lang, on_progress)
            path = to_mp3(path)  # the export bundles mp3s whatever the source format was
            write_json(os.path.join(songs_dir, s["id"] + ".json"),
                       {"id": s["id"], "title": s["title"], "duration": duration_of(path), "segments": segments})
            s["state"] = "done"
            s["progress"] = 1.0
        except Exception as e:  # keep going: one unavailable video shouldn't sink the playlist
            s["state"] = "error"
            s["error"] = re.sub(r"\x1b\[[0-9;]*m", "", f"{type(e).__name__}: {e}")[:300]
        save()
        # Finished songs keep their mp3 for the export; a failed song's audio is useless.
        if s["state"] == "error":
            p = audio_path(s)
            if p:
                os.remove(p)

    state["status"] = "done"
    save()
except SystemExit:
    raise
except Exception as e:
    fail(f"{type(e).__name__}: {e}")
