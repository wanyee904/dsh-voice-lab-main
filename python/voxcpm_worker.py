#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
VoxCPM2 + LoRA 常驻语音 worker（DSH 声线工坊）

和 MOSS worker 一样使用 stdin/stdout 的 JSON 行协议；模型只加载一次，
后续每条文本复用同一个进程，省掉每次 35 秒左右的模型加载。

用法：
  python voxcpm_worker.py --base-model /path/to/VoxCPM2 \
      --weights-dir /path/to/weights \
      --cfg-value 2.0 --steps 20 --seed 1234

请求：
  {"id":1,"cmd":"ping"}
  {"id":2,"cmd":"load"}
  {"id":3,"cmd":"synthesize","text":"...","out":"..."}
  {"id":4,"cmd":"stats"}
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
import time
import traceback
from pathlib import Path

# 先抓走协议通道，所有普通输出/进度条都赶去 stderr
_PROTOCOL_OUT = sys.__stdout__
sys.stdout = sys.stderr
for _stream in (_PROTOCOL_OUT, sys.stdin, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

log = logging.getLogger("voxcpm-worker")
logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

STATE = {"model": None, "load_ms": None, "syntheses": 0, "sample_rate": None, "ref_text": "", "gpu": ""}


def emit(payload: dict) -> None:
    _PROTOCOL_OUT.write(json.dumps(payload, ensure_ascii=False, default=str) + "\n")
    _PROTOCOL_OUT.flush()


def _read_text(path: Path, fallback: str = "") -> str:
    try:
        value = path.read_text(encoding="utf-8").strip()
        return value or fallback
    except Exception:
        return fallback


def _load(args):
    if STATE["model"] is not None:
        return STATE["model"]
    started = time.time()
    import numpy as np  # noqa: F401
    import soundfile as sf  # noqa: F401
    import torch
    from voxcpm.core import VoxCPM
    from voxcpm.model.voxcpm import LoRAConfig

    weights = Path(args.weights_dir).expanduser().resolve()
    base = str(Path(args.base_model).expanduser().resolve())
    lora_file = weights / "lora_config.json"
    if not lora_file.is_file():
        raise FileNotFoundError(f"缺少 LoRA 配置：{lora_file}")
    lora_cfg = json.loads(lora_file.read_text(encoding="utf-8"))["lora_config"]
    lora = LoRAConfig(**lora_cfg)
    ref_wav = weights / "ref.wav"
    if not ref_wav.is_file():
        raise FileNotFoundError(f"缺少参考音：{ref_wav}")
    ref_text = _read_text(weights / "ref.txt", "")
    log.info("loading VoxCPM base=%s weights=%s", base, weights)
    model = VoxCPM.from_pretrained(
        hf_model_id=base,
        load_denoiser=False,
        optimize=True,
        lora_config=lora,
        lora_weights_path=str(weights),
    )
    STATE["model"] = model
    STATE["load_ms"] = int((time.time() - started) * 1000)
    STATE["sample_rate"] = int(model.tts_model.sample_rate)
    STATE["ref_text"] = ref_text
    STATE["gpu"] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else ""
    log.info("VoxCPM loaded in %sms sampleRate=%s gpu=%s", STATE["load_ms"], STATE["sample_rate"], STATE["gpu"] or "-")
    return model


def _seed(value: int) -> None:
    import numpy as np
    import torch

    random.seed(value)
    np.random.seed(value)
    torch.manual_seed(value)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(value)


def _synthesize(args, text: str, out: str) -> dict:
    model = _load(args)
    import numpy as np
    import soundfile as sf

    weights = Path(args.weights_dir).expanduser().resolve()
    ref_wav = str(weights / "ref.wav")
    ref_text = STATE["ref_text"] or _read_text(weights / "ref.txt", "")
    _seed(int(args.seed))
    started = time.time()
    wav = np.asarray(
        model.generate(
            text=text,
            prompt_wav_path=ref_wav,
            prompt_text=ref_text,
            cfg_value=float(args.cfg_value),
            inference_timesteps=int(args.steps),
            denoise=False,
        ),
        dtype=np.float32,
    ).reshape(-1)
    peak = float(np.abs(wav).max()) if wav.size else 0.0
    fallback = False
    if peak < 0.02:
        log.warning("output near-silent (peak=%s); retry with reference_wav_path", peak)
        _seed(int(args.seed))
        wav = np.asarray(
            model.generate(
                text=text,
                reference_wav_path=ref_wav,
                cfg_value=float(args.cfg_value),
                inference_timesteps=int(args.steps),
                denoise=False,
            ),
            dtype=np.float32,
        ).reshape(-1)
        peak = float(np.abs(wav).max()) if wav.size else 0.0
        fallback = True
    out_path = Path(out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), wav, int(STATE["sample_rate"] or 48000))
    STATE["syntheses"] += 1
    return {
        "ok": True,
        "path": str(out_path),
        "seconds": round(len(wav) / float(STATE["sample_rate"] or 48000), 3),
        "sampleRate": int(STATE["sample_rate"] or 48000),
        "elapsedMs": int((time.time() - started) * 1000),
        "peak": round(peak, 4),
        "fallback": fallback,
    }


def handle(req: dict, args) -> dict:
    cmd = str(req.get("cmd") or "")
    if cmd == "ping":
        return {"ok": True, "pid": os.getpid(), "python": sys.version.split()[0]}
    if cmd in ("load", "stats"):
        if cmd == "load":
            _load(args)
        return {
            "ok": True,
            "loaded": STATE["model"] is not None,
            "loadMs": STATE["load_ms"],
            "sampleRate": STATE["sample_rate"],
            "syntheses": STATE["syntheses"],
            "gpu": STATE["gpu"],
            "weightsDir": str(Path(args.weights_dir).expanduser().resolve()),
            "baseModel": str(Path(args.base_model).expanduser().resolve()),
            "python": sys.version.split()[0],
        }
    if cmd == "synthesize":
        text = str(req.get("text") or "").strip()
        out = str(req.get("out") or "").strip()
        if not text or not out:
            raise ValueError("synthesize 需要 text 与 out")
        return _synthesize(args, text, out)
    raise ValueError(f"未知命令：{cmd}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="voice-lab-voxcpm-worker")
    parser.add_argument("--base-model", required=True)
    parser.add_argument("--weights-dir", required=True)
    parser.add_argument("--cfg-value", type=float, default=2.0)
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--seed", type=int, default=1234)
    args = parser.parse_args(argv)
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
            emit({"id": req_id, "ok": False, "error": str(exc), "traceback": tb[-4000:]})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
