import yt_dlp
import os
import shutil
import time
from dotenv import load_dotenv
from pydub import AudioSegment
load_dotenv()

# Automatically configure FFmpeg executable path from imageio_ffmpeg if installed
try:
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = os.path.dirname(ffmpeg_exe)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
    AudioSegment.converter = ffmpeg_exe
    AudioSegment.ffmpeg = ffmpeg_exe
except Exception:
    pass

DOWNLOAD_DIR = 'downloads'
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

RATE_LIMIT_MARKERS = (
    "Too Many Requests",
    "isn't available, try again later",
    "processing this video",
)


def _available_js_runtimes() -> list[str]:
    runtimes: list[str] = []
    for runtime in ("deno", "node", "bun"):
        if shutil.which(runtime):
            runtimes.append(runtime)
    return runtimes


def _auth_attempts() -> list[tuple[str, dict]]:
    cookies_from_browser = os.getenv("YTDLP_COOKIES_FROM_BROWSER", "").strip()
    cookie_file = os.getenv("YTDLP_COOKIE_FILE", "").strip()
    visitor_data = os.getenv("YTDLP_VISITOR_DATA", "").strip()

    attempts: list[tuple[str, dict]] = [("no_auth", {})]

    if visitor_data:
        attempts.append((
            "visitor_data",
            {
                "extractor_args": {
                    "youtubetab": {"skip": ["webpage"]},
                    "youtube": {
                        "player_skip": ["webpage", "configs"],
                        "visitor_data": [visitor_data],
                    },
                }
            },
        ))

    if cookie_file and os.path.exists(cookie_file):
        attempts.append(("cookie_file", {"cookiefile": cookie_file}))

    if cookies_from_browser:
        attempts.append(("browser_cookies", {"cookiesfrombrowser": (cookies_from_browser,)}))

    return attempts


def _build_ydl_opts(output_path: str, auth_overrides: dict) -> dict:
    js_runtimes = _available_js_runtimes()
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "retries": 3,
        "fragment_retries": 3,
        "sleep_interval_requests": 1,
        "nocheckcertificate": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "ios", "mweb", "web"],
                "player_skip": ["configs", "webpage"]
            }
        },
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
    }
    if js_runtimes:
        ydl_opts["js_runtimes"] = {runtime: {} for runtime in js_runtimes}
    ydl_opts.update(auth_overrides)
    return ydl_opts


def _is_rate_limit_error(error_text: str) -> bool:
    return any(marker in error_text for marker in RATE_LIMIT_MARKERS)


def download_youtube_audio(url: str) -> str:
    # Use video ID %(id)s to avoid Windows filename invalid character errors (Errno 22)
    output_path = os.path.join(DOWNLOAD_DIR, "%(id)s.%(ext)s")
    errors: list[str] = []

    for auth_mode, auth_overrides in _auth_attempts():
        for attempt in range(1, 3):
            ydl_opts = _build_ydl_opts(output_path, auth_overrides)
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    video_id = info.get("id", "audio")
                return os.path.join(DOWNLOAD_DIR, f"{video_id}.wav")
            except yt_dlp.utils.DownloadError as exc:
                error_text = str(exc)
                errors.append(f"{auth_mode} attempt {attempt}: {error_text}")

                if "Failed to decrypt with DPAPI" in error_text:
                    break

                if _is_rate_limit_error(error_text) and attempt < 2:
                    time.sleep(2 ** attempt * 5)
                    continue

                break

    raise RuntimeError(
        "YouTube download failed after retries across all available auth modes "
        f"({', '.join(mode for mode, _ in _auth_attempts())}). Last error: "
        f"{errors[-1] if errors else 'unknown error'}"
    )


def convert_to_wav(input_path: str) -> str:
    """Convert any audio/video file to WAV format using pydub safely."""
    basename = os.path.basename(input_path)
    clean_name = "".join(c if c.isalnum() or c in (".", "_") else "_" for c in basename)
    stem, _ = os.path.splitext(clean_name)
    output_path = os.path.join(DOWNLOAD_DIR, f"{stem}_converted.wav")

    audio = AudioSegment.from_file(input_path)
    audio = audio.set_channels(1).set_frame_rate(16000)  # 16kHz
    audio.export(output_path, format="wav")
    return output_path


def chunk_audio(wav_path: str, chunk_minutes: int = 3) -> list:
    """Split a WAV file into fixed-length chunks. Returns list of chunk paths."""
    audio = AudioSegment.from_file(wav_path)
    chunk_ms = chunk_minutes * 60 * 1000
    total_ms = len(audio)

    dirname = os.path.dirname(wav_path)
    basename = os.path.basename(wav_path)
    stem, ext = os.path.splitext(basename)
    clean_stem = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in stem)

    chunks = []

    for i, start_ms in enumerate(range(0, total_ms, chunk_ms)):
        end_ms = min(start_ms + chunk_ms, total_ms)
        chunk_path = os.path.join(dirname, f"{clean_stem}_chunk{i:03d}{ext}")
        audio[start_ms:end_ms].export(chunk_path, format="wav")
        chunks.append(chunk_path)

    return chunks


def process_input(source: str) -> list:
    if source.startswith("http://") or source.startswith("https://"):
        print("Detected YouTube URL. Downloading audio...")
        wav_path = download_youtube_audio(source)
    else:
        print("Detected local file. Converting to WAV...")
        wav_path = convert_to_wav(source)

    print("Chunking audio...")
    chunks = chunk_audio(wav_path)
    print(f"Audio ready — {len(chunks)} chunk(s) created.")
    return chunks


def _looks_like_youtube_url(text: str) -> bool:
    text = text.strip()
    return text.startswith(("http://", "https://")) and (
        "youtube.com" in text or "youtu.be" in text
    )