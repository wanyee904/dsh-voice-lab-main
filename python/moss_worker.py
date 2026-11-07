#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MOSS-TTS-Nano 常驻语音 worker（DSH 声线工坊）

协议：stdin 每行一个 JSON 请求，stdout 每行一个 JSON 响应；运行日志一律走 stderr。
模型只在进程内加载一次，之后复用，适合“回复时实时配音”。

请求：
  {"id":1,"cmd":"ping"}
  {"id":2,"cmd":"load"}
  {"id":3,"cmd":"voices"}
  {"id":4,"cmd":"synthesize","text":"...","voice":"Junhao","ref":"...","out":"...",
   "sampleMode":"fixed","maxFrames":375,"normalizeText":true,"seed":null}
  {"id":5,"cmd":"prepare","src":"...","out":"..."}      参考音 → 16k 单声道、去首尾静音、归一化
  {"id":6,"cmd":"analyze","src":"..."}                  只分析不落盘
  {"id":7,"cmd":"concat","srcs":["..."],"out":"...","maxSeconds":45}
  {"id":8,"cmd":"stats"}
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path

# 协议通道必须保住：先抓走真正的 stdout，再把所有普通 print/日志赶到 stderr
_PROTOCOL_OUT = sys.__stdout__
sys.stdout = sys.stderr
# Windows 下 Python 的 stdio 默认跟系统代码页走，中文会变成 GBK；协议固定 UTF-8
for _stream in (_PROTOCOL_OUT, sys.stdin, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

log = logging.getLogger("moss-worker")
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

STATE = {"runtime": None, "loaded_at": None, "load_ms": None, "syntheses": 0}


def emit(payload: dict) -> None:
    try:
        _PROTOCOL_OUT.write(json.dumps(payload, ensure_ascii=False, default=str) + "\n")
        _PROTOCOL_OUT.flush()
    except Exception:
        # 通道坏了就只能退出，JS 侧会看到 EOF 并重启
        raise SystemExit(3)


def _load_runtime(args):
    if STATE["runtime"] is not None:
        return STATE["runtime"]
    started = time.time()
    # 仓库目录里是 onnx_tts_runtime.py 等顶层模块
    repo = str(Path(args.repo).expanduser().resolve())
    if repo not in sys.path:
        sys.path.insert(0, repo)
    # WeTextProcessing 的 fst 缓存默认落在仓库目录下
    try:
        os.chdir(repo)
    except Exception:
        pass

    from onnx_tts_runtime import OnnxTtsRuntime  # type: ignore

    rt = OnnxTtsRuntime(
        model_dir=str(Path(args.model_dir).expanduser().resolve()),
        thread_count=int(args.threads),
        max_new_frames=int(args.max_frames),
        do_sample=(str(args.sample_mode) != "greedy"),
        sample_mode=str(args.sample_mode),
        execution_provider="cpu",
    )
    STATE["runtime"] = rt
    STATE["loaded_at"] = time.time()
    STATE["load_ms"] = int((time.time() - started) * 1000)
    log.info("runtime loaded in %sms", STATE["load_ms"])
    return rt


def _voices(rt):
    out = []
    try:
        for row in rt.list_builtin_voices():
            out.append(
                {
                    "voice": row.get("voice"),
                    "displayName": row.get("display_name") or row.get("voice"),
                    "group": row.get("group") or "",
                    "audioFile": row.get("audio_file") or "",
                }
            )
    except Exception as exc:  # noqa: BLE001
        log.warning("list_builtin_voices failed: %s", exc)
    return out


# ── 音频工具 ────────────────────────────────────────────────────────────────

_FFMPEG_CACHE = {"path": None}


def _find_ffmpeg() -> str:
    """找 FFmpeg：显式环境变量 → PATH → imageio-ffmpeg 自带的二进制。"""
    if _FFMPEG_CACHE["path"] is not None:
        return _FFMPEG_CACHE["path"]
    found = ""
    env = str(os.environ.get("VOICE_LAB_FFMPEG") or "").strip()
    if env and Path(env).is_file():
        found = env
    if not found:
        found = shutil.which("ffmpeg") or ""
    if not found:
        try:
            import imageio_ffmpeg  # type: ignore

            candidate = imageio_ffmpeg.get_ffmpeg_exe()
            if candidate and Path(candidate).is_file():
                found = str(candidate)
        except Exception:
            found = ""
    _FFMPEG_CACHE["path"] = found
    return found


def _load_mono(src: str, target_sr: int = 16000):
    import torch
    import torchaudio

    path = str(Path(src).expanduser().resolve())
    try:
        wav, sr = torchaudio.load(path)
    except Exception as first_error:  # noqa: BLE001
        # soundfile 只认 wav/flac/ogg；mp3、m4a、视频里的音轨交给 FFmpeg
        ffmpeg = _find_ffmpeg()
        if not ffmpeg:
            raise RuntimeError(
                f"无法解码音频：{first_error}。请安装 FFmpeg（或 pip install imageio-ffmpeg），或先转成 WAV。"
            ) from first_error
        workdir = Path(tempfile.mkdtemp(prefix="voicelab-decode-"))
        decoded = workdir / "decoded.wav"
        try:
            cmd = [
                ffmpeg,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                path,
                "-vn",
                "-ac",
                "1",
                "-ar",
                str(int(target_sr)),
                "-f",
                "wav",
                str(decoded),
            ]
            log.info("ffmpeg decode: %s", path)
            proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=300)
            if proc.returncode != 0 or not decoded.is_file():
                detail = proc.stderr.decode("utf-8", "replace").strip()[-800:]
                raise RuntimeError(f"FFmpeg 解码失败：{detail or '未知错误'}")
            wav, sr = torchaudio.load(str(decoded))
        finally:
            try:
                decoded.unlink(missing_ok=True)
            except Exception:
                pass
            try:
                workdir.rmdir()
            except Exception:
                pass
    wav = wav.to(torch.float32)
    if wav.dim() > 1 and wav.size(0) > 1:
        wav = wav.mean(dim=0, keepdim=True)
    if int(sr) != int(target_sr):
        wav = torchaudio.functional.resample(wav, int(sr), int(target_sr))
    return wav, int(sr)


