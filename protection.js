import os from 'node:os'
import { execFile } from 'node:child_process'

const clamp = (value, min, max, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

const execFileP = (command, args, timeout) =>
  new Promise((resolve) => {
    execFile(command, args, { timeout, windowsHide: true }, (error, stdout) => {
      resolve({ error, stdout: String(stdout || '') })
    })
  })

export function createProtection({ settingsRef, log, releaseResidents }) {
  const cfg = () => settingsRef()?.train || {}
  const enabled = () => cfg().smartProtection !== false
  const thresholds = () => ({
    ramFreeMb: clamp(cfg().protectRamFreeMb, 1500, 65536, 1500),
    vramFreeMb: clamp(cfg().protectVramFreeMb, 1500, 65536, 1500),
  })
  const trainingThresholds = () => ({
    ramFreeMb: Math.max(4000, thresholds().ramFreeMb),
    vramFreeMb: Math.max(2500, thresholds().vramFreeMb),
  })
  let cached = null
  let lastEvent = null
  let timer = null
  let reading = false

  const readVram = async () => {
    const candidates = [
      'nvidia-smi',
      'C:\\Windows\\System32\\nvidia-smi.exe',
      'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
    ]
    for (const command of candidates) {
      const res = await execFileP(
        command,
        ['--query-gpu=memory.total,memory.free', '--format=csv,noheader,nounits'],
        3000,
      )
      if (res.error) continue
      const line = res.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean)
      if (!line) continue
      const parts = line.split(',').map((s) => Number(s.trim()))
      if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) continue
      return { available: true, totalMb: Math.round(parts[0]), freeMb: Math.round(parts[1]) }
    }
    return { available: false, totalMb: 0, freeMb: 0, error: 'nvidia-smi 不可用' }
  }

  const readRam = async (total) => {
    let free = os.freemem() / 1048576
    if (process.platform === 'win32') {
      const res = await execFileP(
        'powershell.exe',
        ['-NoProfile', '-Command', '(Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes'],
        3000,
      )
      const available = Number(String(res.stdout || '').trim())
      if (!res.error && Number.isFinite(available) && available > 0) free = available
    }
    return {
      totalMb: Math.round(total),
      freeMb: Math.round(free),
      usedMb: Math.round(total - free),
      usedPct: total > 0 ? Math.round(((total - free) / total) * 1000) / 10 : 0,
    }
  }

  const read = async () => {
    if (reading) return cached
    reading = true
    try {
      const total = os.totalmem() / 1048576
      const ram = await readRam(total)
      const vram = await readVram()
      cached = {
        at: new Date().toISOString(),
        ram,
        vram,
        thresholds: thresholds(),
      }
    } finally {
      reading = false
    }
    return cached
  }

  const check = async (fresh = false, overrides = {}) => {
    if (!enabled()) return { ok: true, disabled: true, reasons: [], snapshot: cached }
    const snapshot = fresh || !cached ? await read() : cached
    const limits = { ...thresholds(), ...overrides }
    const reasons = []
    if (snapshot.ram.freeMb < limits.ramFreeMb) {
      reasons.push(`可用内存 ${snapshot.ram.freeMb} MB 低于保护线 ${limits.ramFreeMb} MB`)
    }
    if (snapshot.vram.available && snapshot.vram.freeMb < limits.vramFreeMb) {
      reasons.push(`可用显存 ${snapshot.vram.freeMb} MB 低于保护线 ${limits.vramFreeMb} MB`)
    }
    if (reasons.length) {
      lastEvent = {
        at: new Date().toISOString(),
        message: reasons.join('；'),
        snapshot,
      }
    }
    return { ok: reasons.length === 0, disabled: false, reasons, snapshot, thresholds: limits }
  }

  const stopCache = () => {
    if (timer) clearInterval(timer)
    timer = null
  }
  const startCache = () => {
    if (timer || !enabled()) return
    read().catch(() => {})
    timer = setInterval(() => {
      if (!enabled()) {
        stopCache()
        return
      }
      read().catch(() => {})
    }, 2500)
    timer.unref?.()
  }
  const sync = () => {
    if (enabled()) startCache()
    else stopCache()
  }
  const release = async () => {
    if (!enabled()) return
    if (typeof releaseResidents === 'function') await releaseResidents().catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await read()
  }
  const noteEvent = (message, snapshot = cached) => {
    lastEvent = { at: new Date().toISOString(), message: String(message || ''), snapshot: snapshot || cached }
  }

  startCache()
  return {
    enabled,
    thresholds,
    trainingThresholds,
    snapshot: () => cached,
    lastEvent: () => lastEvent,
    check,
    sync,
    release,
    noteEvent,
    stop: stopCache,
    log,
  }
}
