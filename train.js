import { createHash, randomUUID } from 'node:crypto'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const nowIso = () => new Date().toISOString()
const clamp = (value, min, max, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
const ensureDir = (dir) => {
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* ignore */
  }
  return dir
}
const readJson = (file, fallback = null) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}
const writeJson = (file, value) => {
  ensureDir(dirname(file))
  writeFileSync(file, JSON.stringify(value, null, 2), 'utf8')
}
const isFile = (file) => {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}
const isDir = (dir) => {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}
const safeName = (name) =>
  basename(String(name || 'audio.wav'))
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'audio.wav'
const toPosix = (p) => String(p).replace(/\\/g, '/')
const yamlPath = (p) => JSON.stringify(toPosix(p))
const fmt = (n, digits = 6) => Number(Number(n) || 0).toFixed(digits)
const readTail = (file, maxLines = 240) => {
  try {
    const size = statSync(file).size
    const start = Math.max(0, size - 128 * 1024)
    const text = readFileSync(file).subarray(start).toString('utf8')
    return text.split(/\r?\n/).slice(-maxLines)
  } catch {
    return []
  }
}

export function createTraining({ root, settingsRef, log, runProcess, audioUrl, defaultScript, previewVoxCPM, onCheckpoint }) {
  const trainRoot = join(root, 'train')
  const draftsRoot = join(trainRoot, 'drafts')
  const sessionsRoot = join(trainRoot, 'sessions')
  for (const dir of [trainRoot, draftsRoot, sessionsRoot]) ensureDir(dir)

  let currentDraftId = ''
  let currentSessionId = ''
  let active = null
  let ffmpegCache = ''
  let cleanupTimer = null

  const settings = () => settingsRef() || {}
  const trainCfg = () => settings().train || {}
  const scriptPath = () => {
    const configured = String(trainCfg().scriptPath || '').trim()
    return configured || defaultScript
  }
  const pythonPath = () => String(settings().voxcpm?.pythonPath || settings().moss?.pythonPath || '').trim()
  const baseModel = () => String(settings().voxcpm?.baseModel || '').trim()

  const modelProfiles = () => {
    const base = baseModel()
    const cfg = readJson(join(base, 'config.json'), {})
    const sampleRate = clamp(cfg?.audio_vae_config?.sample_rate, 8000, 48000, 16000)
    const outSampleRate = clamp(cfg?.audio_vae_config?.out_sample_rate, 8000, 96000, 48000)
    const py = pythonPath()
    const script = scriptPath()
    const available = Boolean(py && isFile(py) && base && isDir(base) && script && isFile(script))
    let reason = ''
    if (!py || !isFile(py)) reason = '未找到 VoxCPM Python（引擎设置 → VoxCPM）'
    else if (!base || !isDir(base)) reason = '未找到 VoxCPM 底座目录'
    else if (!script || !isFile(script)) reason = '未找到训练脚本 python/voxcpm_train.py'
    return [
      {
        id: 'voxcpm',
        name: 'VoxCPM2 + LoRA',
        sampleRate,
        outSampleRate,
        lora: true,
        available,
        reason,
      },
      {
        id: 'moss',
        name: 'MOSS-TTS-Nano',
        sampleRate: 16000,
        outSampleRate: 24000,
        lora: false,
        available: false,
        reason: 'MOSS 微调后端尚未接入；可继续使用 MOSS 零样本声线',
      },
    ]
  }

  // ── 草稿 / 写入端口数据 ──
  const draftDir = (id) => join(draftsRoot, id)
  const draftJson = (id) => join(draftDir(id), 'draft.json')
  const loadDraft = (id) => {
    if (!id || !/^[a-z0-9-]{3,80}$/i.test(String(id))) return null
    const draft = readJson(draftJson(id), null)
    if (!draft || !Array.isArray(draft.items)) return null
    return draft
  }
  const saveDraft = (draft) => {
    draft.updatedAt = nowIso()
    writeJson(draftJson(draft.id), draft)
    return draft
  }
  const newDraft = () => {
    const id = `d-${Date.now()}-${randomUUID().slice(0, 6)}`
    const draft = {
      id,
      name: '新的多音频训练',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      model: 'voxcpm',
      sampleRate: 16000,
      items: [],
    }
    ensureDir(join(draftDir(id), 'audio'))
    saveDraft(draft)
    currentDraftId = id
    return draft
  }
  const latestDraft = () => {
    let best = null
    try {
      for (const name of readdirSync(draftsRoot)) {
        const d = loadDraft(name)
        if (!d) continue
        if (!best || String(d.updatedAt || '') > String(best.updatedAt || '')) best = d
      }
    } catch {
      /* ignore */
    }
    return best
  }
  const ensureDraft = () => {
    if (currentDraftId) {
      const d = loadDraft(currentDraftId)
      if (d) return d
    }
    const d = latestDraft() || newDraft()
    currentDraftId = d.id
    return d
  }
  const itemView = (item) => ({
    id: item.id,
    index: item.index,
    name: item.name,
    text: item.text || '',
    url: audioUrl(item.path) || '',
    path: item.path,
    originalPath: item.original || '',
    sampleRate: item.sampleRate,
    sourceSampleRate: item.sourceSampleRate,
    durationSec: item.durationSec,
    size: item.size,
  })
  const draftView = (draft) => ({
    id: draft.id,
    name: draft.name || '',
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    model: draft.model || 'voxcpm',
    sampleRate: draft.sampleRate || 16000,
    items: draft.items.map(itemView),
  })

  // ── FFmpeg / 音频适配 ──
  const findFfmpeg = async () => {
    if (ffmpegCache && (ffmpegCache === 'ffmpeg' || isFile(ffmpegCache))) return ffmpegCache
    const env = String(process.env.VOICE_LAB_FFMPEG || '').trim()
    if (env && isFile(env)) {
      ffmpegCache = env
      return env
    }
    const py = pythonPath() || String(settings().moss?.pythonPath || '').trim()
    const pythons = [py, String(settings().moss?.pythonPath || '').trim(), String(settings().voxcpm?.pythonPath || '').trim()]
      .filter((p, i, arr) => p && isFile(p) && arr.indexOf(p) === i)
    for (const python of pythons) {
      const res = await runProcess(python, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], '', 30_000)
      const hit = String(res.out || '').trim().split(/\r?\n/).filter(Boolean).pop()
      if (res.ok && hit && isFile(hit)) {
        ffmpegCache = hit
        return hit
      }
    }
    const res = await runProcess('ffmpeg', ['-version'], '', 15_000)
    if (res.ok) {
      ffmpegCache = 'ffmpeg'
      return 'ffmpeg'
    }
    throw new Error('找不到 FFmpeg：请安装 imageio-ffmpeg 或设置 VOICE_LAB_FFMPEG')
  }
  const normalizeAudio = async (input, out, sampleRate) => {
    const ffmpeg = await findFfmpeg()
    const res = await runProcess(
      ffmpeg,
      ['-y', '-i', input, '-vn', '-ac', '1', '-ar', String(sampleRate), '-c:a', 'pcm_s16le', out],
      dirname(out),
      180_000,
    )
    if (!res.ok) {
      const detail = String(res.err || res.out || '').trim().split(/\r?\n/).slice(-6).join(' | ')
      throw new Error(`音频转 ${sampleRate}Hz 失败：${detail || `FFmpeg code=${res.code}`}`)
    }
    const text = String(res.err || '')
    const rateMatch = text.match(/Audio:\s*[^\n]*?(\d{2,6})\s*Hz/i)
    const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i)
    const sourceSampleRate = rateMatch ? Number(rateMatch[1]) : sampleRate
    const durationSec = durationMatch
      ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
      : null
    return { sourceSampleRate, sampleRate, durationSec }
  }

  // ── 上传（原始文件 + 规范化 WAV）──
  const readBody = (req, limit) =>
    new Promise((resolvePromise, reject) => {
      const chunks = []
      let size = 0
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > limit) {
          reject(new Error(`文件太大（上限 ${Math.round(limit / 1048576)}MB）`))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolvePromise(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  const sendJson = (res, status, value) => {
    try {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(value))
    } catch {
      /* ignore */
    }
  }
  const handleUpload = async (req, res, url) => {
    try {
      const draft = loadDraft(url.searchParams.get('draftId')) || ensureDraft()
      if (draft.items.length >= 100) throw new Error('最多 100 个音频文件')
      const rawName = decodeURIComponent(String(req.headers['x-file-name'] || url.searchParams.get('name') || 'audio.wav'))
      const name = safeName(rawName)
      const sampleRate = clamp(url.searchParams.get('sampleRate'), 8000, 48000, draft.sampleRate || 16000)
      const buf = await readBody(req, 200 * 1024 * 1024)
      if (buf.length < 512) throw new Error('文件太小，可能不是音频')
      const hash = createHash('sha256').update(buf).digest('hex')
      const duplicate = draft.items.find((item) => item.hash === hash)
      if (duplicate) throw new Error(`这段音频已经在列表里：[${duplicate.index}] ${duplicate.name}`)
      const index = draft.items.length + 1
      const dir = ensureDir(join(draftDir(draft.id), 'audio'))
      const stem = String(index).padStart(3, '0')
      const original = join(dir, `${stem}_${name}`)
      writeFileSync(original, buf)
      const wav = join(dir, `${stem}_${name.replace(/\.[^.]+$/, '')}_${sampleRate}.wav`)
      const stats = await normalizeAudio(original, wav, sampleRate)
      const item = {
        id: `a-${Date.now()}-${randomUUID().slice(0, 6)}`,
        index,
        name,
        original,
        path: wav,
        text: '',
        sourceSampleRate: stats.sourceSampleRate,
        sampleRate,
        durationSec: stats.durationSec,
        size: buf.length,
        hash,
        at: nowIso(),
      }
      draft.items.push(item)
      draft.sampleRate = sampleRate
      saveDraft(draft)
      currentDraftId = draft.id
      sendJson(res, 200, { ok: true, item: itemView(item), draft: draftView(draft) })
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e?.message || e) })
    }
  }

  // ── 训练会话 ──
  const sessionDir = (id) => join(sessionsRoot, id)
  const metaPath = (id) => join(sessionDir(id), 'meta.json')
  const loadMeta = (id) => {
    if (!id || !/^[a-z0-9-]{3,80}$/i.test(String(id))) return null
    return readJson(metaPath(id), null)
  }
  const saveMeta = (meta) => {
    meta.updatedAt = nowIso()
    writeJson(metaPath(meta.id), meta)
    return meta
  }
  const listMetas = () => {
    const list = []
    try {
      for (const name of readdirSync(sessionsRoot)) {
        const meta = loadMeta(name)
        if (meta) list.push(meta)
      }
    } catch {
      /* ignore */
    }
    return list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }
  const currentMeta = () => {
    if (currentSessionId) {
      const meta = loadMeta(currentSessionId)
      if (meta) return meta
    }
    const latest = listMetas()[0]
    currentSessionId = latest?.id || ''
    return latest || null
  }
  const sessionSummary = (meta) => ({
    id: meta.id,
    name: meta.name,
    model: meta.model,
    status: meta.status,
    steps: meta.steps,
    loraR: meta.loraR,
    sampleRate: meta.sampleRate,
    createdAt: meta.createdAt,
    finishedAt: meta.finishedAt || null,
    lastStep: meta.lastStep || 0,
    itemCount: meta.items?.length || 0,
    checkpoints: meta.checkpoints?.length || 0,
    logAvailable: isFile(meta.runLog) || isFile(join(meta.saveDir || '', 'train.log')),
    logsDeletedAt: meta.logsDeletedAt || null,
  })
  const sessionView = (meta) => {
    if (!meta) return null
    const logs = active && active.meta?.id === meta.id ? active.lines.slice(-240) : readTail(meta.runLog, 240)
    return {
      ...sessionSummary(meta),
      metrics: meta.metrics || {},
      checkpoints: [...(meta.checkpoints || [])].sort((a, b) => Number(b.step || 0) - Number(a.step || 0)),
      previews: meta.previews || [],
      logs,
      error: meta.error || '',
      items: (meta.items || []).map((item) => ({
        id: item.id,
        index: item.index,
        name: item.name,
        text: item.text,
        durationSec: item.durationSec,
      })),
    }
  }
  const state = () => {
    const draft = ensureDraft()
    const meta = currentMeta()
    return {
      models: modelProfiles(),
      backend: {
        pythonPath: pythonPath(),
        scriptPath: scriptPath(),
        baseModel: baseModel(),
        available: modelProfiles()[0].available,
        reason: modelProfiles()[0].reason,
      },
      draft: draftView(draft),
      currentSessionId: meta?.id || '',
      session: sessionView(meta),
      sessions: listMetas().map(sessionSummary),
      active: Boolean(active),
      targetPresetId: String(trainCfg().targetPresetId || ''),
      defaults: {
        model: 'voxcpm',
        steps: clamp(trainCfg().steps, 10, 100000, 1000),
        loraR: clamp(trainCfg().loraR, 4, 128, 32),
        checkpointSteps: clamp(trainCfg().checkpointEverySteps, 10, 100000, 100),
        checkpointSec: clamp(trainCfg().checkpointEverySec, 30, 3600, 300),
        pathMode: trainCfg().pathMode === 'normalized' ? 'normalized' : 'original',
        exportDir: String(trainCfg().exportDir || join(trainRoot, 'exports')),
      },
    }
  }

  const appendLine = (meta, line) => {
    const text = String(line || '').replace(/\r/g, '').trimEnd()
    if (!text) return
    if (active && active.meta?.id === meta.id) {
      active.lines.push(text)
      if (active.lines.length > 500) active.lines = active.lines.slice(-500)
    }
    try {
      appendFileSync(meta.runLog, `${text}\n`, 'utf8')
    } catch {
      /* ignore */
    }
  }
  const parseTrainLine = (line) => {
    const m = String(line).match(/^\[train\]\s+step\s+(\d+):\s*(.*)$/)
    if (!m) return null
    const step = Number(m[1])
    const fields = {}
    for (const part of m[2].split(/,\s*/)) {
      const idx = part.indexOf(':')
      if (idx < 0) continue
      const key = part.slice(0, idx).trim()
      const value = Number(part.slice(idx + 1).trim().replace(/s$/i, ''))
      if (Number.isFinite(value)) fields[key] = value
    }
    const normalized =
      `[train] step ${step}: loss/diff: ${fmt(fields['loss/diff'] || 0)}, ` +
      `loss/stop: ${fmt(fields['loss/stop'] || 0)}, lr: ${fmt(fields.lr || 0)}, ` +
      `epoch: ${fmt(fields.epoch || 0)}, grad_norm: ${fmt(fields.grad_norm || 0)}, ` +
      `log interval: ${fmt(fields['log interval'] || 0, 2)} s`
    return {
      step,
      metrics: {
        'loss/diff': fields['loss/diff'] || 0,
        'loss/stop': fields['loss/stop'] || 0,
        lr: fields.lr || 0,
        epoch: fields.epoch || 0,
        grad_norm: fields.grad_norm || 0,
        'log interval': fields['log interval'] || 0,
      },
      line: normalized,
    }
  }

  const writeDataset = (meta) => {
    const lines = (meta.items || []).map((item) => {
      const audio = meta.pathMode === 'normalized' ? item.path : item.original || item.path
      return JSON.stringify({ audio, text: String(item.text || '').trim() })
    })
    writeFileSync(meta.datasetPath, `${lines.join('\n')}\n`, 'utf8')
    return meta.datasetPath
  }
  const writeConfig = (meta) => {
    const t = trainCfg()
    const batchSize = clamp(t.batchSize, 1, 16, 1)
    const gradAccum = clamp(t.gradAccum, 1, 64, 8)
    const maxTokens = clamp(t.maxBatchTokens, 0, 32768, 2048)
    const workers = clamp(t.numWorkers, 0, 32, 2)
    const lines = [
      `pretrained_path: ${yamlPath(meta.baseModel)}`,
      `train_manifest: ${yamlPath(meta.datasetPath)}`,
      `val_manifest: null`,
      `sample_rate: ${meta.sampleRate}`,
      `out_sample_rate: ${meta.outSampleRate || 48000}`,
      `batch_size: ${batchSize}`,
      `grad_accum_steps: ${gradAccum}`,
      `num_workers: ${workers}`,
      `preprocessing_num_workers: ${workers}`,
      `num_iters: ${meta.steps}`,
      `log_interval: 10`,
      `valid_interval: ${meta.steps + 1}`,
      `save_interval: ${meta.checkpointSteps}`,
      `learning_rate: 0.0001`,
      `weight_decay: 0.01`,
      `warmup_steps: ${Math.min(100, meta.steps)}`,
      `max_steps: ${meta.steps}`,
      `max_batch_tokens: ${maxTokens}`,
      `max_grad_norm: 1.0`,
      `save_path: ${yamlPath(meta.saveDir)}`,
      `tensorboard: ${yamlPath(join(meta.sessionDir, 'logs'))}`,
      `lambdas:`,
      `  loss/diff: 1.0`,
      `  loss/stop: 1.0`,
      `lora:`,
      `  enable_lm: true`,
      `  enable_dit: true`,
      `  enable_proj: false`,
      `  r: ${meta.loraR}`,
      `  alpha: ${meta.loraR}`,
      `  dropout: 0.0`,
    ]
    writeFileSync(meta.configPath, `${lines.join('\n')}\n`, 'utf8')
    return meta.configPath
  }

  const checkpointId = (kind, step, tag) => `${kind}-${tag || Date.now()}-${step}`
  const addCheckpoint = (meta, checkpoint) => {
    meta.checkpoints = Array.isArray(meta.checkpoints) ? meta.checkpoints : []
    if (meta.checkpoints.some((c) => c.id === checkpoint.id || (c.dir && checkpoint.dir && c.dir === checkpoint.dir))) return false
    meta.checkpoints.push(checkpoint)
    if (typeof onCheckpoint === 'function') {
      Promise.resolve(onCheckpoint({ meta, checkpoint })).catch(() => {})
    }
    return true
  }
  const scanCheckpoints = (meta) => {
    let changed = false
    if (!meta.saveDir) return false
    let names = []
    try {
      names = readdirSync(meta.saveDir)
    } catch {
      return false
    }
    for (const name of names) {
      const m = name.match(/^step_(\d+)$/)
      if (!m) continue
      const dir = join(meta.saveDir, name)
      const weights = join(dir, 'lora_weights.safetensors')
      const alt = join(dir, 'model.safetensors')
      if (!isFile(weights) && !isFile(alt)) continue
      const step = Number(m[1])
      if (
        addCheckpoint(meta, {
          id: `step-${step}`,
          kind: 'step',
          step,
          dir,
          weights: isFile(weights) ? weights : alt,
          config: isFile(join(dir, 'lora_config.json')) ? join(dir, 'lora_config.json') : '',
          createdAt: nowIso(),
          size: (isFile(weights) ? statSync(weights).size : statSync(alt).size) || 0,
        })
      ) {
        changed = true
        log(`训练检查点：${meta.id} step ${step}`)
      }
    }
    const extracted = join(meta.sessionDir, 'extracted')
    try {
      for (const name of readdirSync(extracted)) {
        const dir = join(extracted, name)
        if (!isDir(dir)) continue
        const weights = join(dir, 'lora_weights.safetensors')
        if (!isFile(weights)) continue
        const m = name.match(/step_(\d+)/)
        if (
          addCheckpoint(meta, {
            id: name,
            kind: 'timer',
            step: m ? Number(m[1]) : 0,
            dir,
            weights,
            config: isFile(join(dir, 'lora_config.json')) ? join(dir, 'lora_config.json') : '',
            createdAt: nowIso(),
            size: statSync(weights).size || 0,
          })
        ) {
          changed = true
        }
      }
    } catch {
      /* ignore */
    }
    if (changed) saveMeta(meta)
    return changed
  }
  const extractLatest = (meta, kind = 'timer') => {
    const ckpts = (meta.checkpoints || [])
      .filter((c) => c.kind === 'step' && c.weights && isFile(c.weights))
      .sort((a, b) => Number(b.step || 0) - Number(a.step || 0))
    const latest = ckpts[0]
    if (!latest) return null
    const hash = createHash('sha256').update(readFileSync(latest.weights)).digest('hex').slice(0, 16)
    if (meta.lastExtractHash === hash && kind !== 'final') return null
    if (kind === 'final' && meta.lastExtractHash === hash) return null
    const tag = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    const dir = ensureDir(join(meta.sessionDir, 'extracted', `auto_${tag}_step_${latest.step}`))
    copyFileSync(latest.weights, join(dir, 'lora_weights.safetensors'))
    if (latest.config && isFile(latest.config)) copyFileSync(latest.config, join(dir, 'lora_config.json'))
    const checkpoint = {
      id: `auto-${tag}-${latest.step}`,
      kind,
      step: latest.step,
      dir,
      weights: join(dir, 'lora_weights.safetensors'),
      config: isFile(join(dir, 'lora_config.json')) ? join(dir, 'lora_config.json') : '',
      createdAt: nowIso(),
      size: statSync(join(dir, 'lora_weights.safetensors')).size || 0,
    }
    addCheckpoint(meta, checkpoint)
    meta.lastExtractHash = hash
    saveMeta(meta)
    appendLine(meta, `[checkpoint] 已提取 step ${latest.step} → ${dir}`)
    return checkpoint
  }

  const spawnTrainer = (meta) => {
    const py = pythonPath()
    const script = scriptPath()
    if (!py || !isFile(py)) throw new Error('训练 Python 不存在，请检查引擎设置 → VoxCPM')
    if (!script || !isFile(script)) throw new Error('训练脚本不存在：python/voxcpm_train.py')
    if (!meta.baseModel || !isDir(meta.baseModel)) throw new Error('VoxCPM 底座目录不存在')
    const child = spawn(py, ['-u', script, '--config_path', meta.configPath], {
      cwd: meta.sessionDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        TOKENIZERS_PARALLELISM: 'false',
        HF_HUB_OFFLINE: '1',
        TRANSFORMERS_OFFLINE: '1',
      },
      windowsHide: true,
    })
    active = {
      child,
      meta,
      pauseRequested: false,
      stopRequested: false,
      pauseTimer: null,
      lines: [],
      startedAt: Date.now(),
    }
    meta.status = 'training'
    meta.startedAt = meta.startedAt || nowIso()
    saveMeta(meta)
    appendLine(meta, `[train] 启动：${py} ${script} --config_path ${meta.configPath}`)
    let bufOut = ''
    let bufErr = ''
    const flush = (which, text) => {
      const buffer = (which === 'out' ? bufOut : bufErr) + text
      const parts = buffer.split(/\r?\n/)
      const rest = parts.pop() || ''
      if (which === 'out') bufOut = rest
      else bufErr = rest
      for (const raw of parts) {
        const line = raw.trim()
        if (!line) continue
        const parsed = parseTrainLine(line)
        if (parsed) {
          meta.lastStep = parsed.step
          meta.metrics = parsed.metrics
          appendLine(meta, parsed.line)
          saveMeta(meta)
        } else {
          appendLine(meta, line)
        }
      }
    }
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => flush('out', String(chunk)))
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk) => flush('err', String(chunk)))
    child.on('error', (e) => {
      appendLine(meta, `[error] 无法启动训练：${String(e?.message || e)}`)
      meta.status = 'failed'
      meta.error = String(e?.message || e)
      saveMeta(meta)
    })
    child.on('exit', (code, signal) => {
      if (bufOut.trim()) flush('out', '\n')
      if (bufErr.trim()) flush('err', '\n')
      const wasPause = Boolean(active?.pauseRequested)
      const wasStop = Boolean(active?.stopRequested)
      if (active?.pauseTimer) clearTimeout(active.pauseTimer)
      if (active) {
        if (active.watcher) clearInterval(active.watcher)
        if (active.extractor) clearInterval(active.extractor)
      }
      active = null
      scanCheckpoints(meta)
      extractLatest(meta, 'final')
      meta.finishedAt = nowIso()
      if (wasPause) meta.status = 'paused'
      else if (wasStop) meta.status = 'interrupted'
      else if (code === 0) meta.status = 'completed'
      else meta.status = 'failed'
      meta.exitCode = code
      meta.exitSignal = signal || ''
      if (meta.status === 'failed') {
        const tail = readTail(meta.runLog, 8).join(' | ')
        meta.error = tail.slice(-1000)
      }
      saveMeta(meta)
      appendLine(meta, `[train] ${meta.status === 'completed' ? '训练完成' : meta.status === 'paused' ? '训练暂停' : meta.status === 'interrupted' ? '训练中断' : '训练失败'}（code=${code ?? '?'}${signal ? `, signal=${signal}` : ''}）`)
      log(`多音频训练 ${meta.id} → ${meta.status}`)
    })
    active.watcher = setInterval(() => {
      try {
        scanCheckpoints(meta)
      } catch {
        /* ignore */
      }
    }, 3000)
    active.watcher.unref?.()
    active.extractor = setInterval(() => {
      try {
        scanCheckpoints(meta)
        extractLatest(meta, 'timer')
      } catch {
        /* ignore */
      }
    }, clamp(meta.checkpointSec, 30, 3600, 300) * 1000)
    active.extractor.unref?.()
    return meta
  }

  const startSession = async (payload = {}) => {
    if (active) throw new Error('已有训练在运行；请先暂停或停止')
    const pathMode = payload.pathMode === 'normalized' ? 'normalized' : 'original'
    const draft = loadDraft(payload.draftId) || ensureDraft()
    if (Array.isArray(payload.items)) {
      for (const update of payload.items) {
        const item = draft.items.find((x) => x.id === update.id)
        if (item) item.text = String(update.text || '')
      }
    }
    if (!draft.items.length) throw new Error('请先上传音频文件')
    if (draft.items.length > 100) throw new Error('最多 100 个音频文件')
    draft.items.forEach((item, index) => {
      item.index = index + 1
      if (!String(item.text || '').trim()) throw new Error(`第 ${index + 1} 段还没有角色台词`)
      const audio = pathMode === 'normalized' ? item.path : item.original || item.path
      if (!isFile(audio)) throw new Error(`第 ${index + 1} 段音频文件不存在：${audio}`)
    })
    saveDraft(draft)
    const models = modelProfiles()
    const model = models.find((m) => m.id === (payload.model || 'voxcpm')) || models[0]
    if (!model.available) throw new Error(model.reason || '训练后端不可用')
    const mismatch = pathMode === 'normalized'
      ? draft.items.find((item) => Number(item.sampleRate || 0) !== Number(model.sampleRate || 0))
      : null
    if (mismatch) {
      throw new Error(
        `第 ${mismatch.index} 段是 ${mismatch.sampleRate}Hz，与所选模型要求的 ${model.sampleRate}Hz 不匹配；请重新上传或切换模型`,
      )
    }
    const steps = clamp(payload.steps, 10, 100000, 1000)
    const loraR = clamp(payload.loraR, 4, 128, 32)
    const checkpointSteps = clamp(payload.checkpointSteps, 10, steps, 100)
    const checkpointSec = clamp(payload.checkpointSec, 30, 3600, 300)
    const id = `t-${Date.now()}-${randomUUID().slice(0, 6)}`
    const dir = ensureDir(sessionDir(id))
    for (const sub of ['save', 'logs', 'extracted', 'previews']) ensureDir(join(dir, sub))
    const meta = {
      id,
      name: String(payload.name || `多音频训练 ${new Date().toLocaleString('zh-CN')}`).slice(0, 80),
      model: model.id,
      sampleRate: model.sampleRate,
      outSampleRate: model.outSampleRate,
      baseModel: baseModel(),
      steps,
      loraR,
      checkpointSteps,
      checkpointSec,
      pathMode,
      targetPresetId: String(settings().train?.targetPresetId || payload.targetPresetId || ''),
      status: 'starting',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sessionDir: dir,
      saveDir: join(dir, 'save'),
      datasetPath: join(dir, 'dataset.jsonl'),
      configPath: join(dir, 'config.yaml'),
      runLog: join(dir, 'run.log'),
      items: draft.items.map((item) => ({
        id: item.id,
        index: item.index,
        name: item.name,
        text: String(item.text || '').trim(),
        path: item.path,
        original: item.original || item.path,
        durationSec: item.durationSec,
      })),
      checkpoints: [],
      metrics: {},
      lastStep: 0,
      previews: [],
      error: '',
    }
    writeDataset(meta)
    writeConfig(meta)
    saveMeta(meta)
    currentSessionId = id
    writeFileSync(meta.runLog, '', 'utf8')
    spawnTrainer(meta)
    const warning =
      draft.items.length < 5 || draft.items.length > 50
        ? `当前 ${draft.items.length} 个样本；推荐 5–50 个，数量过少/过多可能影响效果。`
        : ''
    return { ok: true, sessionId: id, warning, session: sessionView(meta), jsonlPath: meta.datasetPath }
  }

  const pauseSession = () => {
    if (!active) throw new Error('当前没有正在运行的训练')
    active.pauseRequested = true
    active.meta.status = 'pausing'
    saveMeta(active.meta)
    appendLine(active.meta, '[train] 收到暂停请求，正在让训练器保存检查点…')
    try {
      active.child.kill('SIGINT')
    } catch {
      /* ignore */
    }
    active.pauseTimer = setTimeout(() => {
      if (!active) return
      try {
        active.child.kill()
      } catch {
        /* ignore */
      }
    }, 20_000)
    active.pauseTimer.unref?.()
    return { ok: true, status: 'pausing' }
  }
  const resumeSession = (payload = {}) => {
    if (active) throw new Error('已有训练在运行')
    const meta = loadMeta(payload.sessionId) || currentMeta()
    if (!meta) throw new Error('找不到训练会话')
    if (!['paused', 'interrupted', 'failed'].includes(meta.status)) throw new Error('这个训练当前不需要继续')
    if (!isDir(join(meta.saveDir, 'latest')) && !readdirSync(meta.saveDir).some((name) => /^step_\d+$/.test(name))) {
      throw new Error('没有找到可继续的检查点')
    }
    currentSessionId = meta.id
    meta.status = 'starting'
    meta.error = ''
    saveMeta(meta)
    appendLine(meta, '[train] 从最新检查点继续训练…')
    spawnTrainer(meta)
    return { ok: true, sessionId: meta.id, session: sessionView(meta) }
  }
  const stopSession = () => {
    if (!active) throw new Error('当前没有正在运行的训练')
    active.stopRequested = true
    active.meta.status = 'stopping'
    saveMeta(active.meta)
    appendLine(active.meta, '[train] 收到停止请求…')
    try {
      active.child.kill()
    } catch {
      /* ignore */
    }
    return { ok: true, status: 'stopping' }
  }

  const deleteCheckpoint = (payload = {}) => {
    const meta = loadMeta(payload.sessionId) || currentMeta()
    if (!meta) throw new Error('找不到训练会话')
    const id = String(payload.checkpointId || '')
    const checkpoint = (meta.checkpoints || []).find((c) => c.id === id)
    if (!checkpoint) throw new Error('找不到这个训练版本')
    try {
      if (checkpoint.dir && isDir(checkpoint.dir)) rmSync(checkpoint.dir, { recursive: true, force: true })
      if (checkpoint.kind === 'step') {
        const latestState = readJson(join(meta.saveDir || '', 'latest', 'training_state.json'), {})
        if (Number(latestState?.step) === Number(checkpoint.step)) {
          rmSync(join(meta.saveDir, 'latest'), { recursive: true, force: true })
        }
      }
    } catch (e) {
      throw new Error(`删除失败：${String(e?.message || e)}`)
    }
    meta.checkpoints = (meta.checkpoints || []).filter((c) => c.id !== id)
    meta.previews = (meta.previews || []).filter((p) => p.checkpointId !== id)
    saveMeta(meta)
    return { ok: true, session: sessionView(meta) }
  }

  const previewCheckpoint = async (payload = {}) => {
    const meta = loadMeta(payload.sessionId) || currentMeta()
    if (!meta) throw new Error('找不到训练会话')
    const checkpoint = (meta.checkpoints || []).find((c) => c.id === String(payload.checkpointId || ''))
    if (!checkpoint) throw new Error('找不到这个训练版本')
    if (!checkpoint.weights || !isFile(checkpoint.weights)) throw new Error('这个版本没有可用的 LoRA 权重')
    if (!checkpoint.config || !isFile(checkpoint.config)) throw new Error('这个版本缺少 lora_config.json')
    const first = (meta.items || [])[0]
    if (!first || !isFile(first.path)) throw new Error('找不到训练参考音')
    const tag = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    const dir = ensureDir(join(meta.sessionDir, 'previews', `preview_${tag}`))
    copyFileSync(checkpoint.weights, join(dir, 'lora_weights.safetensors'))
    copyFileSync(checkpoint.config, join(dir, 'lora_config.json'))
    copyFileSync(first.path, join(dir, 'ref.wav'))
    writeFileSync(join(dir, 'ref.txt'), String(first.text || '').trim(), 'utf8')
    const out = join(dir, 'preview.wav')
    const text = String(payload.text || '你好，我是训练后的声线。').trim().slice(0, 2000)
    await previewVoxCPM({ weightsDir: dir, text, out })
    const entry = {
      checkpointId: checkpoint.id,
      text,
      file: out,
      url: audioUrl(out) || '',
      at: nowIso(),
    }
    meta.previews = [entry, ...(meta.previews || [])].slice(0, 20)
    saveMeta(meta)
    return { ok: true, url: entry.url, text, checkpointId: checkpoint.id, session: sessionView(meta) }
  }

  const exportPackage = async (payload = {}) => {
    const draft = loadDraft(payload.draftId) || ensureDraft()
    const session = payload.sessionId ? loadMeta(payload.sessionId) : null
    const items = session?.items?.length ? session.items : draft.items
    if (!items.length) throw new Error('还没有可导出的音频')
    const base = resolve(String(payload.dir || trainCfg().exportDir || join(trainRoot, 'exports')))
    ensureDir(base)
    if (!isDir(base)) throw new Error(`导出地址不是目录：${base}`)
    const stamp = `${Date.now()}-${randomUUID().slice(0, 4)}`
    const dir = join(base, `voxcpm_autodl_trainset_${stamp}`)
    ensureDir(dir)
    const audioDir = ensureDir(join(dir, 'audio'))
    const rows = []
    let totalSeconds = 0
    items.forEach((item, index) => {
      const text = String(item.text || '').trim()
      if (!text) throw new Error(`第 ${index + 1} 段还没有角色台词，先补充后再导出`)
      const source = item.path
      if (!source || !isFile(source)) throw new Error(`第 ${index + 1} 段音频不存在：${source}`)
      const target = join(audioDir, `${index + 1}.wav`)
      copyFileSync(source, target)
      rows.push({ audio: `audio/${index + 1}.wav`, text })
      totalSeconds += Number(item.durationSec || 0)
    })
    const trainPath = join(dir, 'train.jsonl')
    const jsonl = rows
      .map((row) => `{"audio": ${JSON.stringify(row.audio)}, "text": ${JSON.stringify(row.text)}}`)
      .join('\n')
    writeFileSync(trainPath, `${jsonl}\n`, 'utf8')
    const minutes = totalSeconds > 0 ? (totalSeconds / 60).toFixed(1) : '—'
    const steps = clamp(payload.steps, 10, 100000, session?.steps || trainCfg().steps || 1000)
    const loraR = clamp(payload.loraR, 4, 128, session?.loraR || trainCfg().loraR || 32)
    const readmePath = join(dir, 'README_AutoDL.txt')
    const readme = [
      'VoxCPM2 单说话人 LoRA 微调数据包（AutoDL 用）',
      '=================================================',
      `audio/           ${rows.length} 个 16 kHz 单声道 WAV（PCM_16），合计 ${minutes} 分钟`,
      `train.jsonl      ${rows.length} 行，格式 {"audio": "audio/N.wav", "text": "台词"}`,
      '',
      '上传建议',
      '  把本包解压到 AutoDL 的数据盘：/root/autodl-tmp/voxcpm_data/',
      '    /root/autodl-tmp/voxcpm_data/audio/1.wav ... ' + rows.length + '.wav',
      '    /root/autodl-tmp/voxcpm_data/train.jsonl',
      '',
      '命令速查（在 AutoDL 的 JupyterLab 终端里）',
      '  # 1) 拉代码',
      '  source /etc/network_turbo',
      '  git clone https://github.com/OpenBMB/VoxCPM.git',
      '  cd VoxCPM && pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple',
      '  pip install -e .',
      '',
      '  # 2) 下权重（国内走 ModelScope）',
      '  pip install -i https://pypi.tuna.tsinghua.edu.cn/simple modelscope',
      '  modelscope download --model OpenBMB/VoxCPM2 --local_dir /root/autodl-tmp/models/VoxCPM2',
      '',
      '  # 3) 校验数据',
      '  python -c "from voxcpm.training.validate import validate_manifest as v; r=v(\'/root/autodl-tmp/voxcpm_data/train.jsonl\'); print(r.is_valid())"',
      '',
      '  # 4) 修改 conf/voxcpm_v2/voxcpm_finetune_lora.yaml：',
      '  #      train_manifest: /root/autodl-tmp/voxcpm_data/train.jsonl',
      '  #      pretrained_path: /root/autodl-tmp/models/VoxCPM2',
      `  #      lora.r: ${loraR}    num_iters: ${steps}`,
      '  python scripts/train_voxcpm_finetune.py --config_path conf/voxcpm_v2/voxcpm_finetune_lora.yaml',
      '',
      '说明：本包与实测可用的 voxcpm_autodl_trainset.zip 结构一致：',
      '  audio/1.wav ... N.wav + train.jsonl + README_AutoDL.txt',
      'train.jsonl 使用相对路径 audio/N.wav，不需要改写路径。',
    ].join('\n')
    writeFileSync(readmePath, `${readme}\n`, 'utf8')
    let zipPath = ''
    const zip = `${dir}.zip`
    const helper = join(dirname(defaultScript), 'zip_dir.py')
    const py = pythonPath()
    if (py && isFile(py) && isFile(helper)) {
      const res = await runProcess(py, [helper, dir, zip], dirname(dir), 120_000)
      if (res.ok && isFile(zip)) zipPath = zip
    }
    if (!zipPath && process.platform === 'win32') {
      const command = `Compress-Archive -Path "${dir}\\*" -DestinationPath "${zip}" -Force`
      const res = await runProcess('powershell.exe', ['-NoProfile', '-Command', command], dirname(dir), 120_000)
      if (res.ok && isFile(zip)) zipPath = zip
    }
    return {
      ok: true,
      dir,
      trainPath,
      readmePath,
      zipPath,
      count: rows.length,
      seconds: totalSeconds,
    }
  }

  const cleanupLogs = () => {
    const days = clamp(trainCfg().logRetentionDays, 1, 365, 7)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    for (const meta of listMetas()) {
      if (!meta.finishedAt || meta.logsDeletedAt) continue
      const finished = Date.parse(meta.finishedAt)
      if (!Number.isFinite(finished) || finished > cutoff) continue
      try {
        if (meta.runLog && isFile(meta.runLog)) rmSync(meta.runLog, { force: true })
        if (meta.saveDir && isFile(join(meta.saveDir, 'train.log'))) rmSync(join(meta.saveDir, 'train.log'), { force: true })
        if (meta.sessionDir && isDir(join(meta.sessionDir, 'logs'))) rmSync(join(meta.sessionDir, 'logs'), { recursive: true, force: true })
        meta.logsDeletedAt = nowIso()
        saveMeta(meta)
        log(`训练日志已按 7 天策略清理：${meta.id}`)
      } catch (e) {
        log(`清理训练日志失败：${meta.id} ${String(e?.message || e)}`)
      }
    }
  }

  const handleLog = (req, res, url) => {
    try {
      const meta = loadMeta(url.searchParams.get('sessionId')) || currentMeta()
      if (!meta) throw new Error('找不到训练会话')
      const file = meta.runLog && isFile(meta.runLog) ? meta.runLog : join(meta.saveDir || '', 'train.log')
      if (!isFile(file)) throw new Error('训练日志已过期或不存在（默认保存 7 天）')
      const body = readFileSync(file)
      if (url.searchParams.get('download') === '1') {
        res.writeHead(200, {
          'content-type': 'text/plain; charset=utf-8',
          'content-disposition': `attachment; filename="voice-lab-main-train-${meta.id}.log"`,
          'content-length': body.length,
        })
        res.end(body)
        return
      }
      sendJson(res, 200, { ok: true, lines: readTail(file, 500) })
    } catch (e) {
      sendJson(res, 404, { ok: false, error: String(e?.message || e) })
    }
  }

  const handleAction = async (action, payload = {}) => {
    switch (action) {
      case 'train.state':
        return { ok: true, train: state() }
      case 'train.draft.current': {
        const draft = ensureDraft()
        return { ok: true, draft: draftView(draft) }
      }
      case 'train.draft.new': {
        const draft = newDraft()
        return { ok: true, draft: draftView(draft) }
      }
      case 'train.draft.update': {
        const draft = loadDraft(payload.draftId) || ensureDraft()
        if (Array.isArray(payload.items)) {
          for (const update of payload.items) {
            const item = draft.items.find((x) => x.id === update.id)
            if (item) item.text = String(update.text || '').slice(0, 2000)
          }
        }
        if (payload.texts && typeof payload.texts === 'object') {
          for (const [id, text] of Object.entries(payload.texts)) {
            const item = draft.items.find((x) => x.id === id)
            if (item) item.text = String(text || '').slice(0, 2000)
          }
        }
        saveDraft(draft)
        currentDraftId = draft.id
        return { ok: true, draft: draftView(draft) }
      }
      case 'train.draft.remove': {
        const draft = loadDraft(payload.draftId) || ensureDraft()
        const item = draft.items.find((x) => x.id === String(payload.itemId || ''))
        if (!item) throw new Error('找不到这个音频')
        for (const file of [item.original, item.path]) {
          try {
            if (file && isFile(file)) rmSync(file, { force: true })
          } catch {
            /* ignore */
          }
        }
        draft.items = draft.items.filter((x) => x.id !== item.id)
        draft.items.forEach((x, index) => {
          x.index = index + 1
        })
        saveDraft(draft)
        return { ok: true, draft: draftView(draft) }
      }
      case 'train.draft.removeMany': {
        const draft = loadDraft(payload.draftId) || ensureDraft()
        const ids = Array.isArray(payload.itemIds) ? [...new Set(payload.itemIds.map(String))] : []
        if (!ids.length) throw new Error('没有选中音频')
        const removeSet = new Set(ids)
        for (const item of draft.items) {
          if (!removeSet.has(item.id)) continue
          for (const file of [item.original, item.path]) {
            try {
              if (file && isFile(file)) rmSync(file, { force: true })
            } catch {
              /* ignore */
            }
          }
        }
        draft.items = draft.items.filter((item) => !removeSet.has(item.id))
        draft.items.forEach((item, index) => {
          item.index = index + 1
        })
        saveDraft(draft)
        return { ok: true, draft: draftView(draft), removed: ids.length }
      }
      case 'train.draft.reorder': {
        const draft = loadDraft(payload.draftId) || ensureDraft()
        const ids = Array.isArray(payload.itemIds) ? payload.itemIds.map(String) : []
        const byId = new Map(draft.items.map((item) => [item.id, item]))
        if (
          ids.length !== draft.items.length ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !byId.has(id))
        ) {
          throw new Error('顺序不完整，请刷新后重试')
        }
        draft.items = ids.map((id) => byId.get(id))
        draft.items.forEach((item, index) => {
          item.index = index + 1
        })
        saveDraft(draft)
        return { ok: true, draft: draftView(draft) }
      }
      case 'train.draft.jsonl': {
        const draft = loadDraft(payload.draftId) || ensureDraft()
        const pathMode = payload.pathMode === 'normalized' ? 'normalized' : 'original'
        return {
          ok: true,
          pathMode,
          lines: draft.items.map((item) => {
            const audio = pathMode === 'normalized' ? item.path : item.original || item.path
            return JSON.stringify({ audio, text: String(item.text || '').trim() })
          }),
        }
      }
      case 'train.start':
        return startSession(payload)
      case 'train.pause':
        return pauseSession()
      case 'train.resume':
        return resumeSession(payload)
      case 'train.stop':
        return stopSession()
      case 'train.session.select': {
        const meta = loadMeta(payload.sessionId)
        if (!meta) throw new Error('找不到训练会话')
        currentSessionId = meta.id
        return { ok: true, session: sessionView(meta) }
      }
      case 'train.checkpoint.delete':
        return deleteCheckpoint(payload)
      case 'train.preview':
        return previewCheckpoint(payload)
      case 'train.export':
        return exportPackage(payload)
      case 'train.logs.cleanup':
        cleanupLogs()
        return { ok: true, train: state() }
      default:
        throw new Error(`未知训练操作：${action}`)
    }
  }

  const stopAll = () => {
    if (cleanupTimer) clearInterval(cleanupTimer)
    if (!active) return
    try {
      active.stopRequested = true
      active.meta.status = 'interrupted'
      saveMeta(active.meta)
      active.child.kill()
    } catch {
      /* ignore */
    }
    if (active?.watcher) clearInterval(active.watcher)
    if (active?.extractor) clearInterval(active.extractor)
    active = null
  }

  setTimeout(() => {
    try {
      cleanupLogs()
    } catch {
      /* ignore */
    }
  }, 5000).unref?.()
  cleanupTimer = setInterval(() => {
    try {
      cleanupLogs()
    } catch {
      /* ignore */
    }
  }, 24 * 60 * 60 * 1000)
  cleanupTimer.unref?.()

  const createDraft = (payload = {}) => {
    const draft = newDraft()
    if (payload.name) draft.name = String(payload.name).slice(0, 80)
    saveDraft(draft)
    return draftView(draft)
  }

  const importPreset = async (payload = {}) => {
    const draft = newDraft()
    draft.name = String(payload.name || '从声线导入的多音频训练').slice(0, 80)
    draft.model = 'voxcpm'
    draft.sampleRate = clamp(payload.sampleRate, 8000, 48000, 16000)
    const sources = (Array.isArray(payload.items) ? payload.items : []).slice(0, 100)
    const dir = ensureDir(join(draftDir(draft.id), 'audio'))
    for (const [i, item] of sources.entries()) {
      const source = String(item.source || '')
      if (!source || !isFile(source)) continue
      const index = draft.items.length + 1
      const display = safeName(item.name || basename(source))
      const original = join(dir, `${String(index).padStart(3, '0')}_${display}`)
      copyFileSync(source, original)
      const stem = display.replace(/\.[^.]+$/, '') || 'audio'
      const wav = join(dir, `${String(index).padStart(3, '0')}_${stem}_${draft.sampleRate}.wav`)
      const stats = await normalizeAudio(original, wav, draft.sampleRate)
      draft.items.push({
        id: `a-${Date.now()}-${randomUUID().slice(0, 6)}`,
        index,
        name: display,
        original,
        path: wav,
        text: '',
        sourceSampleRate: stats.sourceSampleRate,
        sampleRate: draft.sampleRate,
        durationSec: stats.durationSec,
        size: statSync(original).size || 0,
        hash: '',
        at: nowIso(),
      })
    }
    if (!draft.items.length) throw new Error('这条声线没有可导入的音频')
    saveDraft(draft)
    currentDraftId = draft.id
    return draftView(draft)
  }

  return {
    state,
    handleAction,
    handleUpload,
    handleLog,
    cleanupLogs,
    stopAll,
    getSession: (id) => loadMeta(id),
    getDraft: (id) => loadDraft(id),
    importPreset,
    createDraft,
  }
}