def _trim_silence(wav, sr: int, ratio: float = 0.02, pad_sec: float = 0.06):
    import torch

    x = wav.squeeze(0)
    if x.numel() == 0:
        return wav
    peak = float(x.abs().max())
    if peak <= 1e-6:
        return wav
    thr = max(1e-4, peak * float(ratio))
    idx = torch.nonzero(x.abs() > thr).flatten()
    if idx.numel() == 0:
        return wav
    pad = int(pad_sec * sr)
    start = max(0, int(idx[0].item()) - pad)
    end = min(int(x.numel()), int(idx[-1].item()) + pad + 1)
    return x[start:end].unsqueeze(0)


def _normalize(wav, peak_target: float = 0.95):
    import torch

    peak = float(wav.abs().max()) if wav.numel() else 0.0
    if peak > 1e-6:
        wav = wav * (float(peak_target) / peak)
    return torch.clamp(wav, -1.0, 1.0)


def _stats(wav, sr: int) -> dict:
    import torch

    x = wav.squeeze(0)
    n = int(x.numel())
    peak = float(x.abs().max()) if n else 0.0
    rms = float(torch.sqrt(torch.mean(x * x))) if n else 0.0
    frame = max(1, int(0.02 * sr))
    if n >= frame:
        frames = x[: n // frame * frame].reshape(-1, frame)
        frame_rms = torch.sqrt(torch.mean(frames * frames, dim=1))
        thr = max(1e-4, peak * 0.02)
        silence_ratio = float((frame_rms < thr).float().mean())
    else:
        silence_ratio = 1.0
    clip_ratio = float((x.abs() > 0.995).float().mean()) if n else 0.0
    return {
        "durationSec": round(n / float(sr), 3),
        "sampleRate": int(sr),
        "peak": round(peak, 4),
        "rms": round(rms, 5),
        "rmsDb": round(20.0 * __import__("math").log10(max(rms, 1e-8)), 2),
        "clipRatio": round(clip_ratio, 5),
        "silenceRatio": round(silence_ratio, 4),
        "channels": 1,
    }


def _quality_score(stats: dict) -> float:
    """给素材打个 0~100 的可用度分，方便训练页排序。"""
    dur = float(stats.get("durationSec") or 0)
    sil = float(stats.get("silenceRatio") or 0)
    clip = float(stats.get("clipRatio") or 0)
    rms_db = float(stats.get("rmsDb") or -99)
    score = 100.0
    if dur < 1.5:
        score -= (1.5 - dur) * 22
    elif dur > 30:
        score -= min(20.0, (dur - 30) * 0.6)
    score -= sil * 45
    score -= clip * 120
    if rms_db < -40:
        score -= 22
    elif rms_db > -6:
        score -= 8
    return max(0.0, min(100.0, round(score, 1)))


def _save_wav(path: str, wav, sr: int) -> None:
    import torchaudio

    out = Path(path).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(str(out), wav, int(sr), encoding="PCM_S", bits_per_sample=16)


def _prepare(src: str, out: str | None):
    wav, sr = _load_mono(src, 16000)
    wav = _trim_silence(wav, 16000)
    wav = _normalize(wav)
    if out:
        _save_wav(out, wav, 16000)
    stats = _stats(wav, 16000)
    stats["score"] = _quality_score(stats)
    if out:
        stats["path"] = str(Path(out).expanduser().resolve())
    return stats


def _concat(srcs, out: str, max_seconds: float = 45.0):
    import torch

    pieces = []
    total = 0
    sr = 16000
    gap = torch.zeros(1, int(0.25 * sr), dtype=torch.float32)
    for src in srcs:
        try:
            wav, _ = _load_mono(src, sr)
            wav = _normalize(_trim_silence(wav, sr))
        except Exception as exc:  # noqa: BLE001
            log.warning("skip clip %s: %s", src, exc)
            continue
        if wav.numel() == 0:
            continue
        remain = int(max_seconds * sr) - total
        if remain <= int(0.3 * sr):
            break
        needed = int(wav.shape[1]) + (int(gap.shape[1]) if pieces else 0)
        if needed > remain:
            if pieces:
                # 宁可少用一段，也不要在句子中间硬切；后续更短的片段仍可尝试
                log.info("skip clip that does not fit: %s", src)
                continue
            # 第一段本身就超过上限：只能截断（至少保留可用参考音）
            wav = wav[:, :remain]
        if pieces:
            pieces.append(gap)
            total += gap.shape[1]
        pieces.append(wav)
        total += wav.shape[1]
    if not pieces:
        raise ValueError("没有可用的参考音频片段")
    merged = torch.cat(pieces, dim=1)
    merged = _normalize(merged)
    _save_wav(out, merged, sr)
    stats = _stats(merged, sr)
    stats["path"] = str(Path(out).expanduser().resolve())
    stats["clipsUsed"] = len([p for p in pieces if p is not gap])
    return stats


# ── 命令分发 ────────────────────────────────────────────────────────────────


def handle(req: dict, args) -> dict:
    cmd = str(req.get("cmd") or "").strip()
    if cmd == "ping":
        return {"ok": True, "pid": os.getpid(), "python": sys.version.split()[0]}
    if cmd in ("load", "voices"):
        rt = _load_runtime(args)
        voices = _voices(rt)
        return {
            "ok": True,
            "loaded": True,
            "loadMs": STATE["load_ms"],
            "voices": voices,
            "sampleRate": 48000,
            "python": sys.version.split()[0],
            "ffmpeg": _find_ffmpeg(),
        }
    if cmd == "stats":
        return {
            "ok": True,
            "loaded": STATE["runtime"] is not None,
            "loadMs": STATE["load_ms"],
            "syntheses": STATE["syntheses"],
            "python": sys.version.split()[0],
        }
    if cmd == "prepare":
        src = str(req.get("src") or "")
        if not src:
            raise ValueError("prepare 缺少 src")
        return {"ok": True, "stats": _prepare(src, req.get("out"))}
    if cmd == "analyze":
        src = str(req.get("src") or "")
        if not src:
            raise ValueError("analyze 缺少 src")
        return {"ok": True, "stats": _prepare(src, None)}
    if cmd == "concat":
        srcs = [str(x) for x in (req.get("srcs") or []) if x]
        out = str(req.get("out") or "")
        if not srcs or not out:
            raise ValueError("concat 需要 srcs 与 out")
        return {"ok": True, "stats": _concat(srcs, out, float(req.get("maxSeconds") or 45.0))}
    if cmd == "synthesize":
        rt = _load_runtime(args)
        text = str(req.get("text") or "").strip()
        if not text:
            raise ValueError("synthesize 缺少 text")
        out = str(req.get("out") or "")
        if not out:
            raise ValueError("synthesize 缺少 out")
        ref = req.get("ref") or None
        voice = str(req.get("voice") or args.voice or "Junhao")
        sample_mode = str(req.get("sampleMode") or args.sample_mode)
        started = time.time()
        result = rt.synthesize(
            text=text,
            voice=voice,
            prompt_audio_path=(str(Path(ref).expanduser().resolve()) if ref else None),
            output_audio_path=str(Path(out).expanduser().resolve()),
            sample_mode=sample_mode,
            do_sample=(sample_mode != "greedy"),
            streaming=True,
            max_new_frames=int(req.get("maxFrames") or args.max_frames),
            voice_clone_max_text_tokens=int(req.get("maxTextTokens") or 75),
            enable_wetext=bool(req.get("normalizeText", True)),
            enable_normalize_tts_text=bool(req.get("normalizeText", True)),
            seed=(int(req["seed"]) if req.get("seed") is not None else None),
        )
        elapsed = int((time.time() - started) * 1000)
        STATE["syntheses"] += 1
        audio_path = str(result.get("audio_path") or out)
        seconds = None
        try:
            seconds = _analyze_file(audio_path)["durationSec"]
        except Exception:
            pass
        return {
            "ok": True,
            "path": audio_path,
            "sampleRate": result.get("sample_rate"),
            "seconds": seconds,
            "elapsedMs": elapsed,
            "usedRef": bool(ref),
            "voice": voice,
        }
    raise ValueError(f"未知命令：{cmd}")


def _analyze_file(path: str) -> dict:
    wav, sr = _load_mono(path, 48000)
    return _stats(wav, 48000)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="voice-lab-moss-worker")
    parser.add_argument("--repo", required=True, help="MOSS-TTS-Nano 仓库目录")
    parser.add_argument("--model-dir", required=True, help="browser_onnx 模型目录")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--max-frames", type=int, default=375)
    parser.add_argument("--sample-mode", default="fixed", choices=("greedy", "fixed", "full"))
    parser.add_argument("--voice", default="Junhao")
    args = parser.parse_args(argv)

    # 先让 JS 知道进程活着；模型按需加载
    emit({"id": None, "event": "hello", "pid": os.getpid(), "python": sys.version.split()[0]})

    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            if not isinstance(req, dict):
                raise ValueError("请求必须是 JSON 对象")
            req_id = req.get("id")
            payload = handle(req, args)
            payload["id"] = req_id
            emit(payload)
        except Exception as exc:  # noqa: BLE001
            tb = traceback.format_exc()
            log.error("request failed: %s\n%s", exc, tb)
            emit(
                {
                    "id": req_id,
                    "ok": False,
                    "error": str(exc),
                    "traceback": tb[-4000:],
                }
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
