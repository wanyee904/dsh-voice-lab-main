/* dsh-voice-lab-main · 声线工坊（Client 半端） */
window.__ModuleLoader__.load({
  id: 'dsh-voice-lab-main',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const PLUGIN_ID = 'dsh-voice-lab-main'
    const PANEL_ID = 'voicelab-main-panel'
    const API = '/voice-lab-main/api'
    const LS_AUTO_READ = 'dsh.voice-lab-main.autoRead'
    const LS_AUTO_PLAY = 'dsh.voice-lab-main.autoPlay'
    const LS_SEEN = 'dsh.voice-lab-main.seen'
    const AUTO_ARM_AT = Date.now() + 3000
    let SPEAK_LIMIT = 160
    let autoReadBusy = false

    // ── 文案 ────────────────────────────────────────────────────────────────
    const ZH = {
      'app.title': '声线工坊',
      'app.sub': '本机语音模型 · 声线训练 · 实时配音',
      'tab.studio': '训练台',
      'tab.train': '多音频训练',
      'tab.engine': '引擎设置',
      'tab.history': '配音历史',
      'engine.settings': '引擎设置',
      'engine.start': '启动引擎',
      'engine.starting': '启动中…',
      'engine.ready': '已就绪',
      'engine.busy': '合成中',
      'engine.loading': '加载中',
      'engine.startingState': '启动中',
      'engine.error': '引擎出错',
      'engine.stopped': '未启动',
      'engine.moss': 'MOSS-TTS-Nano',
      'engine.voxcpm': 'VoxCPM',
      'engine.openai': 'OpenAI 兼容',
      'engine.httpjson': 'HTTP JSON',
      'engine.command': '自定义命令',
      'engine.resident': '常驻语音模型',
      'engine.voxcpm.section': 'VoxCPM 常驻（本地）',
      'engine.voxcpm.start': '启动',
      'engine.voxcpm.restart': '重启',
      'engine.voxcpm.stop': '停止',
      'engine.voxcpm.starting': '正在启动 VoxCPM，首次加载约 60 秒…',
      'engine.voxcpm.stopped': 'VoxCPM 已停止',
      'engine.voxcpm.note': '使用引擎设置里配置的 VoxCPM 底座、LoRA 权重和参考音，参数保持设置里的值；常驻后不再每次重新加载（首次约 35–70 秒）。',
      'engine.voxcpm.python': 'VoxCPM Python',
      'engine.voxcpm.base': '底座目录',
      'engine.voxcpm.weights': '权重目录',
      'engine.voxcpm.cfg': 'cfg_value',
      'engine.voxcpm.steps': 'inference_timesteps',
      'engine.voxcpm.seed': 'seed',
      'engine.voxcpm.quality': '改 cfg / timesteps / seed 会改变音色或稳定性；要“质量不变”，保持 2.0 / 20 / 1234。',
      'library': '声线库',
      'newPreset': '新增预设',
      'mine': '我的声线',
      'builtin': '内置音色',
      'selectPreset': '选择预设',
      'current': '当前使用',
      'status.training': '训练中',
      'status.ready': '已保存',
      'ref.seconds': '参考音 {n} 秒',
      'ref.used': '参考音 {n} 秒 · {m} 段',
      'locked': '只读',
      'locked.title': '只读观察模式，只能选择并使用',
      'locked.note': '此声线已设为只读观察模式：不能训练、重建参考音、修改或删除；只能选择并使用。',
      'training': '训练控制台',
      'training.note': 'MOSS-TTS-Nano 是零样本克隆：它不会从更多素材里“学”出更准的声线，参考音本身就是提示。内置音色的参考只有约 7.8 秒；建议用 1–2 段干净人声，插件默认最多取 20 秒（只取能完整放下的前几段），不会把所有素材都拼进去。',
      'training.round': '第 {n} 轮',
      'training.clips': '{n} 段素材',
      'training.step': '上传素材 → 继续提交训练 → 朗读台词试听 → 完成训练并保存',
      'repair': '重建参考音',
      'preferNew': '新素材优先（推荐）',
      'preferNew.hint': '继续训练已有声线时，把这次新上传的素材放到参考音最前面；否则新素材可能因为参考音上限排不进去。',
      'repair.hint': '有 {n} 段素材没有转成 16k WAV（常见于手机录的 MP3/MP4）。点「重建参考音」重新解码并重建。',
      'toast.repaired': '参考音已重建',
      'err.busy': '上一个操作还在进行，请稍候',
      'upload.hint': '拖入或选择音频文件（wav / mp3 / m4a / flac，单文件 ≤ 40MB，建议 3–20 秒干净人声）',
      'upload.pick': '选择音频文件',
      'upload.queue': '待提交 {n} 个文件',
      'commit': '继续提交训练',
      'undo': '退回',
      'redo': '重做',
      'play': '播放音频',
      'stop': '停止',
      'readLine': '朗读台词',
      'readLine.placeholder': '输入想让这条声线朗读的台词，比如：主人，今天也要好好吃饭。',
      'textReader': '文本阅读',
      'textReader.hint': '输入文本即可用这条声线朗读；不会修改声线档案或权重。',
      'textReader.placeholder': '输入要让「{name}」朗读的文本…',
      'textReader.read': '朗读文本',
      'reader.model': '语音模型',
      'reader.auto': '跟随预设（{engine}）',
      'reader.voxcpm': 'VoxCPM 常驻（当前权重）',
      'reader.moss': 'MOSS-TTS-Nano（会换声线）',
      'reader.auto.hint': '使用预设原来的引擎，质量不变。',
      'reader.voxcpm.hint': '本地 VoxCPM 常驻，使用当前 VoxCPM 权重；其他预设选它会换成 VoxCPM 的声线。',
      'reader.moss.hint': 'MOSS 引擎；若预设没有 MOSS 参考音，会改用内置音色，声线会变。',
      'speak': '朗读台词',
      'speaking': '正在合成…',
      'finish': '完成训练并保存',
      'clips': '训练素材',
      'clips.empty': '还没有提交过素材。先选几段干净的参考音，再点「继续提交训练」。',
      'score': '可用度',
      'remove': '移除',
      'versions': '训练版本',
      'versions.empty': '还没有版本记录。',
      'delete': '删除声线',
      'delete.confirm': '确定删除这条声线？素材和试听会一起删掉，无法恢复。',
      'delete.confirm.short': '删除这条声线',
      'hideBuiltin': '隐藏',
      'hideBuiltin.title': '隐藏内置音色（模型音色仍保留，可恢复）',
      'hideBuiltin.done': '已隐藏内置音色',
      'restoreBuiltin': '恢复内置音色（{n}）',
      'restoredBuiltin': '已恢复内置音色',
      'create': '创建',
      'cancel': '取消',
      'preset.name': '声线名称',
      'preset.note': '备注（可选）',
      'preset.engine': '所属引擎',
      'preset.remoteVoice': '远程音色 id（HTTP 引擎使用）',
      'engine.form.save': '保存设置',
      'engine.probe': '检测环境',
      'engine.probeOk': '环境正常',
      'engine.probeBad': '环境有问题',
      'engine.stop': '停止引擎',
      'engine.restart': '重启引擎',
      'engine.config': '引擎配置',
      'engine.moss.python': 'Python 路径',
      'engine.moss.repo': 'MOSS 仓库目录',
      'engine.moss.model': 'ONNX 模型目录',
      'engine.moss.voice': '默认内置音色',
      'engine.moss.threads': 'CPU 线程',
      'engine.moss.frames': '最大音频帧',
      'engine.moss.refMax': '参考音上限（秒）',
      'engine.moss.normalize': '中文文本规范化',
      'engine.moss.prewarm': '加载 DSH 时预加载模型',
      'engine.openai.baseUrl': '接口地址（/v1）',
      'engine.openai.model': '模型名',
      'engine.openai.voice': '默认音色',
      'engine.openai.key': 'API Key（留空不修改）',
      'engine.openai.format': '响应格式',
      'engine.httpjson.endpoint': '接口地址',
      'engine.httpjson.headers': '请求头（JSON）',
      'engine.httpjson.body': '请求体模板',
      'engine.command.template': '命令模板',
      'engine.command.cwd': '工作目录',
      'engine.command.train': '训练命令（可选）',
      'engine.saved': '引擎设置已保存',
      'engine.dataDir': '数据目录',
      'engine.compat': '兼容与接口',
      'engine.compat.body': '同源接口：POST /voice-lab-main/api/tts，body 支持 {text, presetId}，返回 url/path。抖音插件在同一 Host 内发出 dye_reply / dye_comment / dye_chat_send 时，本插件会自动用当前声线合成语音并写入配音历史。headless 子会话若要用语音，需要在该 profile 里也安装本插件，或直接调用上面的 HTTP 接口。',
      'history.autoDouyin': '自动为抖音回复配音',
      'history.douyinPreset': '抖音回复使用声线',
      'history.autoRead': '自动朗读助手回复',
      'conflict.title': '检测到两个朗读插件同时开启',
      'conflict.chip': 'Fairy 也在朗读',
      'conflict.body': 'Fairy（dsh-fairy-zzz）的「自动朗读回复」也开着，所以同一条回复会被两套声线各念一遍。本插件已经让出自动朗读，避免双声；想让本插件接管，请到 Fairy 设置里关闭「自动朗读回复」。',
      'conflict.turnOff': '关闭本插件自动朗读',
      'conflict.takeover': '让声线工坊接管',
      'conflict.takeoverConfirm': '关闭 Fairy 的「自动朗读回复」，改由声线工坊朗读？页面会刷新一次。',
      'history.autoPlay': '自动播放新配音',
      'history.maxChars': '自动朗读最大字数',
      'history.clear': '清空历史',
      'history.empty': '还没有配音记录。回复抖音或点击「朗读台词」后会出现在这里。',
      'history.download': '下载',
      'history.pending': '正在合成 {n} 条…',
      'history.error': '最近一次自动配音失败：{msg}',
      'history.source': '来源',
      'toast.created': '已创建声线',
      'toast.saved': '已保存',
      'toast.deleted': '已删除声线',
      'toast.committed': '训练素材已提交，参考音已重建',
      'toast.finished': '训练完成，声线已保存并设为当前声线',
      'toast.undo': '已退回上一版',
      'toast.redo': '已重做下一版',
      'toast.selected': '已设为当前声线',
      'toast.probe': '环境检测完成',
      'toast.cleared': '配音历史已清空',
      'err.needFiles': '先选择音频文件',
      'err.needText': '先输入要朗读的台词',
      'err.noRef': '还没有参考音：先提交训练素材',
      'empty.title': '声线工坊',
      'empty.body': '左边选一条声线，或者新建一条。上传几段干净人声，点「继续提交训练」就能生成参考音。',
      'builtin.note': '内置音色无需训练，直接「选择预设」即可使用。',
      'ref': '参考音',
      'preview': '最近试听',
      'loading': '读取中…',
      'refresh': '刷新',
      'createdAt': '创建于',
      'readAction': '朗读',
    }
    const EN = {
      'app.title': 'Voice Lab',
      'app.sub': 'Local TTS · Voice training · Live dubbing',
      'tab.studio': 'Studio',
      'tab.train': 'Multi-audio training',
      'tab.engine': 'Engine',
      'tab.history': 'History',
      'engine.settings': 'Engine',
      'engine.start': 'Start engine',
      'engine.starting': 'Starting…',
      'engine.ready': 'Ready',
      'engine.busy': 'Synthesizing',
      'engine.loading': 'Loading',
      'engine.startingState': 'Starting',
      'engine.error': 'Engine error',
      'engine.stopped': 'Stopped',
      'engine.moss': 'MOSS-TTS-Nano',
      'engine.voxcpm': 'VoxCPM',
      'engine.openai': 'OpenAI compatible',
      'engine.httpjson': 'HTTP JSON',
      'engine.command': 'Custom command',
      'engine.resident': 'Resident voice model',
      'engine.voxcpm.section': 'VoxCPM resident (local)',
      'engine.voxcpm.start': 'Start',
      'engine.voxcpm.restart': 'Restart',
      'engine.voxcpm.stop': 'Stop',
      'engine.voxcpm.starting': 'Starting VoxCPM; first load takes about 60s…',
      'engine.voxcpm.stopped': 'VoxCPM stopped',
      'engine.voxcpm.note': 'Uses the current 当前 VoxCPM v1.1.0 base, LoRA weights, and reference with unchanged parameters, so quality stays the same; once resident it no longer reloads every call (first load 35–70s).',
      'engine.voxcpm.python': 'VoxCPM Python',
      'engine.voxcpm.base': 'Base model directory',
      'engine.voxcpm.weights': 'Weights directory',
      'engine.voxcpm.cfg': 'cfg_value',
      'engine.voxcpm.steps': 'inference_timesteps',
      'engine.voxcpm.seed': 'seed',
      'engine.voxcpm.quality': 'Changing cfg / timesteps / seed changes voice or stability; keep 2.0 / 20 / 1234 to preserve quality.',
      'library': 'Voices',
      'newPreset': 'New preset',
      'mine': 'My voices',
      'builtin': 'Built-in',
      'selectPreset': 'Use preset',
      'current': 'Active',
      'status.training': 'Training',
      'status.ready': 'Saved',
      'ref.seconds': 'Reference {n}s',
      'training': 'Training console',
      'training.note': 'MOSS-TTS-Nano is zero-shot: it does not learn a better voice from more clips — the reference audio itself is the prompt. The built-in voices use only ~7.8s; use 1–2 clean clips. The plugin keeps at most 20s (only whole clips that fit) instead of concatenating everything.',
      'training.round': 'Round {n}',
      'training.clips': '{n} clips',
      'training.step': 'Upload → Submit training → Speak a line → Finish & save',
      'repair': 'Rebuild reference',
      'preferNew': 'Prefer new clips (recommended)',
      'preferNew.hint': 'When continuing training on an existing voice, put the newly uploaded clips first; otherwise they may not fit within the reference limit.',
      'repair.hint': '{n} clip(s) were not converted to 16k WAV (common for phone MP3/MP4). Click “Rebuild reference” to decode and rebuild.',
      'toast.repaired': 'Reference rebuilt',
      'ref.used': 'Reference {n}s · {m} clip(s)',
      'locked': 'Read-only',
      'locked.title': 'Read-only observation mode; select and use only',
      'locked.note': 'This voice is read-only: it cannot be trained, rebuilt, modified, or deleted; it can only be selected and used.',
      'err.busy': 'Another operation is still running; please wait',
      'upload.hint': 'Drop or pick audio (wav / mp3 / m4a / flac, ≤40MB each, 3–20s clean speech recommended)',
      'upload.pick': 'Pick audio files',
      'upload.queue': '{n} file(s) queued',
      'commit': 'Submit more training',
      'undo': 'Undo',
      'redo': 'Redo',
      'play': 'Play audio',
      'stop': 'Stop',
      'readLine': 'Read a line',
      'readLine.placeholder': 'Type a line for this voice, e.g. Good evening, master.',
      'textReader': 'Text reader',
      'textReader.hint': 'Type any text to read with this voice; it does not modify the voice profile or weights.',
      'textReader.placeholder': 'Type text for “{name}” to read…',
      'textReader.read': 'Read text',
      'reader.model': 'Voice model',
      'reader.auto': 'Follow preset ({engine})',
      'reader.voxcpm': 'VoxCPM resident (current weights)',
      'reader.moss': 'MOSS-TTS-Nano (changes voice)',
      'reader.auto.hint': 'Use the preset’s original engine; quality unchanged.',
      'reader.voxcpm.hint': 'Local VoxCPM resident using the current VoxCPM weights. Other presets will switch to the VoxCPM voice.',
      'reader.moss.hint': 'MOSS engine; if the preset has no MOSS reference it falls back to a built-in voice, so the voice changes.',
      'speak': 'Read line',
      'speaking': 'Synthesizing…',
      'finish': 'Finish training & save',
      'clips': 'Training clips',
      'clips.empty': 'No clips yet. Pick clean reference audio, then click “Submit more training”.',
      'score': 'Quality',
      'remove': 'Remove',
      'versions': 'Versions',
      'versions.empty': 'No versions yet.',
      'delete': 'Delete voice',
      'delete.confirm': 'Delete this voice? Clips and previews are removed permanently.',
      'delete.confirm.short': 'Delete this voice',
      'hideBuiltin': 'Hide',
      'hideBuiltin.title': 'Hide this built-in voice (kept by the model, restorable)',
      'hideBuiltin.done': 'Built-in voice hidden',
      'restoreBuiltin': 'Restore built-in voices ({n})',
      'restoredBuiltin': 'Built-in voices restored',
      'create': 'Create',
      'cancel': 'Cancel',
      'preset.name': 'Voice name',
      'preset.note': 'Note (optional)',
      'preset.engine': 'Engine',
      'preset.remoteVoice': 'Remote voice id (HTTP engines)',
      'engine.form.save': 'Save settings',
      'engine.probe': 'Probe environment',
      'engine.probeOk': 'Environment OK',
      'engine.probeBad': 'Environment problem',
      'engine.stop': 'Stop engine',
      'engine.restart': 'Restart engine',
      'engine.config': 'Engine configuration',
      'engine.moss.python': 'Python path',
      'engine.moss.repo': 'MOSS repo directory',
      'engine.moss.model': 'ONNX model directory',
      'engine.moss.voice': 'Default built-in voice',
      'engine.moss.threads': 'CPU threads',
      'engine.moss.frames': 'Max audio frames',
      'engine.moss.normalize': 'Text normalization',
      'engine.moss.prewarm': 'Prewarm on DSH start',
      'engine.openai.baseUrl': 'Base URL (/v1)',
      'engine.openai.model': 'Model',
      'engine.openai.voice': 'Default voice',
      'engine.openai.key': 'API key (blank keeps current)',
      'engine.openai.format': 'Response format',
      'engine.httpjson.endpoint': 'Endpoint',
      'engine.httpjson.headers': 'Headers (JSON)',
      'engine.httpjson.body': 'Body template',
      'engine.command.template': 'Command template',
      'engine.command.cwd': 'Working directory',
      'engine.command.train': 'Training command (optional)',
      'engine.saved': 'Engine settings saved',
      'engine.dataDir': 'Data directory',
      'engine.compat': 'Compatibility & API',
      'engine.compat.body': 'Same-origin endpoint: POST /voice-lab-main/api/tts with {text, presetId}, returning url/path. When dsh-douyin-edge runs dye_reply / dye_comment / dye_chat_send in the same Host, this plugin voices the reply automatically. Headless sessions need this plugin installed in their profile, or they can call the HTTP endpoint.',
      'history.autoDouyin': 'Auto-voice Douyin replies',
      'history.douyinPreset': 'Voice for Douyin replies',
      'history.autoRead': 'Auto-read assistant replies',
      'conflict.title': 'Two read-aloud plugins are active',
      'conflict.chip': 'Fairy is reading too',
      'conflict.body': 'Fairy (dsh-fairy-zzz) also has “Auto-read assistant replies” on, so each reply is read twice with two different voices. Voice Lab now yields auto-read to avoid double audio; to let Voice Lab take over, turn off “Auto-read assistant replies” in Fairy settings.',
      'conflict.turnOff': 'Turn off Voice Lab auto-read',
      'conflict.takeover': 'Let Voice Lab take over',
      'conflict.takeoverConfirm': 'Turn off Fairy’s “Auto-read assistant replies” and let Voice Lab read instead? The page will reload once.',
      'history.autoPlay': 'Auto-play new dubs',
      'history.maxChars': 'Max auto-read characters',
      'history.clear': 'Clear history',
      'history.empty': 'No dubs yet. Reply on Douyin or use “Read line”.',
      'history.download': 'Download',
      'history.pending': 'Synthesizing {n}…',
      'history.error': 'Last auto-dub failed: {msg}',
      'history.source': 'Source',
      'toast.created': 'Voice created',
      'toast.saved': 'Saved',
      'toast.deleted': 'Voice deleted',
      'toast.committed': 'Training submitted; reference rebuilt',
      'toast.finished': 'Training finished; voice saved and activated',
      'toast.undo': 'Reverted one version',
      'toast.redo': 'Re-applied next version',
      'toast.selected': 'Selected as active voice',
      'toast.probe': 'Probe finished',
      'toast.cleared': 'Dub history cleared',
      'err.needFiles': 'Pick audio files first',
      'err.needText': 'Type a line first',
      'err.noRef': 'No reference yet: submit training clips first',
      'empty.title': 'Voice Lab',
      'empty.body': 'Pick a voice on the left or create one. Upload clean speech and click “Submit more training” to build its reference.',
      'builtin.note': 'Built-in voices need no training — just “Use preset”.',
      'ref': 'Reference',
      'preview': 'Latest preview',
      'loading': 'Loading…',
      'refresh': 'Refresh',
      'createdAt': 'Created',
      'readAction': 'Read',
    }

    function tr(ctx, key, fallback, vars) {
      let text = fallback || key
      try {
        const fn = ctx?.locale?.bind?.('voice-lab-main')
        const value = fn ? fn(key) : ''
        if (value && value !== key) text = value
      } catch {
        /* ignore */
      }
      if (vars && typeof vars === 'object') {
        for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
      }
      return text
    }

    function useLocaleTick(ctx) {
      const [, setTick] = useState(0)
      useEffect(() => {
        let off = null
        try {
          off = ctx?.locale?.subscribe?.(() => setTick((n) => n + 1)) || null
        } catch {
          off = null
        }
        return () => {
          try {
            off?.()
          } catch {
            /* ignore */
          }
        }
      }, [ctx])
    }

    // ── 图标 ────────────────────────────────────────────────────────────────
    const ICON = {
      mic: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3', 'M8 21h8'],
      wave: ['M3 12h2l2-5 3 10 3-14 3 12 2-5h3'],
      play: ['M8 5v14l11-7Z'],
      plus: ['M12 5v14', 'M5 12h14'],
      undo: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
      redo: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
      trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 14h10l1-14'],
      check: ['M4 12l5 5L20 6'],
      refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6 9a7 7 0 0 1 12-2', 'M18 15a7 7 0 0 1-12 2'],
      down: ['M12 4v12', 'M7 11l5 5 5-5', 'M5 20h14'],
      speaker: ['M4 9.5v5a1 1 0 0 0 1 1h2.6l3.6 3.1a1 1 0 0 0 1.7-.8V6.2a1 1 0 0 0-1.7-.8L7.6 8.5H5a1 1 0 0 0-1 1Z', 'M16 8.6a4.6 4.6 0 0 1 0 6.8', 'M18.8 6a8 8 0 0 1 0 12'],
      gear: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z'],
      spark: ['M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z'],
      close: ['M6 6l12 12', 'M18 6 6 18'],
      lock: ['M7 10V7a5 5 0 0 1 10 0v3', 'M5 10h14v10H5z'],
      pause: ['M8 5v14', 'M16 5v14'],
      download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
      upload: ['M12 20V8', 'M7 13l5-5 5 5', 'M5 4h14'],
    }

    function Icon({ name, size = 14 }) {
      const paths = ICON[name] || ICON.wave
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.9,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        paths.map((d, i) => h('path', { key: i, d })),
      )
    }

    // ── HTTP ────────────────────────────────────────────────────────────────
    async function getState() {
      const res = await fetch(`${API}/state`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({ ok: false, error: '无法读取状态' }))
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`)
      return json
    }

    async function post(action, payload = {}) {
      const res = await fetch(`${API}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      const json = await res.json().catch(() => ({ ok: false, error: '接口返回了非 JSON' }))
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`)
      return json
    }

    function formatSeconds(v) {
      const n = Number(v)
      if (!Number.isFinite(n)) return '—'
      return n >= 10 ? `${n.toFixed(1)}s` : `${n.toFixed(2)}s`
    }

    function formatTime(iso) {
      if (!iso) return ''
      try {
        const d = new Date(iso)
        const pad = (n) => String(n).padStart(2, '0')
        return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      } catch {
        return ''
      }
    }

    function engineLabel(ctx, engine) {
      const map = {
        moss: tr(ctx, 'engine.moss', 'MOSS-TTS-Nano'),
        voxcpm: tr(ctx, 'engine.voxcpm', 'VoxCPM'),
        openai: tr(ctx, 'engine.openai', 'OpenAI 兼容'),
        httpjson: tr(ctx, 'engine.httpjson', 'HTTP JSON'),
        command: tr(ctx, 'engine.command', '自定义命令'),
      }
      return map[engine] || engine
    }

    function stateLabel(ctx, engineState) {
      const map = {
        ready: tr(ctx, 'engine.ready', '已就绪'),
        busy: tr(ctx, 'engine.busy', '合成中'),
        loading: tr(ctx, 'engine.loading', '加载中'),
        starting: tr(ctx, 'engine.startingState', '启动中'),
        error: tr(ctx, 'engine.error', '引擎出错'),
        stopped: tr(ctx, 'engine.stopped', '未启动'),
        stopping: tr(ctx, 'engine.stopped', '未启动'),
      }
      return map[engineState] || engineState
    }

    // ── 通用组件 ────────────────────────────────────────────────────────────
    function Btn({ children, kind, size, icon, ...rest }) {
      return h(
        'button',
        {
          type: 'button',
          className: `vl-btn${kind ? ` vl-btn-${kind}` : ''}${size === 'sm' ? ' vl-btn-sm' : ''}`,
          ...rest,
        },
        icon ? h(Icon, { name: icon, size: size === 'sm' ? 12 : 14 }) : null,
        children ? h('span', null, children) : null,
      )
    }

    function Switch({ on, onChange, label, desc, disabled }) {
      return h(
        'div',
        { className: 'vl-switch-row' },
        h(
          'div',
          { className: 'vl-switch-text' },
          h('div', { className: 'vl-label' }, label),
          desc ? h('div', { className: 'vl-muted' }, desc) : null,
        ),
        h('button', {
          type: 'button',
          className: 'vl-switch',
          'data-on': on ? '1' : '0',
          'aria-pressed': !!on,
          disabled: !!disabled,
          onClick: () => onChange?.(!on),
        }),
      )
    }

    function Field({ label, hint, children }) {
      return h(
        'label',
        { className: 'vl-field' },
        h('span', { className: 'vl-field-label' }, label),
        children,
        hint ? h('span', { className: 'vl-field-hint' }, hint) : null,
      )
    }

    function TextInput(props) {
      return h('input', { className: 'vl-input', ...props })
    }

    function Toast({ text }) {
      if (!text) return null
      return h('div', { className: 'vl-toast', role: 'status' }, text)
    }

    function Empty({ ctx }) {
      return h(
        'div',
        { className: 'vl-empty' },
        h('div', { className: 'vl-empty-icon' }, h(Icon, { name: 'wave', size: 26 })),
        h('div', { className: 'vl-empty-title' }, tr(ctx, 'empty.title', '声线工坊')),
        h('div', { className: 'vl-empty-body' }, tr(ctx, 'empty.body', '') ),
      )
    }

    // ── 声线列表 ────────────────────────────────────────────────────────────
    function PresetRow({ ctx, preset, selected, active, onSelect, onDelete, busy, trainTargetId }) {
      const meta = []
      meta.push(engineLabel(ctx, preset.engine))
      if (preset.kind === 'builtin') meta.push(tr(ctx, 'builtin', '内置音色'))
      if (preset.reference?.durationSec) meta.push(tr(ctx, 'ref.seconds', '参考音 {n} 秒', { n: preset.reference.durationSec.toFixed(1) }))
      else if (preset.kind !== 'builtin') meta.push(preset.status === 'ready' ? tr(ctx, 'status.ready', '已保存') : tr(ctx, 'status.training', '训练中'))
      if (preset.locked) meta.push(tr(ctx, 'locked', '只读'))
      if (trainTargetId && preset.id === trainTargetId) meta.push(tr(ctx, 'train.targetChip', '训练目标'))
      const deleteTitle =
        preset.kind === 'builtin'
          ? tr(ctx, 'hideBuiltin.title', '隐藏内置音色（模型音色仍保留，可恢复）')
          : tr(ctx, 'delete.confirm.short', '删除这条声线')
      return h(
        'div',
        { className: 'vl-preset', 'data-selected': selected ? '1' : '0' },
        h(
          'button',
          {
            type: 'button',
            className: 'vl-preset-main',
            onClick: () => onSelect(preset.id),
            title: preset.name,
          },
          h('span', { className: 'vl-preset-avatar', 'data-kind': preset.kind }, h(Icon, { name: preset.kind === 'builtin' ? 'spark' : 'mic', size: 13 })),
          h(
            'span',
            { className: 'vl-preset-body' },
            h(
              'span',
              { className: 'vl-preset-name-row' },
              h('span', { className: 'vl-preset-name' }, preset.name),
              active ? h('span', { className: 'vl-active-dot', title: tr(ctx, 'current', '当前使用') }) : null,
            ),
            h('span', { className: 'vl-preset-meta' }, meta.join(' · ')),
          ),
        ),
        preset.locked || (trainTargetId && preset.id === trainTargetId)
          ? h(
              'span',
              {
                className: 'vl-preset-lock',
                title:
                  trainTargetId && preset.id === trainTargetId
                    ? tr(ctx, 'train.target.lockedTitle', '训练目标锁定：训练期间不能修改/删除')
                    : tr(ctx, 'locked.title', '只读观察模式，只能选择并使用'),
              },
              h(Icon, { name: 'lock', size: 12 }),
            )
          : h(
              'button',
              {
                type: 'button',
                className: 'vl-preset-del',
                title: deleteTitle,
                'aria-label': deleteTitle,
                disabled: !!busy,
                onClick: (e) => {
                  e.stopPropagation()
                  onDelete?.(preset)
                },
              },
              h(Icon, { name: 'trash', size: 12 }),
            ),
      )
    }

    // ── 工作台 ──────────────────────────────────────────────────────────────
    function Workbench({ ctx }) {
      useLocaleTick(ctx)
      const [data, setData] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState('')
      const [tab, setTab] = useState('studio')
      const [selectedId, setSelectedId] = useState('')
      const [toast, setToast] = useState('')
      const [creating, setCreating] = useState(false)
      const [draft, setDraft] = useState({ name: '', note: '', engine: 'moss', remoteVoice: '' })
      const [line, setLine] = useState('你好，我是你的新声线。今天也要一起好好干活。')
      const [readEngine, setReadEngine] = useState('auto')
      const [pendingFiles, setPendingFiles] = useState([])
      const [preferNew, setPreferNew] = useState(true)
      const [previewUrl, setPreviewUrl] = useState('')
      const [speakError, setSpeakError] = useState('')
      const [trainingWarning, setTrainingWarning] = useState('')
      const [playing, setPlaying] = useState(false)
      const [playingUrl, setPlayingUrl] = useState('')
      const [localAutoRead, setLocalAutoRead] = useState(() => {
        try {
          return localStorage.getItem(LS_AUTO_READ) !== '0'
        } catch {
          return true
        }
      })
      const [localAutoPlay, setLocalAutoPlay] = useState(() => {
        try {
          return localStorage.getItem(LS_AUTO_PLAY) !== '0'
        } catch {
          return true
        }
      })
      const fileRef = useRef(null)
      const audioRef = useRef(null)
      const pollRef = useRef(null)
      const busyRef = useRef(false)
      const lastOutboxRef = useRef('')
      const autoPlayArmedRef = useRef(false)
      const stateRef = useRef(null)
      const uiSaveTimerRef = useRef(null)
      const uiHydratedRef = useRef(false)
      const uiSettingsRef = useRef({})

      const t = useCallback((key, fallback, vars) => tr(ctx, key, fallback, vars), [ctx])

      const saveUi = useCallback((patch, immediate) => {
        if (!patch) return
        if (uiSaveTimerRef.current) clearTimeout(uiSaveTimerRef.current)
        const send = () => {
          uiSaveTimerRef.current = null
          post('ui.update', { patch }).catch(() => {})
        }
        if (immediate) send()
        else uiSaveTimerRef.current = setTimeout(send, 600)
      }, [])

      const refresh = useCallback(
        async (quiet) => {
          try {
            const next = await getState()
            setData(next)
            stateRef.current = next
            if (Number(next.settings?.maxSpeakChars) > 0) SPEAK_LIMIT = Number(next.settings.maxSpeakChars)
            setError('')
            setSelectedId((cur) => {
              if (cur && next.presets?.some((p) => p.id === cur)) return cur
              const saved = next.settings?.ui?.selectedPresetId
              if (saved && next.presets?.some((p) => p.id === saved)) return saved
              return next.activePresetId || next.presets?.[0]?.id || ''
            })
            return next
          } catch (e) {
            if (!quiet) setError(String(e?.message || e))
            return null
          }
        },
        [],
      )

      useEffect(() => {
        void refresh()
      }, [refresh])

      useEffect(() => {
        uiSettingsRef.current = data?.settings?.ui || {}
      }, [data?.settings?.ui])

      useEffect(() => {
        if (!data || uiHydratedRef.current) return
        uiHydratedRef.current = true
        const ui = data.settings?.ui || {}
        if (['studio', 'train', 'engine', 'history'].includes(ui.tab)) setTab(ui.tab)
        if (typeof ui.autoRead === 'boolean') setLocalAutoRead(ui.autoRead)
        if (typeof ui.autoPlay === 'boolean') setLocalAutoPlay(ui.autoPlay)
        if (ui.preferNew === false) setPreferNew(false)
        if (typeof ui.line === 'string' && ui.line) setLine(ui.line)
      }, [data])

      useEffect(() => {
        const tick = () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
          void refresh(true)
        }
        pollRef.current = setInterval(tick, 4000)
        return () => {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }, [refresh])

      useEffect(() => {
        if (!toast) return
        const timer = setTimeout(() => setToast(''), 2600)
        return () => clearTimeout(timer)
      }, [toast])

      useEffect(() => {
        setPreviewUrl('')
        setSpeakError('')
        setTrainingWarning('')
        const ui = uiSettingsRef.current || {}
        const saved = ui.readEngineByPreset?.[selectedId] || ui.readEngine || 'auto'
        setReadEngine(['auto', 'voxcpm', 'moss', 'openai', 'httpjson', 'command'].includes(saved) ? saved : 'auto')
      }, [selectedId])

      // 自动播放新配音
      useEffect(() => {
        if (!data?.outbox?.length) return
        const newest = data.outbox[0]
        if (!newest?.url) return
        if (!autoPlayArmedRef.current) {
          autoPlayArmedRef.current = true
          lastOutboxRef.current = newest.id
          return
        }
        if (newest.id === lastOutboxRef.current) return
        lastOutboxRef.current = newest.id
        if (!localAutoPlay) return
        if (Date.now() - new Date(newest.at).getTime() > 120_000) return
        playUrl(newest.url)
      }, [data?.outbox, localAutoPlay])

      const playUrl = useCallback((url) => {
        if (!url) return
        try {
          if (!audioRef.current) audioRef.current = new Audio()
          const audio = audioRef.current
          audio.pause()
          audio.src = url
          audio.currentTime = 0
          setPlayingUrl(url)
          setPlaying(true)
          audio.onended = () => {
            setPlaying(false)
            setPlayingUrl('')
          }
          audio.onerror = () => {
            setPlaying(false)
            setPlayingUrl('')
          }
          audio.play().catch(() => {
            setPlaying(false)
            setPlayingUrl('')
          })
        } catch {
          setPlaying(false)
        }
      }, [])

      const stopAudio = useCallback(() => {
        try {
          audioRef.current?.pause()
        } catch {
          /* ignore */
        }
        setPlaying(false)
        setPlayingUrl('')
      }, [])

      const run = useCallback(
        async (label, fn, successMessage, onError) => {
          if (busyRef.current) {
            setToast(t('err.busy', '上一个操作还在进行，请稍候'))
            return null
          }
          busyRef.current = true
          setBusy(label)
          setError('')
          try {
            const result = await fn()
            await refresh(true)
            if (successMessage) setToast(successMessage)
            return result
          } catch (e) {
            const message = String(e?.message || e)
            setError(message)
            if (onError) onError(message)
            return null
          } finally {
            busyRef.current = false
            setBusy('')
          }
        },
        [refresh, t],
      )

      const presets = data?.presets || []
      const userPresets = presets.filter((p) => p.kind !== 'builtin')
      const builtinPresets = presets.filter((p) => p.kind === 'builtin')
      const selected = presets.find((p) => p.id === selectedId) || null
      const activeId = data?.activePresetId || ''
      const engine = data?.engine || { state: 'stopped', detail: '' }

      const selectPreset = (id) => {
        setSelectedId(id)
        saveUi({ selectedPresetId: id }, true)
      }
      const changeTab = (next) => {
        setTab(next)
        saveUi({ tab: next }, true)
      }
      const changeReadEngine = (value) => {
        setReadEngine(value)
        const ui = uiSettingsRef.current || {}
        uiSettingsRef.current = {
          ...ui,
          readEngine: value,
          readEngineByPreset: { ...(ui.readEngineByPreset || {}), [selectedId]: value },
        }
        saveUi({ readEngine: value, readEngineByPreset: { [selectedId]: value } }, true)
      }
      const changeLine = (value) => {
        setLine(value)
        saveUi({ line: value })
      }

      const activatePreset = () =>
        run('选择预设', () => post('preset.select', { presetId: selected.id }), t('toast.selected', '已设为当前声线'))

      const usePresetForTraining = () =>
        run(
          '导入训练',
          async () => {
            const res = await post('train.importPreset', { presetId: selected.id })
            await refresh(true)
            changeTab('train')
            return res
          },
          t('train.imported', '已导入多音频训练'),
        )

      const usePresetAsTrainTarget = () =>
        run(
          '锁定训练目标',
          async () => {
            const res = await post('train.bindPreset', { presetId: selected.id })
            await refresh(true)
            changeTab('train')
            return res
          },
          t('train.target.bound', '已锁定为多音频训练目标'),
        )

      const createPreset = async () => {
        const res = await run('创建中', () => post('preset.create', draft), t('toast.created', '已创建声线'))
        if (res?.preset?.id) {
          setSelectedId(res.preset.id)
          saveUi({ selectedPresetId: res.preset.id }, true)
          setCreating(false)
          setDraft({ name: '', note: '', engine: data?.settings?.engine || 'moss', remoteVoice: '' })
        }
      }

      const uploadClip = async (presetId, file) => {
        const res = await fetch(
          `${API}/clip?presetId=${encodeURIComponent(presetId)}&name=${encodeURIComponent(file.name)}`,
          {
            method: 'POST',
            headers: {
              'content-type': file.type || 'application/octet-stream',
              'x-file-name': encodeURIComponent(file.name),
            },
            body: file,
          },
        )
        const json = await res.json().catch(() => ({ ok: false, error: '上传返回非 JSON' }))
        if (!res.ok || json.ok === false) throw new Error(json.error || `上传失败 HTTP ${res.status}`)
        return json
      }

      const commitTraining = async () => {
        if (!selected || selected.kind === 'builtin') return
        if (!pendingFiles.length) {
          setError(t('err.needFiles', '先选择音频文件'))
          return
        }
        setTrainingWarning('')
        const warnings = []
        let added = 0
        const result = await run(
          '提交训练',
          async () => {
            for (let i = 0; i < pendingFiles.length; i += 1) {
              setBusy(`上传 ${i + 1}/${pendingFiles.length}`)
              const uploaded = await uploadClip(selected.id, pendingFiles[i])
              if (uploaded?.duplicate) {
                warnings.push(uploaded.warning || `${pendingFiles[i].name}: 重复素材，已忽略`)
              } else {
                added += 1
              }
            }
            if (!added) throw new Error(warnings.join('；') || '没有新增素材')
            setBusy('重建参考音')
            return post('preset.commit', { presetId: selected.id, preferNew })
          },
          t('toast.committed', '训练素材已提交，参考音已重建'),
        )
        if (warnings.length) setTrainingWarning(warnings.join('；'))
        if (result?.ok) setPendingFiles([])
      }

      const speakLine = async () => {
        setSpeakError('')
        if (!selected) {
          setSpeakError('先选一条声线')
          return
        }
        if (!line.trim()) {
          setSpeakError(t('err.needText', '先输入要朗读的台词'))
          return
        }
        return run(
          '朗读台词',
          async () => {
            const res = await post('preset.speak', {
              presetId: selected.id,
              text: line,
              savePreview: true,
              engine: readEngine === 'auto' ? undefined : readEngine,
            })
            setPreviewUrl(res.previewUrl || res.url || '')
            if (res.warning) setSpeakError(res.warning)
            if (res.url) playUrl(res.url)
            return res
          },
          '',
          (message) => setSpeakError(message),
        )
      }

      const repairClips = () =>
        run(
          '重建参考音',
          async () => {
            if (!selected) throw new Error('先选一条声线')
            setSpeakError('')
            setTrainingWarning('')
            const res = await post('preset.repair', { presetId: selected.id })
            if (Array.isArray(res.errors) && res.errors.length) setTrainingWarning(res.errors.join('；'))
            return res
          },
          t('toast.repaired', '参考音已重建'),
          (message) => setTrainingWarning(message),
        )

      const finishTraining = () =>
        run('完成训练', () => post('preset.finish', { presetId: selected.id }), t('toast.finished', '训练完成，声线已保存并设为当前声线'))

      const undo = () =>
        run('退回', () => post('preset.undo', { presetId: selected.id }), t('toast.undo', '已退回上一版'))

      const redo = () =>
        run('重做', () => post('preset.redo', { presetId: selected.id }), t('toast.redo', '已重做下一版'))

      const removeClip = (clipId) => {
        if (!selected) return
        run('移除素材', () => post('clip.remove', { presetId: selected.id, clipId }), t('toast.saved', '已保存'))
      }

      const deleteRow = (preset) => {
        if (!preset) return
        if (preset.kind === 'builtin') {
          run('隐藏内置音色', () => post('preset.hide', { presetId: preset.id }), t('hideBuiltin.done', '已隐藏内置音色'))
          return
        }
        if (!window.confirm(t('delete.confirm', '确定删除这条声线？'))) return
        run('删除声线', () => post('preset.delete', { presetId: preset.id }), t('toast.deleted', '已删除声线'))
      }

      const deletePreset = () => {
        if (!selected || selected.kind === 'builtin') return
        deleteRow(selected)
      }

      const restoreBuiltins = () =>
        run('恢复内置音色', () => post('preset.unhideAll'), t('restoredBuiltin', '已恢复内置音色'))

      const pickFiles = (fileList) => {
        const files = Array.from(fileList || []).filter((f) => f.size > 0)
        if (files.length) setPendingFiles((cur) => [...cur, ...files].slice(0, 12))
      }

      const browserPlayTarget = () => {
        if (!selected) return ''
        if (selected.reference?.url) return selected.reference.url
        if (selected.previews?.length) return selected.previews[selected.previews.length - 1].url
        return ''
      }

      const playAudio = () => {
        const url = browserPlayTarget()
        if (!url) {
          setError(t('err.noRef', '还没有参考音：先提交训练素材'))
          return
        }
        playUrl(url)
      }

      const toggleAutoRead = (next) => {
        setLocalAutoRead(next)
        saveUi({ autoRead: next }, true)
        try {
          localStorage.setItem(LS_AUTO_READ, next ? '1' : '0')
        } catch {
          /* ignore */
        }
      }
      const toggleAutoPlay = (next) => {
        setLocalAutoPlay(next)
        saveUi({ autoPlay: next }, true)
        try {
          localStorage.setItem(LS_AUTO_PLAY, next ? '1' : '0')
        } catch {
          /* ignore */
        }
      }

      const saveSetting = (patch, message) =>
        run('保存设置', () => post('settings.update', { settings: patch }), message || t('toast.saved', '已保存'))

      const startEngine = () => run('启动引擎', () => post('engine.start'), t('engine.ready', '已就绪'))

      const engineState = engine.state || 'stopped'
      const engineChip = h(
        'span',
        { className: 'vl-engine', 'data-state': engineState, title: engine.detail || '' },
        h('i', null),
        `${engineLabel(ctx, engine.mode || data?.settings?.engine || 'moss')} · ${stateLabel(ctx, engineState)}`,
      )
      const fairyConflict = localAutoRead && fairyAutoVoiceOn()

      const renderTextReader = (readOnly) => {
        const readerModelHint =
          readEngine === 'voxcpm'
            ? t(
                'reader.voxcpm.hint',
                '本地 VoxCPM 常驻，使用当前 VoxCPM 权重；其他预设选它会换成 VoxCPM 的声线。',
              )
            : readEngine === 'moss'
              ? t('reader.moss.hint', 'MOSS 引擎；若预设没有 MOSS 参考音，会改用内置音色，声线会变。')
              : t('reader.auto.hint', '使用预设原来的引擎，质量不变。')
        return h(
          'section',
          { className: 'vl-card' },
          h(
            'div',
            { className: 'vl-card-head' },
            h('span', { className: 'vl-card-title' }, readOnly ? t('textReader', '文本阅读') : t('readLine', '朗读台词')),
            h('span', { className: 'vl-muted' }, `${line.length}/2000`),
            previewUrl ? h('span', { className: 'vl-muted' }, t('preview', '最近试听')) : null,
          ),
          h(
            'div',
            { className: 'vl-reader-model' },
            h('span', { className: 'vl-label' }, t('reader.model', '语音模型')),
            h(
              'select',
              {
                className: 'vl-input vl-input-sm',
                value: readEngine,
                onChange: (e) => changeReadEngine(e.target.value),
                title: readerModelHint,
              },
              h(
                'option',
                { value: 'auto' },
                t('reader.auto', '跟随预设（{engine}）', { engine: engineLabel(ctx, selected?.engine) }),
              ),
              h('option', { value: 'voxcpm' }, t('reader.voxcpm', 'VoxCPM 常驻（当前权重）')),
              h('option', { value: 'moss' }, t('reader.moss', 'MOSS-TTS-Nano（会换声线）')),
            ),
            h('span', { className: 'vl-muted vl-reader-hint' }, readerModelHint),
          ),
          readOnly
            ? h(
                'p',
                { className: 'vl-help' },
                t('textReader.hint', '输入文本即可用这条声线朗读；不会修改声线档案或权重。'),
              )
            : null,
          h('textarea', {
            className: 'vl-textarea',
            rows: readOnly ? 4 : 3,
            maxLength: 2000,
            value: line,
            placeholder: readOnly
              ? t('textReader.placeholder', '输入要让「{name}」朗读的文本…', { name: selected?.name || '' })
              : t('readLine.placeholder', '输入想让这条声线朗读的台词…'),
            onChange: (e) => {
              changeLine(e.target.value)
              setSpeakError('')
            },
            onKeyDown: (e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                speakLine()
              }
            },
          }),
          h(
            'div',
            { className: 'vl-toolbar' },
            h(
              Btn,
              { kind: 'primary', icon: 'mic', onClick: speakLine, disabled: !!busy },
              busy ? t('speaking', '正在合成…') : readOnly ? t('textReader.read', '朗读文本') : t('speak', '朗读台词'),
            ),
            h('span', { className: 'vl-muted vl-kbd' }, 'Ctrl + Enter'),
            previewUrl
              ? h('audio', {
                  controls: true,
                  preload: 'none',
                  src: `${previewUrl}?t=${Date.now()}`,
                  className: 'vl-inline-audio',
                })
              : null,
          ),
          speakError ? h('div', { className: 'vl-error-inline' }, speakError) : null,
        )
      }

      if (!data) {
        return h(
          'div',
          { className: 'vl-root' },
          h('style', null, CSS),
          h('div', { className: 'vl-loading' }, h('span', { className: 'vl-spinner' }), tr(ctx, 'loading', '读取中…')),
          error ? h('div', { className: 'vl-error-bar' }, error) : null,
        )
      }

      return h(
        'div',
        { className: 'vl-root' },
        h('style', null, CSS),
        h(
          'header',
          { className: 'vl-head' },
          h(
            'div',
            { className: 'vl-ident' },
            h('div', { className: 'vl-logo' }, h(Icon, { name: 'wave', size: 19 })),
            h(
              'div',
              null,
              h('div', { className: 'vl-title' }, t('app.title', '声线工坊')),
              h('div', { className: 'vl-sub' }, t('app.sub', '本机语音模型 · 声线训练 · 实时配音')),
            ),
          ),
          h(
            'div',
            { className: 'vl-head-actions' },
            engineChip,
            fairyConflict
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'vl-chip vl-chip-btn',
                    'data-tone': 'warn',
                    title: t('conflict.title', '检测到两个朗读插件同时开启'),
                    onClick: () => changeTab('history'),
                  },
                  t('conflict.chip', 'Fairy 也在朗读'),
                )
              : null,
            h(Btn, { kind: 'ghost', icon: 'refresh', onClick: () => refresh(), disabled: !!busy }, t('refresh', '刷新')),
            h(Btn, { onClick: () => changeTab('engine') }, t('engine.settings', '引擎设置')),
            h(Btn, { kind: 'primary', icon: 'play', onClick: startEngine, disabled: !!busy || engineState === 'ready' || engineState === 'busy' }, t('engine.start', '启动引擎')),
          ),
        ),
        h(
          'nav',
          { className: 'vl-tabs' },
          ['studio', 'train', 'engine', 'history'].map((key) =>
            h(
              'button',
              {
                key,
                type: 'button',
                className: 'vl-tab',
                'data-on': tab === key ? '1' : '0',
                onClick: () => changeTab(key),
              },
              t(`tab.${key}`, key),
              key === 'history' && data.douyin?.pending ? h('span', { className: 'vl-tab-badge' }, data.douyin.pending) : null,
            ),
          ),
          h('span', { className: 'vl-tab-spacer' }),
          busy ? h('span', { className: 'vl-busy' }, h('span', { className: 'vl-spinner' }), busy) : null,
        ),
        h(
          'div',
          { className: 'vl-scroll' },
          error ? h('div', { className: 'vl-error-bar' }, error, h('button', { type: 'button', onClick: () => setError('') }, '×')) : null,
          tab === 'studio'
            ? h(
                'div',
                { className: 'vl-grid' },
                h(
                  'aside',
                  { className: 'vl-card vl-aside' },
                  h(
                    'div',
                    { className: 'vl-card-head' },
                    h('span', { className: 'vl-card-title' }, t('library', '声线库')),
                    h(Btn, { size: 'sm', icon: 'plus', onClick: () => setCreating(true) }, t('newPreset', '新增预设')),
                  ),
                  h('div', { className: 'vl-group-title' }, t('mine', '我的声线')),
                  userPresets.length
                    ? userPresets.map((p) =>
                        h(PresetRow, {
                          key: p.id,
                          ctx,
                          preset: p,
                          selected: p.id === selectedId,
                          active: p.id === activeId,
                          onSelect: selectPreset,
                          onDelete: deleteRow,
                          busy,
                          trainTargetId: data.train?.targetPresetId,
                        }),
                      )
                    : h('div', { className: 'vl-muted vl-aside-empty' }, '还没有自建声线'),
                  h('div', { className: 'vl-group-title' }, t('builtin', '内置音色')),
                  builtinPresets.map((p) =>
                    h(PresetRow, {
                      key: p.id,
                      ctx,
                      preset: p,
                      selected: p.id === selectedId,
                      active: p.id === activeId,
                      onSelect: selectPreset,
                      onDelete: deleteRow,
                      busy,
                      trainTargetId: data.train?.targetPresetId,
                    }),
                  ),
                  data.hiddenBuiltinCount
                    ? h(
                        'button',
                        { type: 'button', className: 'vl-restore', onClick: restoreBuiltins, disabled: !!busy },
                        h(Icon, { name: 'refresh', size: 12 }),
                        t('restoreBuiltin', '恢复内置音色（{n}）', { n: data.hiddenBuiltinCount }),
                      )
                    : null,
                ),
                h(
                  'div',
                  { className: 'vl-main' },
                  !selected
                    ? h(Empty, { ctx })
                    : h(
                        React.Fragment,
                        null,
                        h(
                          'section',
                          { className: 'vl-card' },
                          h(
                            'div',
                            { className: 'vl-row-between vl-wrap' },
                            h(
                              'div',
                              { className: 'vl-title-block' },
                              h(
                                'div',
                                { className: 'vl-h2' },
                                selected.name,
                                h('span', { className: 'vl-chip', 'data-tone': selected.status === 'ready' ? 'ok' : 'warn' }, selected.status === 'ready' ? t('status.ready', '已保存') : t('status.training', '训练中')),
                                selected.id === activeId ? h('span', { className: 'vl-chip', 'data-tone': 'brand' }, t('current', '当前使用')) : null,
                                selected.id === data.train?.targetPresetId ? h('span', { className: 'vl-chip', 'data-tone': 'brand' }, t('train.targetChip', '训练目标')) : null,
                                selected.locked ? h('span', { className: 'vl-chip', 'data-tone': 'idle', title: selected.lockReason || '' }, t('locked', '只读')) : null,
                              ),
                              h(
                                'div',
                                { className: 'vl-muted' },
                                [
                                  engineLabel(ctx, selected.engine),
                                  selected.kind === 'builtin' ? t('builtin', '内置音色') : t('mine', '我的声线'),
                                  selected.reference?.durationSec
                                    ? t('ref.used', '参考音 {n} 秒 · {m} 段', {
                                        n: selected.reference.durationSec.toFixed(1),
                                        m: selected.reference.clipsUsed ?? '?',
                                      })
                                    : null,
                                  selected.rounds?.length ? t('training.round', '第 {n} 轮', { n: selected.rounds.length }) : null,
                                  `${selected.clipCount || 0} 段素材`,
                                ]
                                  .filter(Boolean)
                                  .join(' · '),
                              ),
                              selected.note ? h('div', { className: 'vl-note' }, selected.note) : null,
                            ),
                            h(
                              'div',
                              { className: 'vl-actions' },
                              h(Btn, { icon: 'check', kind: selected.id === activeId ? 'ghost' : 'primary', onClick: activatePreset, disabled: !!busy || selected.id === activeId }, t('selectPreset', '选择预设')),
                              h(Btn, { icon: playing ? 'wave' : 'play', onClick: playing ? stopAudio : playAudio }, playing ? t('stop', '停止') : t('play', '播放音频')),
                              selected.kind !== 'builtin'
                                ? h(
                                    Btn,
                                    {
                                      icon: 'mic',
                                      onClick: usePresetForTraining,
                                      disabled: !!busy || selected.locked,
                                      title: selected.locked ? t('train.locked', '只读声线不能导入训练') : '',
                                    },
                                    t('train.usePreset', '用此声线训练'),
                                  )
                                : null,
                              selected.kind !== 'builtin'
                                ? h(
                                    Btn,
                                    {
                                      icon: 'lock',
                                      onClick: usePresetAsTrainTarget,
                                      disabled: !!busy || selected.locked,
                                      title: selected.locked ? t('train.locked', '只读声线不能设为训练目标') : '',
                                    },
                                    t('train.multi', '多音频训练'),
                                  )
                                : null,
                              selected.kind === 'builtin'
                                ? h(Btn, { kind: 'ghost', icon: 'trash', onClick: () => deleteRow(selected), disabled: !!busy }, t('hideBuiltin', '隐藏'))
                                : null,
                            ),
                          ),
                          selected.reference?.url
                            ? h(
                                'div',
                                { className: 'vl-audio-strip' },
                                h('span', { className: 'vl-audio-label' }, t('ref', '参考音')),
                                h('audio', { controls: true, preload: 'none', src: `${selected.reference.url}?t=${encodeURIComponent(selected.reference.builtAt || '')}` }),
                                h('span', { className: 'vl-muted' }, formatSeconds(selected.reference.durationSec)),
                              )
                            : null,
                        ),
                        selected.kind === 'builtin'
                          ? h(
                              React.Fragment,
                              null,
                              h('section', { className: 'vl-card vl-note-card' }, h(Icon, { name: 'spark', size: 15 }), h('span', null, t('builtin.note', '内置音色无需训练，直接「选择预设」即可使用。'))),
                              renderTextReader(true),
                            )
                          : selected.locked
                            ? h(
                                React.Fragment,
                                null,
                                h(
                                  'section',
                                  { className: 'vl-card vl-note-card' },
                                  h(Icon, { name: 'lock', size: 15 }),
                                  h('span', null, t('locked.note', '此声线已设为只读观察模式：不能训练、重建参考音、修改或删除；只能选择并使用。')),
                                ),
                                renderTextReader(true),
                              )
                            : selected.id === data.train?.targetPresetId
                              ? h(
                                  React.Fragment,
                                  null,
                                  h(
                                    'section',
                                    { className: 'vl-card vl-note-card' },
                                    h(Icon, { name: 'lock', size: 15 }),
                                    h(
                                      'span',
                                      null,
                                      t(
                                        'train.target.note',
                                        '此声线已锁定为多音频训练目标：训练检查点会自动导入，期间不能修改、删除或重建；只能选择、朗读和使用。到「多音频训练」页可解除锁定。',
                                      ),
                                    ),
                                  ),
                                  renderTextReader(false),
                                )
                              : h(
                              React.Fragment,
                              null,
                              h(
                                'section',
                                { className: 'vl-card' },
                                h(
                                  'div',
                                  { className: 'vl-card-head' },
                                  h('span', { className: 'vl-card-title' }, t('training', '训练控制台')),
                                  h('span', { className: 'vl-muted' }, t('training.round', '第 {n} 轮', { n: selected.rounds?.length || 0 })),
                                ),
                                h('p', { className: 'vl-help' }, t('training.note', '')),
                                selected.clips?.some((c) => !c.normalized)
                                  ? h(
                                      'div',
                                      { className: 'vl-error-inline' },
                                      t(
                                        'repair.hint',
                                        '有 {n} 段素材没有转成 16k WAV（常见于手机录的 MP3/MP4）。点「重建参考音」重新解码并重建。',
                                        { n: selected.clips.filter((c) => !c.normalized).length },
                                      ),
                                    )
                                  : null,
                                trainingWarning ? h('div', { className: 'vl-error-inline' }, trainingWarning) : null,
                                h(
                                  'label',
                                  { className: 'vl-check' },
                                  h('input', {
                                    type: 'checkbox',
                                    checked: preferNew,
                                    onChange: (e) => {
                                      const next = e.target.checked
                                      setPreferNew(next)
                                      saveUi({ preferNew: next }, true)
                                    },
                                  }),
                                  h(
                                    'span',
                                    { className: 'vl-check-text' },
                                    h('span', { className: 'vl-label' }, t('preferNew', '新素材优先（推荐）')),
                                    h('span', { className: 'vl-muted' }, t('preferNew.hint', '继续训练已有声线时，把这次新上传的素材放到参考音最前面。')),
                                  ),
                                ),
                                h(
                                  'div',
                                  { className: 'vl-toolbar' },
                                  h(Btn, { icon: 'undo', onClick: undo, disabled: !!busy || !selected.canUndo }, t('undo', '退回')),
                                  h(Btn, { icon: 'redo', onClick: redo, disabled: !!busy || !selected.canRedo }, t('redo', '重做')),
                                  h(Btn, { icon: 'play', onClick: playAudio, disabled: !!busy }, t('play', '播放音频')),
                                  h(Btn, { icon: 'plus', onClick: () => fileRef.current?.click(), disabled: !!busy }, t('upload.pick', '选择音频文件')),
                                  h(Btn, { icon: 'refresh', onClick: repairClips, disabled: !!busy }, t('repair', '重建参考音')),
                                  h(Btn, { kind: 'primary', icon: 'mic', onClick: commitTraining, disabled: !!busy || !pendingFiles.length }, t('commit', '继续提交训练')),
                                  h(Btn, { kind: 'primary', icon: 'check', onClick: finishTraining, disabled: !!busy }, t('finish', '完成训练并保存')),
                                ),
                                h('div', { className: 'vl-steps' }, t('training.step', '')),
                                h(
                                  'div',
                                  {
                                    className: 'vl-drop',
                                    onDragOver: (e) => {
                                      e.preventDefault()
                                    },
                                    onDrop: (e) => {
                                      e.preventDefault()
                                      pickFiles(e.dataTransfer?.files)
                                    },
                                  },
                                  h('input', {
                                    ref: fileRef,
                                    type: 'file',
                                    accept: 'audio/*,.wav,.mp3,.m4a,.aac,.ogg,.opus,.flac',
                                    multiple: true,
                                    style: { display: 'none' },
                                    onChange: (e) => {
                                      pickFiles(e.target.files)
                                      e.target.value = ''
                                    },
                                  }),
                                  h('div', { className: 'vl-drop-text' }, t('upload.hint', '拖入或选择音频文件')),
                                  pendingFiles.length
                                    ? h(
                                        'div',
                                        { className: 'vl-queue' },
                                        h('span', { className: 'vl-muted' }, t('upload.queue', '待提交 {n} 个文件', { n: pendingFiles.length })),
                                        h(
                                          'div',
                                          { className: 'vl-chips' },
                                          pendingFiles.map((f, i) =>
                                            h(
                                              'span',
                                              { key: `${f.name}-${i}`, className: 'vl-file-chip' },
                                              f.name,
                                              h(
                                                'button',
                                                {
                                                  type: 'button',
                                                  'aria-label': '移除',
                                                  onClick: () => setPendingFiles((cur) => cur.filter((_, idx) => idx !== i)),
                                                },
                                                '×',
                                              ),
                                            ),
                                          ),
                                        ),
                                      )
                                    : null,
                                ),
                              ),
                              renderTextReader(false),
                              h(
                                'section',
                                { className: 'vl-card' },
                                h(
                                  'div',
                                  { className: 'vl-card-head' },
                                  h('span', { className: 'vl-card-title' }, t('clips', '训练素材')),
                                  h('span', { className: 'vl-muted' }, `${selected.clipCount || 0}`),
                                ),
                                selected.clips?.length
                                  ? h(
                                      'div',
                                      { className: 'vl-clip-list' },
                                      selected.clips.map((clip) =>
                                        h(
                                          'div',
                                          { key: clip.id, className: 'vl-clip', 'data-dim': clip.active ? '0' : '1' },
                                          h(
                                            'button',
                                            {
                                              type: 'button',
                                              className: 'vl-play-dot',
                                              title: t('play', '播放音频'),
                                              onClick: () => playUrl(clip.url),
                                              disabled: !clip.url,
                                            },
                                            h(Icon, { name: 'play', size: 11 }),
                                          ),
                                          h(
                                            'div',
                                            { className: 'vl-clip-body' },
                                            h('div', { className: 'vl-clip-name' }, clip.name),
                                            h(
                                              'div',
                                              { className: 'vl-clip-meta' },
                                              [
                                                clip.durationSec != null ? formatSeconds(clip.durationSec) : null,
                                                clip.score != null ? `${t('score', '可用度')} ${clip.score}` : null,
                                                clip.normalized ? '16k' : 'raw',
                                                clip.inReference ? '参考音' : clip.active ? '未入选参考音' : '未纳入',
                                              ]
                                                .filter(Boolean)
                                                .join(' · '),
                                            ),
                                          ),
                                          h(
                                            'button',
                                            {
                                              type: 'button',
                                              className: 'vl-icon-btn',
                                              title: t('remove', '移除'),
                                              onClick: () => removeClip(clip.id),
                                              disabled: !!busy || !clip.active,
                                            },
                                            h(Icon, { name: 'close', size: 12 }),
                                          ),
                                        ),
                                      ),
                                    )
                                  : h('div', { className: 'vl-muted' }, t('clips.empty', '还没有提交过素材。')),
                              ),
                              h(
                                'section',
                                { className: 'vl-card' },
                                h(
                                  'div',
                                  { className: 'vl-card-head' },
                                  h('span', { className: 'vl-card-title' }, t('versions', '训练版本')),
                                  h('span', { className: 'vl-muted' }, `${(selected.versions || []).length}`),
                                ),
                                selected.versions?.length
                                  ? h(
                                      'div',
                                      { className: 'vl-versions' },
                                      selected.versions.map((v) =>
                                        h(
                                          'div',
                                          { key: v.index, className: 'vl-version', 'data-current': v.current ? '1' : '0' },
                                          h('span', { className: 'vl-version-index' }, v.index + 1),
                                          h('span', { className: 'vl-version-label' }, v.label),
                                          h('span', { className: 'vl-muted' }, `${v.clipIds.length} 段 · ${formatTime(v.at)}`),
                                        ),
                                      ),
                                    )
                                  : h('div', { className: 'vl-muted' }, t('versions.empty', '还没有版本记录。')),
                              ),
                              selected.editable
                                ? h(
                                    'section',
                                    { className: 'vl-card vl-danger-card' },
                                    h(
                                      'div',
                                      { className: 'vl-row-between' },
                                      h('div', { className: 'vl-muted' }, selected.createdAt ? `${t('createdAt', '创建于')} ${formatTime(selected.createdAt)}` : ''),
                                      h(Btn, { kind: 'danger', icon: 'trash', onClick: deletePreset, disabled: !!busy }, t('delete', '删除声线')),
                                    ),
                                  )
                                : null,
                            ),
                      ),
                ),
              )
            : null,
          tab === 'train'
            ? h(TrainPanel, {
                key: 'train',
                ctx,
                data,
                busy,
                run,
                refresh,
                playUrl,
                setToast,
                onOpenPreset: (id) => {
                  selectPreset(id)
                  changeTab('studio')
                },
                t,
              })
            : null,
          tab === 'engine'
            ? h(EnginePanel, {
                key: 'engine',
                ctx,
                data,
                busy,
                run,
                toast,
                setToast,
                startEngine,
                t,
              })
            : null,
          tab === 'history'
            ? h(HistoryPanel, {
                key: 'history',
                ctx,
                data,
                busy,
                run,
                refresh,
                localAutoRead,
                toggleAutoRead,
                localAutoPlay,
                toggleAutoPlay,
                saveSetting,
                playUrl,
                t,
              })
            : null,
        ),
        h(Toast, { text: toast }),
        creating ? h(NewPresetModal, { ctx, draft, setDraft, onClose: () => setCreating(false), onCreate: createPreset, busy, t, data }) : null,
      )
    }

    // ── 新建预设弹窗 ────────────────────────────────────────────────────────
    function NewPresetModal({ ctx, draft, setDraft, onClose, onCreate, busy, t, data }) {
      useEffect(() => {
        const onKey = (e) => {
          if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onClose])
      return h(
        'div',
        { className: 'vl-mask', onMouseDown: (e) => e.target === e.currentTarget && onClose() },
        h(
          'div',
          { className: 'vl-modal', role: 'dialog', 'aria-modal': 'true' },
          h(
            'div',
            { className: 'vl-card-head' },
            h('span', { className: 'vl-card-title' }, t('newPreset', '新增预设')),
            h('button', { type: 'button', className: 'vl-icon-btn', onClick: onClose, 'aria-label': t('cancel', '取消') }, h(Icon, { name: 'close', size: 14 })),
          ),
          h(
            Field,
            { label: t('preset.name', '声线名称') },
            h(TextInput, {
              autoFocus: true,
              value: draft.name,
              maxLength: 40,
              placeholder: '例如：夜班电台',
              onChange: (e) => setDraft({ ...draft, name: e.target.value }),
            }),
          ),
          h(
            Field,
            { label: t('preset.engine', '所属引擎') },
            h(
              'select',
              {
                className: 'vl-input',
                value: draft.engine,
                onChange: (e) => setDraft({ ...draft, engine: e.target.value }),
              },
              ['moss', 'voxcpm', 'openai', 'httpjson', 'command'].map((id) =>
                h('option', { key: id, value: id }, engineLabel(ctx, id)),
              ),
            ),
          ),
          draft.engine === 'openai' || draft.engine === 'httpjson'
            ? h(
                Field,
                { label: t('preset.remoteVoice', '远程音色 id（HTTP 引擎使用）') },
                h(TextInput, {
                  value: draft.remoteVoice,
                  placeholder: 'alloy / zh_female / …',
                  onChange: (e) => setDraft({ ...draft, remoteVoice: e.target.value }),
                }),
              )
            : null,
          h(
            Field,
            { label: t('preset.note', '备注（可选）') },
            h(TextInput, {
              value: draft.note,
              maxLength: 200,
              onChange: (e) => setDraft({ ...draft, note: e.target.value }),
            }),
          ),
          h('p', { className: 'vl-help' }, t('training.note', '')),
          h(
            'div',
            { className: 'vl-modal-actions' },
            h(Btn, { onClick: onClose }, t('cancel', '取消')),
            h(Btn, { kind: 'primary', icon: 'plus', onClick: onCreate, disabled: !!busy || !draft.name.trim() }, t('create', '创建')),
          ),
        ),
      )
    }

    // ── 引擎设置 ────────────────────────────────────────────────────────────
    function EnginePanel({ ctx, data, busy, run, toast, setToast, startEngine, t }) {
      const [form, setForm] = useState(() => JSON.parse(JSON.stringify(data.settings || {})))
      const [probe, setProbe] = useState(null)
      const [dirty, setDirty] = useState(false)
      const formRef = useRef(form)
      const dirtyRef = useRef(dirty)
      formRef.current = form
      dirtyRef.current = dirty
      useEffect(
        () => () => {
          if (!dirtyRef.current) return
          const f = formRef.current || {}
          const payload = {
            engine: f.engine,
            moss: f.moss,
            openai: f.openai,
            httpjson: f.httpjson,
            command: f.command,
            voxcpm: f.voxcpm,
            residentModel: f.residentModel,
            autoSpeakDouyin: f.autoSpeakDouyin,
            autoSpeakAssistant: f.autoSpeakAssistant,
            douyinPresetId: f.douyinPresetId,
            maxSpeakChars: f.maxSpeakChars,
          }
          fetch(`${API}/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'settings.update', settings: payload }),
            keepalive: true,
          }).catch(() => {})
        },
        [],
      )
      const engine = data.engine || {}
      const voxcpm = data.voxcpm || {}
      const voxState = voxcpm.state || 'stopped'
      const update = (section, key, value) => {
        setDirty(true)
        setForm((cur) => {
          const next = JSON.parse(JSON.stringify(cur))
          if (!next[section]) next[section] = {}
          next[section][key] = value
          return next
        })
      }
      const updateTop = (key, value) => {
        setDirty(true)
        setForm((cur) => ({ ...cur, [key]: value }))
      }
      const save = () =>
        run(
          '保存设置',
          async () => {
            const payload = {
              engine: form.engine,
              moss: form.moss,
              openai: form.openai,
              httpjson: form.httpjson,
              command: form.command,
              voxcpm: form.voxcpm,
              residentModel: form.residentModel,
              autoSpeakDouyin: form.autoSpeakDouyin,
              autoSpeakAssistant: form.autoSpeakAssistant,
              douyinPresetId: form.douyinPresetId,
              maxSpeakChars: form.maxSpeakChars,
            }
            const r = await fetch(`${API}/action`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'settings.update', settings: payload }),
            })
            const json = await r.json().catch(() => ({ ok: false, error: '接口返回非 JSON' }))
            if (!r.ok || json.ok === false) throw new Error(json.error || `HTTP ${r.status}`)
            setDirty(false)
            setForm((cur) => ({ ...cur, openai: { ...cur.openai, apiKey: '' } }))
            return json
          },
          t('engine.saved', '引擎设置已保存'),
        )
      const doProbe = () =>
        run('检测环境', async () => {
          const r = await fetch(`${API}/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'engine.probe' }),
          })
          const json = await r.json().catch(() => ({ ok: false, error: '接口返回非 JSON' }))
          if (!r.ok || json.ok === false) throw new Error(json.error || `HTTP ${r.status}`)
          setProbe(json)
          if (!form.moss.pythonPath && json.detectedPython) {
            setForm((cur) => ({ ...cur, moss: { ...cur.moss, pythonPath: json.detectedPython } }))
          }
          setToast(t('toast.probe', '环境检测完成'))
          return json
        })
      const stopEngine = () => run('停止引擎', () => post('engine.stop'), t('engine.stop', '停止引擎'))
      const restartEngine = () => run('重启引擎', () => post('engine.restart'), t('engine.ready', '已就绪'))
      const startVox = () => run('启动 VoxCPM', () => post('voxcpm.start'), t('engine.voxcpm.starting', '正在启动 VoxCPM，首次加载约 60 秒…'))
      const stopVox = () => run('停止 VoxCPM', () => post('voxcpm.stop'), t('engine.voxcpm.stopped', 'VoxCPM 已停止'))
      const restartVox = () => run('重启 VoxCPM', () => post('voxcpm.restart'), t('engine.voxcpm.starting', '正在启动 VoxCPM，首次加载约 60 秒…'))
      const voices = data.builtinVoices || []
      const engineState = engine.state || 'stopped'
      return h(
        'div',
        { className: 'vl-engine-page' },
        h(
          'section',
          { className: 'vl-card' },
          h(
            'div',
            { className: 'vl-card-head' },
            h('span', { className: 'vl-card-title' }, t('engine.config', '引擎配置')),
            h(
              'div',
              { className: 'vl-actions' },
              h(Btn, { icon: 'refresh', onClick: doProbe, disabled: !!busy }, t('engine.probe', '检测环境')),
              h(Btn, { icon: 'play', onClick: startEngine, disabled: !!busy || engineState === 'ready' || engineState === 'busy' }, t('engine.start', '启动引擎')),
              h(Btn, { onClick: restartEngine, disabled: !!busy }, t('engine.restart', '重启引擎')),
              h(Btn, { kind: 'ghost', onClick: stopEngine, disabled: !!busy || engineState === 'stopped' }, t('engine.stop', '停止引擎')),
            ),
          ),
          h(
            'div',
            { className: 'vl-status-row' },
            h('span', { className: 'vl-engine', 'data-state': engineState }, h('i', null), `${engineLabel(ctx, engine.mode || form.engine)} · ${stateLabel(ctx, engineState)}`),
            engine.detail ? h('span', { className: 'vl-muted vl-ellipsis', title: engine.detail }, engine.detail) : null,
          ),
          probe
            ? h(
                'div',
                { className: 'vl-probe', 'data-ok': probe.ok ? '1' : '0' },
                h('div', { className: 'vl-probe-title' }, probe.ok ? t('engine.probeOk', '环境正常') : t('engine.probeBad', '环境有问题')),
                ...(probe.checks || []).map((c) =>
                  h(
                    'div',
                    { key: c.name, className: 'vl-probe-row' },
                    h(Icon, { name: c.ok ? 'check' : 'close', size: 12 }),
                    h('span', { className: 'vl-probe-name' }, c.name),
                    h('span', { className: 'vl-muted vl-ellipsis', title: c.detail }, c.detail),
                  ),
                ),
                probe.hint ? h('div', { className: 'vl-help' }, probe.hint) : null,
                probe.detectedPython && !form.moss.pythonPath
                  ? h(Btn, { size: 'sm', onClick: () => update('moss', 'pythonPath', probe.detectedPython) }, `使用 ${probe.detectedPython}`)
                  : null,
              )
            : null,
          h(
            'div',
            { className: 'vl-form-grid' },
            h(
              Field,
              { label: '默认引擎' },
              h(
                'select',
                { className: 'vl-input', value: form.engine, onChange: (e) => updateTop('engine', e.target.value) },
                ['moss', 'voxcpm', 'openai', 'httpjson', 'command'].map((id) => h('option', { key: id, value: id }, engineLabel(ctx, id))),
              ),
            ),
            h(
              Field,
              { label: t('engine.resident', '常驻语音模型'), hint: '只常驻一个；切换会停掉另一个，避免显存/内存占用' },
              h(
                'select',
                { className: 'vl-input', value: form.residentModel || 'moss', onChange: (e) => updateTop('residentModel', e.target.value) },
                h('option', { value: 'moss' }, 'MOSS-TTS-Nano（CPU，快）'),
                h('option', { value: 'voxcpm' }, 'VoxCPM（GPU，高质量，首次约 60 秒）'),
                h('option', { value: 'none' }, '不常驻（按需启动）'),
              ),
            ),
            h(Field, { label: t('engine.moss.voice', '默认内置音色') }, h(
              'select',
              { className: 'vl-input', value: form.moss?.builtinVoice || 'Junhao', onChange: (e) => update('moss', 'builtinVoice', e.target.value) },
              voices.map((v) => h('option', { key: v.voice, value: v.voice }, `${v.voice} · ${v.group}`)),
            )),
            h(Field, { label: t('engine.moss.python', 'Python 路径') }, h(TextInput, { value: form.moss?.pythonPath || '', onChange: (e) => update('moss', 'pythonPath', e.target.value), placeholder: 'C:\\...\\envs\\moss-tts-nano\\python.exe' })),
            h(Field, { label: t('engine.moss.repo', 'MOSS 仓库目录') }, h(TextInput, { value: form.moss?.repoDir || '', onChange: (e) => update('moss', 'repoDir', e.target.value), placeholder: '%USERPROFILE%\\moss\\MOSS-TTS-Nano' })),
            h(Field, { label: t('engine.moss.model', 'ONNX 模型目录') }, h(TextInput, { value: form.moss?.modelDir || '', onChange: (e) => update('moss', 'modelDir', e.target.value), placeholder: '%USERPROFILE%\\moss\\models\\MOSS-TTS-Nano-100M-ONNX' })),
            h(Field, { label: t('engine.moss.threads', 'CPU 线程') }, h(TextInput, { type: 'number', min: 1, max: 64, value: form.moss?.cpuThreads ?? 4, onChange: (e) => update('moss', 'cpuThreads', Number(e.target.value)) })),
            h(Field, { label: t('engine.moss.frames', '最大音频帧') }, h(TextInput, { type: 'number', min: 64, max: 3000, value: form.moss?.maxNewFrames ?? 375, onChange: (e) => update('moss', 'maxNewFrames', Number(e.target.value)) })),
            h(Field, { label: t('engine.moss.refMax', '参考音上限（秒）'), hint: '6–30；MOSS 建议 8–20 秒' }, h(TextInput, { type: 'number', min: 6, max: 30, value: form.moss?.referenceMaxSeconds ?? 20, onChange: (e) => update('moss', 'referenceMaxSeconds', Number(e.target.value)) })),
            h(Field, { label: '采样模式' }, h(
              'select',
              { className: 'vl-input', value: form.moss?.sampleMode || 'fixed', onChange: (e) => update('moss', 'sampleMode', e.target.value) },
              h('option', { value: 'fixed' }, 'fixed（稳定，推荐）'),
              h('option', { value: 'greedy' }, 'greedy（更快）'),
              h('option', { value: 'full' }, 'full（更多变化）'),
            )),
          ),
          h(
            'div',
            { className: 'vl-switch-grid' },
            h(Switch, { on: form.moss?.normalizeText !== false, onChange: (v) => update('moss', 'normalizeText', v), label: t('engine.moss.normalize', '中文文本规范化'), desc: '把数字、日期、英文读法转成中文，再交给模型' }),
            h(Switch, { on: form.moss?.prewarm !== false, onChange: (v) => update('moss', 'prewarm', v), label: t('engine.moss.prewarm', '加载 DSH 时预加载模型'), desc: '首次合成会更快，但会常驻内存' }),
          ),
        ),
        h(
          'section',
          { className: 'vl-card' },
          h(
            'div',
            { className: 'vl-card-head' },
            h('span', { className: 'vl-card-title' }, t('engine.voxcpm.section', 'VoxCPM 常驻（本地）')),
            h(
              'div',
              { className: 'vl-actions' },
              h(Btn, { size: 'sm', icon: 'play', onClick: startVox, disabled: !!busy || voxState === 'ready' || voxState === 'busy' || voxState === 'loading' }, t('engine.voxcpm.start', '启动')),
              h(Btn, { size: 'sm', icon: 'refresh', onClick: restartVox, disabled: !!busy }, t('engine.voxcpm.restart', '重启')),
              h(Btn, { size: 'sm', kind: 'ghost', onClick: stopVox, disabled: !!busy || voxState === 'stopped' }, t('engine.voxcpm.stop', '停止')),
            ),
          ),
          h(
            'div',
            { className: 'vl-status-row' },
            h('span', { className: 'vl-engine', 'data-state': voxState }, h('i', null), `${engineLabel(ctx, 'voxcpm')} · ${stateLabel(ctx, voxState)}`),
            voxcpm.detail ? h('span', { className: 'vl-muted vl-ellipsis', title: voxcpm.detail }, voxcpm.detail) : null,
          ),
          h(
            'p',
            { className: 'vl-help' },
            t(
              'engine.voxcpm.note',
              '使用引擎设置里配置的 VoxCPM 底座、LoRA 权重和参考音，参数保持设置里的值；常驻后不再每次重新加载（首次约 35–70 秒）。',
            ),
          ),
          h(
            'div',
            { className: 'vl-form-grid' },
            h(Field, { label: t('engine.voxcpm.python', 'VoxCPM Python') }, h(TextInput, { value: form.voxcpm?.pythonPath || '', onChange: (e) => update('voxcpm', 'pythonPath', e.target.value), placeholder: '%USERPROFILE%\\miniconda3\\envs\\voxcpm\\python.exe' })),
            h(Field, { label: t('engine.voxcpm.base', '底座目录') }, h(TextInput, { value: form.voxcpm?.baseModel || '', onChange: (e) => update('voxcpm', 'baseModel', e.target.value), placeholder: '%USERPROFILE%\\moss\\models\\VoxCPM2' })),
            h(Field, { label: t('engine.voxcpm.weights', '权重目录') }, h(TextInput, { value: form.voxcpm?.weightsDir || '', onChange: (e) => update('voxcpm', 'weightsDir', e.target.value), placeholder: '%USERPROFILE%\\voice-lab-main\\weights' })),
            h(Field, { label: t('engine.voxcpm.cfg', 'cfg_value') }, h(TextInput, { type: 'number', min: 0.1, max: 10, step: 0.1, value: form.voxcpm?.cfgValue ?? 2, onChange: (e) => update('voxcpm', 'cfgValue', Number(e.target.value)) })),
            h(Field, { label: t('engine.voxcpm.steps', 'inference_timesteps') }, h(TextInput, { type: 'number', min: 4, max: 100, value: form.voxcpm?.steps ?? 20, onChange: (e) => update('voxcpm', 'steps', Number(e.target.value)) })),
            h(Field, { label: t('engine.voxcpm.seed', 'seed') }, h(TextInput, { type: 'number', value: form.voxcpm?.seed ?? 1234, onChange: (e) => update('voxcpm', 'seed', Number(e.target.value)) })),
          ),
          h(
            'p',
            { className: 'vl-help' },
            t('engine.voxcpm.quality', '改 cfg / timesteps / seed 会改变音色或稳定性；要“质量不变”，保持 2.0 / 20 / 1234。'),
          ),
        ),
        h(
          'section',
          { className: 'vl-card' },
          h('div', { className: 'vl-card-head' }, h('span', { className: 'vl-card-title' }, 'OpenAI 兼容 / HTTP JSON / 自定义命令')),
          h(
            'div',
            { className: 'vl-form-grid' },
            h(Field, { label: t('engine.openai.baseUrl', '接口地址（/v1）') }, h(TextInput, { value: form.openai?.baseUrl || '', onChange: (e) => update('openai', 'baseUrl', e.target.value), placeholder: 'http://127.0.0.1:9880/v1' })),
            h(Field, { label: t('engine.openai.model', '模型名') }, h(TextInput, { value: form.openai?.model || '', onChange: (e) => update('openai', 'model', e.target.value) })),
            h(Field, { label: t('engine.openai.voice', '默认音色') }, h(TextInput, { value: form.openai?.voice || '', onChange: (e) => update('openai', 'voice', e.target.value) })),
            h(Field, { label: t('engine.openai.key', 'API Key（留空不修改）'), hint: data.settings?.openai?.hasApiKey ? '已保存一个 Key；留空表示不修改' : '' }, h(TextInput, { type: 'password', value: form.openai?.apiKey || '', onChange: (e) => update('openai', 'apiKey', e.target.value) })),
            h(Field, { label: t('engine.openai.format', '响应格式') }, h(
              'select',
              { className: 'vl-input', value: form.openai?.responseFormat || 'wav', onChange: (e) => update('openai', 'responseFormat', e.target.value) },
              ['wav', 'mp3', 'opus', 'flac', 'pcm'].map((v) => h('option', { key: v, value: v }, v)),
            )),
            h(Field, { label: t('engine.httpjson.endpoint', 'HTTP JSON 接口地址') }, h(TextInput, { value: form.httpjson?.endpoint || '', onChange: (e) => update('httpjson', 'endpoint', e.target.value), placeholder: 'http://127.0.0.1:8000/tts' })),
            h(Field, { label: t('engine.httpjson.headers', '请求头（JSON）') }, h(TextInput, { value: form.httpjson?.headers || '{}', onChange: (e) => update('httpjson', 'headers', e.target.value) })),
            h(Field, { label: t('engine.httpjson.body', '请求体模板'), hint: '占位符：{text} {textJson} {voice} {ref} {refJson}' }, h(TextInput, { value: form.httpjson?.bodyTemplate || '', onChange: (e) => update('httpjson', 'bodyTemplate', e.target.value) })),
            h(Field, { label: t('engine.command.template', '命令模板'), hint: '占位符：{textFile} {out} {ref} {voice} {preset} {presetDir}' }, h(TextInput, { value: form.command?.template || '', onChange: (e) => update('command', 'template', e.target.value), placeholder: 'python infer.py --text-file {textFile} --out {out} --ref {ref}' })),
            h(Field, { label: t('engine.command.cwd', '工作目录') }, h(TextInput, { value: form.command?.cwd || '', onChange: (e) => update('command', 'cwd', e.target.value) })),
            h(Field, { label: t('engine.command.train', '训练命令（可选）'), hint: '占位符：{presetDir} {clipsDir} {ref} {out}；点「完成训练」时执行' }, h(TextInput, { value: form.command?.trainCommand || '', onChange: (e) => update('command', 'trainCommand', e.target.value) })),
          ),
          h(
            'div',
            { className: 'vl-save-row' },
            h(Btn, { kind: 'primary', icon: 'check', onClick: save, disabled: !!busy }, t('engine.form.save', '保存设置')),
            dirty ? h('span', { className: 'vl-muted' }, '有未保存的修改') : h('span', { className: 'vl-muted' }, t('engine.autosave', '设置会记住；离开本页时自动保存')),
          ),
        ),
        h(
          'section',
          { className: 'vl-card' },
          h('div', { className: 'vl-card-head' }, h('span', { className: 'vl-card-title' }, t('engine.compat', '兼容与接口'))),
          h('p', { className: 'vl-help' }, t('engine.compat.body', '')),
          h(
            'div',
            { className: 'vl-kv' },
            h('span', null, t('engine.dataDir', '数据目录')),
            h('code', null, data.dataDir),
          ),
          h(
            'div',
            { className: 'vl-kv' },
            h('span', null, 'HTTP TTS'),
            h('code', null, `POST ${data.origin}/voice-lab-main/api/tts`),
          ),
          h(
            'div',
            { className: 'vl-kv' },
            h('span', null, 'Health'),
            h('code', null, `GET ${data.origin}/voice-lab-main/api/health`),
          ),
          h('p', { className: 'vl-help' }, '支持把任意本地语音模型接进来：OpenAI 兼容接口、返回 base64/url/path 的 HTTP JSON、或者命令行（GPT-SoVITS / IndexTTS / CosyVoice / FishSpeech …）。声线库里的每条预设可以单独指定引擎。'),
        ),
        toast ? null : null,
      )
    }

    // ── 多音频训练 ──────────────────────────────────────────────────────────
    function TrainPanel({ ctx, data, busy, run, refresh, playUrl, setToast, onOpenPreset, t }) {
      const train = data?.train || {}
      const models = train.models || []
      const defaults = train.defaults || {}
      const [modelId, setModelId] = useState(defaults.model || 'voxcpm')
      const model = models.find((m) => m.id === modelId) || models[0] || { id: 'voxcpm', name: 'VoxCPM2 + LoRA', sampleRate: 16000, lora: true, available: false }
      const [draftId, setDraftId] = useState('')
      const [items, setItems] = useState([])
      const [selectedIds, setSelectedIds] = useState([])
      const [steps, setSteps] = useState(defaults.steps || 1000)
      const [loraR, setLoraR] = useState(defaults.loraR || 32)
      const [checkpointSteps, setCheckpointSteps] = useState(defaults.checkpointSteps || 100)
      const [checkpointSec, setCheckpointSec] = useState(defaults.checkpointSec || 300)
      const [pathMode, setPathMode] = useState(defaults.pathMode || 'original')
      const [exportDir, setExportDir] = useState(defaults.exportDir || '')
      const [exportResult, setExportResult] = useState(null)
      const [exporting, setExporting] = useState(false)
      const [busyLocal, setBusyLocal] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [jsonlLines, setJsonlLines] = useState(null)
      const [previewText, setPreviewText] = useState('你好，我是训练后的声线。')
      const [previewUrl, setPreviewUrl] = useState('')
      const [playingId, setPlayingId] = useState('')
      const fileRef = useRef(null)
      const txtFileRef = useRef(null)
      const audioRef = useRef(null)
      const logRef = useRef(null)
      const saveTimerRef = useRef(null)
      const itemsRef = useRef([])
      const draftIdRef = useRef('')
      const draftRef = useRef({ id: '', items: [] })

      const session = train.session || null
      const sessions = train.sessions || []
      const targetPreset = train.targetPreset || null
      const activeStatus = session?.status || ''
      const isRunning = ['starting', 'training', 'pausing', 'stopping'].includes(activeStatus)
      const canResume = ['paused', 'interrupted', 'failed'].includes(activeStatus)
      const allSelected = items.length > 0 && selectedIds.length === items.length

      useEffect(() => {
        setSelectedIds((cur) => cur.filter((id) => items.some((item) => item.id === id)))
      }, [items])

      useEffect(() => {
        const d = train.draft
        if (!d) return
        if (d.id !== draftRef.current.id || itemsRef.current.length === 0) {
          draftRef.current = d
          draftIdRef.current = d.id
          itemsRef.current = d.items || []
          setDraftId(d.id)
          setItems(d.items || [])
        }
      }, [train.draft])

      useEffect(
        () => () => {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          if (audioRef.current) {
            try {
              audioRef.current.pause()
            } catch {
              /* ignore */
            }
          }
        },
        [],
      )

      useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      }, [session?.id, session?.logs?.length])

      const scheduleTextSave = (next) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
          saveTimerRef.current = null
          post('train.draft.update', {
            draftId: draftIdRef.current,
            items: next.map((item) => ({ id: item.id, text: item.text || '' })),
          }).catch(() => {})
        }, 600)
      }
      const changeText = (id, text) => {
        setItems((cur) => {
          const next = cur.map((item) => (item.id === id ? { ...item, text } : item))
          itemsRef.current = next
          scheduleTextSave(next)
          return next
        })
      }
      const playItem = (item) => {
        const audio = audioRef.current
        if (!audio || !item?.url) return
        if (playingId === item.id) {
          audio.pause()
          setPlayingId('')
          return
        }
        try {
          audio.pause()
          audio.currentTime = 0
        } catch {
          /* ignore */
        }
        audio.src = item.url
        audio.onended = () => setPlayingId('')
        audio.play().then(() => setPlayingId(item.id)).catch(() => setPlayingId(''))
      }
      const uploadFiles = async (files) => {
        const list = Array.from(files || []).filter((f) => /\.(wav|mp3|m4a|aac|ogg|opus|flac|webm)$/i.test(f.name || ''))
        if (!list.length) {
          setError('请选择 wav / mp3 / m4a / flac 等音频文件')
          return
        }
        const id = draftIdRef.current || draftId
        if (!id) {
          setError('写入端口还没准备好，请刷新后重试')
          return
        }
        setError('')
        setBusyLocal('上传中…')
        let count = itemsRef.current.length
        try {
          for (const file of list) {
            if (count >= 100) {
              setError('最多 100 个音频文件')
              break
            }
            const query = `draftId=${encodeURIComponent(id)}&sampleRate=${encodeURIComponent(model.sampleRate || 16000)}&name=${encodeURIComponent(file.name)}`
            const r = await fetch(`${API}/train/audio?${query}`, {
              method: 'POST',
              headers: { 'content-type': 'application/octet-stream', 'x-file-name': file.name },
              body: file,
            })
            const json = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
            if (!r.ok || json.ok === false) throw new Error(json.error || `HTTP ${r.status}`)
            const next = [...itemsRef.current, json.item]
            itemsRef.current = next
            count = next.length
            setItems(next)
          }
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const importTextFile = async (file) => {
        if (!file) return
        if (!itemsRef.current.length) {
          setError('先上传音频，再一键导入台词')
          return
        }
        setError('')
        setNotice('')
        setBusyLocal('读取台词文件…')
        try {
          const buffer = await file.arrayBuffer()
          let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
          if (text.includes('\uFFFD')) {
            try {
              text = new TextDecoder('gbk').decode(buffer)
            } catch {
              /* keep utf-8 */
            }
          }
          const map = new Map()
          const warnings = []
          let invalid = 0
          const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
          lines.forEach((line, li) => {
            const trimmed = line.trim()
            if (!trimmed) return
            const m = trimmed.match(/^(?:[（(]\s*(\d+)\s*[)）]|(\d+))\s*[.，,。．]\s*(.*)$/)
            if (!m) {
              invalid += 1
              if (warnings.length < 12) warnings.push(`第 ${li + 1} 行格式不匹配`)
              return
            }
            const number = Number(m[1] || m[2])
            const content = String(m[3] || '').trim()
            if (!number || !content) {
              invalid += 1
              if (warnings.length < 12) warnings.push(`第 ${li + 1} 行缺少编号或台词`)
              return
            }
            if (map.has(number)) warnings.push(`编号 ${number} 重复，后一条覆盖前一条`)
            map.set(number, content.slice(0, 2000))
          })
          if (!map.size) throw new Error(warnings.length ? `没有可用的台词行：${warnings.slice(0, 4).join('；')}` : '台词文件是空的')
          const indices = new Set(itemsRef.current.map((item) => Number(item.index)))
          const missing = [...indices].filter((n) => !map.has(n)).sort((a, b) => a - b)
          const extra = [...map.keys()].filter((n) => !indices.has(n)).sort((a, b) => a - b)
          const next = itemsRef.current.map((item) => ({
            ...item,
            text: map.has(Number(item.index)) ? map.get(Number(item.index)) : item.text || '',
          }))
          const res = await post('train.draft.update', {
            draftId: draftIdRef.current,
            items: next.map((item) => ({ id: item.id, text: item.text || '' })),
          })
          const saved = res.draft?.items || next
          itemsRef.current = saved
          setItems(saved)
          const parts = [`已按编号导入 ${map.size} 条台词`]
          if (missing.length) parts.push(`缺少编号：${missing.slice(0, 12).join(',')}${missing.length > 12 ? '…' : ''}`)
          if (extra.length) parts.push(`文件里多出编号：${extra.slice(0, 12).join(',')}${extra.length > 12 ? '…' : ''}`)
          if (invalid) parts.push(`格式不匹配 ${invalid} 行`)
          if (warnings.length) parts.push(warnings.slice(0, 6).join('；'))
          setNotice(parts.join('；'))
          setToast?.(`台词已导入：${map.size} 条`)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const removeItem = async (item) => {
        if (!window.confirm(`移除 [${item.index}] ${item.name}？`)) return
        setBusyLocal('移除中…')
        try {
          const res = await post('train.draft.remove', { draftId: draftIdRef.current, itemId: item.id })
          const next = res.draft?.items || []
          itemsRef.current = next
          setItems(next)
          if (playingId === item.id) {
            try {
              audioRef.current?.pause()
            } catch {
              /* ignore */
            }
            setPlayingId('')
          }
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const stopPreview = () => {
        try {
          audioRef.current?.pause()
          if (audioRef.current) audioRef.current.currentTime = 0
        } catch {
          /* ignore */
        }
        setPlayingId('')
      }
      const toggleSelect = (id, checked) => {
        setSelectedIds((cur) => (checked ? [...new Set([...cur, id])] : cur.filter((value) => value !== id)))
      }
      const toggleAll = () => {
        setSelectedIds(allSelected ? [] : items.map((item) => item.id))
      }
      const removeIds = async (ids) => {
        if (!ids.length) return
        setBusyLocal('批量删除…')
        setError('')
        try {
          const res = await post('train.draft.removeMany', { draftId: draftIdRef.current, itemIds: ids })
          const next = res.draft?.items || []
          itemsRef.current = next
          setItems(next)
          setSelectedIds((cur) => cur.filter((id) => !ids.includes(id)))
          if (ids.includes(playingId)) stopPreview()
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const removeSelected = async () => {
        if (!selectedIds.length) return
        if (!window.confirm(`删除选中的 ${selectedIds.length} 个音频？`)) return
        await removeIds(selectedIds)
      }
      const removeAllItems = async () => {
        const ids = itemsRef.current.map((item) => item.id)
        if (!ids.length) return
        if (!window.confirm(`删除全部 ${ids.length} 个音频？`)) return
        await removeIds(ids)
      }
      const moveItem = async (index, direction) => {
        const cur = itemsRef.current
        const target = index + direction
        if (target < 0 || target >= cur.length) return
        const next = [...cur]
        const [moved] = next.splice(index, 1)
        next.splice(target, 0, moved)
        setBusyLocal('调整顺序…')
        setError('')
        try {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
          }
          await post('train.draft.update', {
            draftId: draftIdRef.current,
            items: next.map((item) => ({ id: item.id, text: item.text || '' })),
          })
          const res = await post('train.draft.reorder', {
            draftId: draftIdRef.current,
            itemIds: next.map((item) => item.id),
          })
          const ordered = res.draft?.items || next
          itemsRef.current = ordered
          setItems(ordered)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const previewJsonl = async () => {
        setBusyLocal('生成 JSONL…')
        try {
          const res = await post('train.draft.jsonl', { draftId: draftIdRef.current, pathMode })
          setJsonlLines(res.lines || [])
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const exportTraining = async () => {
        setError('')
        setExportResult(null)
        setExporting(true)
        try {
          const res = await post('train.export', {
            draftId: draftIdRef.current,
            sessionId: session?.id,
            dir: exportDir,
            pathMode,
            steps,
            loraR,
          })
          setExportResult(res)
          setToast?.(`训练包已导出：${res.count} 条样本`)
          post('settings.update', { settings: { train: { exportDir: exportDir || '', pathMode } } }).catch(() => {})
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setExporting(false)
        }
      }
      const startTraining = async () => {
        if (!itemsRef.current.length) {
          setError('先上传至少一个音频')
          return
        }
        if (!model.available) {
          setError(model.reason || '训练后端不可用')
          return
        }
        if (itemsRef.current.some((item) => !String(item.text || '').trim())) {
          setError('还有音频没有填写角色台词')
          return
        }
        setError('')
        setNotice('')
        setBusyLocal('启动训练…')
        try {
          await post('train.draft.update', {
            draftId: draftIdRef.current,
            items: itemsRef.current.map((item) => ({ id: item.id, text: item.text || '' })),
          })
          const res = await post('train.start', {
            draftId: draftIdRef.current,
            model: model.id,
            steps,
            loraR,
            checkpointSteps,
            checkpointSec,
            pathMode,
          })
          if (res.warning) setNotice(res.warning)
          setToast?.(res.warning || '训练已启动')
          post('settings.update', { settings: { train: { pathMode } } }).catch(() => {})
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const pauseTraining = async () => {
        setBusyLocal('暂停中…')
        try {
          await post('train.pause')
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const resumeTraining = async () => {
        setBusyLocal('继续训练…')
        try {
          await post('train.resume', { sessionId: session?.id })
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const stopTraining = async () => {
        if (!window.confirm('停止当前训练？已保存的检查点会保留。')) return
        setBusyLocal('停止中…')
        try {
          await post('train.stop')
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const selectSession = async (id) => {
        try {
          await post('train.session.select', { sessionId: id })
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        }
      }
      const deleteCheckpoint = async (checkpoint) => {
        if (!window.confirm(`删除训练版本「${checkpoint.kind === 'step' ? `第 ${checkpoint.step} 步` : checkpoint.id}」？`)) return
        setBusyLocal('删除版本…')
        try {
          await post('train.checkpoint.delete', { sessionId: session?.id, checkpointId: checkpoint.id })
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const previewCheckpoint = async (checkpoint) => {
        setBusyLocal('加载权重试听（首次约 35–70 秒）…')
        setPreviewUrl('')
        try {
          const res = await post('train.preview', {
            sessionId: session?.id,
            checkpointId: checkpoint.id,
            text: previewText,
          })
          setPreviewUrl(res.url || '')
          if (res.url) playUrl?.(res.url)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const createVoiceFromCheckpoint = async (checkpoint) => {
        const fallbackName = `${session?.name || '训练声线'} step ${checkpoint.step || 0}`
        const name = window.prompt('加入声线库的名称', fallbackName)
        if (!name) return
        setBusyLocal('创建声线…')
        setError('')
        try {
          const res = await post('train.createPreset', {
            sessionId: session?.id,
            checkpointId: checkpoint.id,
            name,
          })
          setToast?.(`已加入声线库：${res.preset?.name || name}`)
          onOpenPreset?.(res.preset?.id)
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const downloadLog = () => {
        if (!session?.id) return
        window.open(`${API}/train/log?sessionId=${encodeURIComponent(session.id)}&download=1`, '_blank')
      }
      const unbindTarget = async () => {
        if (!window.confirm('解除训练目标锁定？解除后该声线恢复可编辑/删除，后续检查点不再自动导入。')) return
        setBusyLocal('解除锁定…')
        try {
          await post('train.unbindPreset')
          await refresh(true)
        } catch (e) {
          setError(String(e?.message || e))
        } finally {
          setBusyLocal('')
        }
      }
      const statusText = {
        starting: t('train.status.starting', '启动中'),
        training: t('train.status.training', '训练中'),
        pausing: t('train.status.pausing', '正在暂停'),
        paused: t('train.status.paused', '已暂停'),
        stopping: t('train.status.stopping', '正在停止'),
        interrupted: t('train.status.interrupted', '已中断'),
        completed: t('train.status.completed', '已完成'),
        failed: t('train.status.failed', '失败'),
      }[activeStatus] || activeStatus || t('train.status.idle', '未开始')
      const statusTone =
        activeStatus === 'completed' ? 'ok' : activeStatus === 'failed' ? 'error' : activeStatus === 'paused' || activeStatus === 'interrupted' ? 'warn' : 'brand'

      return h(
        'div',
        { className: 'vl-train-page' },
        targetPreset
          ? h(
              'section',
              { className: 'vl-card vl-train-target' },
              h(Icon, { name: 'lock', size: 16 }),
              h(
                'div',
                { className: 'vl-train-target-body' },
                h('div', { className: 'vl-label' }, t('train.target', '训练目标已锁定：{name}', { name: targetPreset.name })),
                h(
                  'div',
                  { className: 'vl-muted' },
                  t(
                    'train.target.hint',
                    '后续训练检查点会自动导入这条声线，并切换为 VoxCPM 命令引擎；训练期间不能修改/删除该声线。',
                  ),
                ),
              ),
              h(Btn, { size: 'sm', icon: 'lock', onClick: unbindTarget, disabled: !!busyLocal || isRunning }, t('train.target.unbind', '解除锁定')),
            )
          : null,
        h(
          'section',
          { className: 'vl-card' },
          h(
            'div',
            { className: 'vl-card-head' },
            h('span', { className: 'vl-card-title' }, t('train.title', '多音频训练')),
            h('span', { className: 'vl-chip', 'data-tone': model.available ? 'ok' : 'warn' }, model.available ? t('train.backendOk', '后端可用') : t('train.backendBad', '后端不可用')),
          ),
          h(
            'div',
            { className: 'vl-form-grid' },
            h(
              Field,
              { label: t('train.model', '语音模型'), hint: t('train.model.hint', '选择训练模型；采样率自动识别') },
              h(
                'select',
                { className: 'vl-input', value: model.id, onChange: (e) => setModelId(e.target.value) },
                models.map((m) => h('option', { key: m.id, value: m.id }, `${m.name}${m.available ? '' : '（不可用）'}`)),
              ),
            ),
            h(
              Field,
              { label: t('train.sampleRate', '模型要求采样率') },
              h(
                'div',
                { className: 'vl-train-rate-chip' },
                h('strong', null, `${model.sampleRate || 16000} Hz`),
                h('span', { className: 'vl-muted' }, t('train.sampleRate.hint', '上传后会自动转成这个采样率')),
              ),
            ),
            h(
              Field,
              { label: t('train.steps', '训练步数') },
              h(TextInput, { type: 'number', min: 10, max: 100000, value: steps, onChange: (e) => setSteps(Number(e.target.value)) }),
            ),
            model.lora
              ? h(
                  Field,
                  { label: t('train.loraR', 'lora.r：') },
                  h(TextInput, { type: 'number', min: 4, max: 128, value: loraR, onChange: (e) => setLoraR(Number(e.target.value)) }),
                )
              : null,
            h(
              Field,
              { label: t('train.checkpointSteps', '每 N 步保存') },
              h(TextInput, { type: 'number', min: 10, max: 100000, value: checkpointSteps, onChange: (e) => setCheckpointSteps(Number(e.target.value)) }),
            ),
            h(
              Field,
              { label: t('train.checkpointSec', '每 N 秒提取') },
              h(TextInput, { type: 'number', min: 30, max: 3600, value: checkpointSec, onChange: (e) => setCheckpointSec(Number(e.target.value)) }),
            ),
            h(
              Field,
              {
                label: t('train.pathMode', 'JSONL 音频路径'),
                hint: t('train.pathMode.hint', '仅影响本地训练/预览；导出包固定为 16 kHz WAV + 相对路径 train.jsonl'),
              },
              h(
                'select',
                { className: 'vl-input', value: pathMode, onChange: (e) => setPathMode(e.target.value) },
                h('option', { value: 'original' }, t('train.pathMode.original', '原始上传文件（按上传地址）')),
                h('option', { value: 'normalized' }, t('train.pathMode.normalized', '规范化 16k WAV（最稳）')),
              ),
            ),
          ),
          !model.available ? h('p', { className: 'vl-help vl-train-warn' }, model.reason || t('train.unavailable', '训练后端不可用')) : null,
          sessions.length
            ? h(
                Field,
                { label: t('train.session', '训练会话') },
                h(
                  'select',
                  { className: 'vl-input', value: session?.id || '', onChange: (e) => selectSession(e.target.value) },
                  sessions.map((s) => h('option', { key: s.id, value: s.id }, `${s.name} · ${s.status} · ${s.lastStep || 0}/${s.steps} 步`)),
                ),
              )
            : null,
        ),
        h(
          'section',
          { className: 'vl-card vl-write-card' },
          h(
            'div',
            { className: 'vl-card-head' },
            h('span', { className: 'vl-card-title' }, t('train.write', '写入端口')),
            h(
              'div',
              { className: 'vl-actions' },
              h('input', {
                ref: fileRef,
                type: 'file',
                multiple: true,
                accept: '.wav,.mp3,.m4a,.aac,.ogg,.opus,.flac,.webm,audio/*',
                style: { display: 'none' },
                onChange: (e) => {
                  uploadFiles(e.target.files)
                  e.target.value = ''
                },
              }),
              h(Btn, { size: 'sm', icon: 'plus', onClick: () => fileRef.current?.click(), disabled: !!busyLocal || isRunning }, t('train.upload', '批量上传音频')),
              h('input', {
                ref: txtFileRef,
                type: 'file',
                accept: '.txt,text/plain',
                style: { display: 'none' },
                onChange: (e) => {
                  importTextFile(e.target.files?.[0])
                  e.target.value = ''
                },
              }),
              h(
                Btn,
                { size: 'sm', icon: 'upload', onClick: () => txtFileRef.current?.click(), disabled: !!busyLocal || isRunning || !items.length },
                t('train.uploadText', '一键上传台词'),
              ),
              h('span', { className: 'vl-muted' }, `${items.length}/100`),
            ),
          ),
          h(
            'div',
            { className: 'vl-write-table' },
            h(
              'div',
              { className: 'vl-write-head' },
              h(
                'div',
                { className: 'vl-write-head-left' },
                h(
                  'label',
                  { className: 'vl-write-selectall' },
                  h('input', { type: 'checkbox', checked: allSelected, onChange: toggleAll, disabled: isRunning }),
                  h('span', null, t('train.selectAll', '全选')),
                ),
                selectedIds.length ? h('span', { className: 'vl-muted' }, t('train.selectedCount', '已选 {n}', { n: selectedIds.length })) : null,
                h('span', { className: 'vl-muted' }, t('train.audio', '音频文件')),
              ),
              h('div', null, t('train.text', '角色台词')),
            ),
            items.length
              ? items.map((item, index) =>
                  h(
                    'div',
                    { key: item.id, className: 'vl-write-row' },
                    h(
                      'div',
                      { className: 'vl-write-left' },
                      h('input', {
                        type: 'checkbox',
                        className: 'vl-write-check',
                        checked: selectedIds.includes(item.id),
                        onChange: (e) => toggleSelect(item.id, e.target.checked),
                        disabled: isRunning,
                        title: t('train.select', '选择'),
                      }),
                      h('span', { className: 'vl-write-index' }, `[${item.index}]`),
                      h('span', { className: 'vl-write-name', title: item.name }, item.name),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'vl-play-dot',
                          title: playingId === item.id ? t('train.stopPreview', '停止试听') : t('train.playPreview', '试听'),
                          onClick: () => playItem(item),
                          disabled: !item.url,
                        },
                        h(Icon, { name: playingId === item.id ? 'wave' : 'play', size: 11 }),
                      ),
                      h('span', { className: 'vl-write-rate', title: t('train.rate.hint', '源采样率 → 训练采样率') }, `${item.sourceSampleRate || '?'} → ${item.sampleRate} Hz`),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'vl-icon-btn vl-order-btn',
                          title: t('train.moveUp', '上移'),
                          onClick: () => moveItem(index, -1),
                          disabled: !!busyLocal || isRunning || index === 0,
                        },
                        h('span', null, '↑'),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'vl-icon-btn vl-order-btn',
                          title: t('train.moveDown', '下移'),
                          onClick: () => moveItem(index, 1),
                          disabled: !!busyLocal || isRunning || index === items.length - 1,
                        },
                        h('span', null, '↓'),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'vl-icon-btn',
                          title: t('train.remove', '移除'),
                          onClick: () => removeItem(item),
                          disabled: !!busyLocal || isRunning,
                        },
                        h(Icon, { name: 'close', size: 12 }),
                      ),
                    ),
                    h(
                      'div',
                      { className: 'vl-write-right' },
                      h('textarea', {
                        className: 'vl-textarea',
                        rows: 2,
                        maxLength: 2000,
                        value: item.text || '',
                        placeholder: t('train.text.placeholder', `第 ${item.index} 段音频对应的角色台词…`),
                        onChange: (e) => changeText(item.id, e.target.value),
                        disabled: isRunning,
                      }),
                    ),
                  ),
                )
              : h('div', { className: 'vl-write-empty' }, t('train.empty', '还没有音频。点右上角「批量上传音频」按顺序上传。')),
          ),
          h(
            'div',
            { className: 'vl-toolbar vl-train-select-actions' },
            h(Btn, { icon: 'check', onClick: toggleAll, disabled: !!busyLocal || isRunning || !items.length }, allSelected ? t('train.unselectAll', '取消全选') : t('train.selectAll', '全选')),
            h(
              Btn,
              { icon: 'trash', onClick: removeSelected, disabled: !!busyLocal || isRunning || !selectedIds.length },
              t('train.removeSelected', '删除选中（{n}）', { n: selectedIds.length }),
            ),
            h(
              Btn,
              { kind: 'ghost', icon: 'trash', onClick: removeAllItems, disabled: !!busyLocal || isRunning || !items.length },
              t('train.removeAll', '全选删除'),
            ),
            h('span', { className: 'vl-muted vl-train-order-hint' }, t('train.orderHint', '↑/↓ 调整顺序')),
          ),
          h(
            'p',
            { className: 'vl-train-hint' },
            t('train.hint', '样本量推荐5~50个为好；注意角色台词需一一对应；注意音频文件采样率需与你选择的模型适配'),
          ),
          h(
            'p',
            { className: 'vl-help' },
            t('train.hint2', '单段建议 3–15 秒；VoxCPM2 2B 在 8GB 显存上可能不足，建议 16GB+ 显存或云端训练。'),
          ),
          h(
            'div',
            { className: 'vl-toolbar vl-train-actions' },
            h(Btn, { kind: 'primary', icon: 'play', onClick: startTraining, disabled: !!busyLocal || isRunning || !items.length || !model.available }, busyLocal === '启动训练…' ? t('train.starting', '启动中…') : t('train.start', '开始训练')),
            h(Btn, { icon: 'refresh', onClick: previewJsonl, disabled: !!busyLocal || !items.length }, t('train.jsonl', '预览 JSONL')),
            h(Btn, { kind: 'ghost', icon: 'trash', onClick: () => { setJsonlLines(null); setError('') }, disabled: !!busyLocal }, t('train.clearPreview', '清空预览')),
            h('audio', { ref: audioRef, preload: 'none', style: { display: 'none' } }),
          ),
          jsonlLines
            ? h(
                'div',
                { className: 'vl-train-jsonl' },
                h('div', { className: 'vl-help' }, t('train.jsonl.hint', '训练开始时会把绝对音频路径与台词写入 dataset.jsonl（每条一行）')),
                h('pre', null, jsonlLines.join('\n')),
              )
            : null,
          h(
            'div',
            { className: 'vl-train-export' },
            h('div', { className: 'vl-card-title' }, t('train.export', '导出训练包')),
            h(
              'div',
              { className: 'vl-form-grid' },
              h(
                Field,
                { label: t('train.exportDir', '导出到（父目录）'), hint: t('train.exportDir.hint', '留空使用 train/exports；会在其中创建带时间戳的包') },
                h(TextInput, {
                  value: exportDir,
                  onChange: (e) => setExportDir(e.target.value),
                  placeholder: 'D:\\voice-data\\export',
                }),
              ),
            ),
            h(
              'div',
              { className: 'vl-toolbar' },
              h(
                Btn,
                { icon: 'download', onClick: exportTraining, disabled: exporting || !items.length },
                exporting ? t('train.exporting', '导出中…') : t('train.exportNow', '导出训练包'),
              ),
              h('span', { className: 'vl-muted' }, t('train.exportHint', '与实测可用包同结构：audio/N.wav + train.jsonl + README_AutoDL.txt')),
            ),
            exportResult
              ? h(
                  'div',
                  { className: 'vl-train-export-result' },
                  h('div', null, `已导出 ${exportResult.count} 条 · 16 kHz WAV + 相对路径 train.jsonl`),
                  h('div', { className: 'vl-muted' }, '目录：'),
                  h('code', null, exportResult.dir),
                  exportResult.zipPath ? h('div', { className: 'vl-muted' }, `ZIP：${exportResult.zipPath}`) : null,
                  h(
                    'div',
                    { className: 'vl-muted' },
                    '标准 AutoDL 结构；train.jsonl 使用相对 audio/N.wav，不需要改写路径。',
                  ),
                )
              : null,
          ),
          error ? h('div', { className: 'vl-error-inline' }, error) : null,
          notice ? h('div', { className: 'vl-help' }, notice) : null,
        ),
        session
          ? h(
              'section',
              { className: 'vl-card' },
              h(
                'div',
                { className: 'vl-card-head' },
                h('span', { className: 'vl-card-title' }, t('train.log', '训练日志')),
                h('span', { className: 'vl-chip', 'data-tone': statusTone }, statusText),
                h('span', { className: 'vl-muted' }, `step ${session.lastStep || 0}/${session.steps || 0}`),
              ),
              h(
                'div',
                { className: 'vl-train-metrics' },
                ['loss/diff', 'loss/stop', 'lr', 'epoch', 'grad_norm'].map((key) =>
                  h('span', { key, className: 'vl-train-metric' }, h('span', { className: 'vl-muted' }, key), h('strong', null, Number(session.metrics?.[key] || 0).toFixed(6))),
                ),
              ),
              h(
                'div',
                { className: 'vl-toolbar' },
                isRunning && activeStatus !== 'pausing' && activeStatus !== 'stopping'
                  ? h(Btn, { icon: 'pause', onClick: pauseTraining, disabled: !!busyLocal }, t('train.pause', '暂停'))
                  : null,
                canResume ? h(Btn, { kind: 'primary', icon: 'play', onClick: resumeTraining, disabled: !!busyLocal }, t('train.resume', '继续训练')) : null,
                isRunning ? h(Btn, { kind: 'ghost', icon: 'close', onClick: stopTraining, disabled: !!busyLocal }, t('train.stop', '停止')) : null,
                h(Btn, { icon: 'refresh', onClick: () => refresh(true), disabled: !!busyLocal }, t('refresh', '刷新')),
                h(Btn, { icon: 'download', onClick: downloadLog, disabled: !session.logAvailable }, t('train.downloadLog', '下载日志')),
              ),
              h('pre', { ref: logRef, className: 'vl-train-log' }, (session.logs || []).join('\n') || t('train.noLog', '还没有日志…')),
              h('p', { className: 'vl-help' }, t('train.log.hint', '训练日志默认保存 7 天，之后自动清理；需要长期保留请先下载。')),
            )
          : null,
        session
          ? h(
              'section',
              { className: 'vl-card' },
              h(
                'div',
                { className: 'vl-card-head' },
                h('span', { className: 'vl-card-title' }, t('train.versions', '训练版本')),
                h('span', { className: 'vl-muted' }, `${(session.checkpoints || []).length}`),
              ),
              h(
                'div',
                { className: 'vl-train-preview-row' },
                h(TextInput, { value: previewText, maxLength: 2000, onChange: (e) => setPreviewText(e.target.value), placeholder: t('train.previewText', '试听台词') }),
                h(Btn, { icon: 'play', onClick: () => session.checkpoints?.[0] && previewCheckpoint(session.checkpoints[0]), disabled: !!busyLocal || !(session.checkpoints || []).length }, t('train.previewLatest', '试听最新版本')),
              ),
              session.checkpoints?.length
                ? h(
                    'div',
                    { className: 'vl-train-version-list' },
                    session.checkpoints.map((checkpoint) =>
                      h(
                        'div',
                        { key: checkpoint.id, className: 'vl-train-version' },
                        h('span', { className: 'vl-chip', 'data-tone': checkpoint.kind === 'step' ? 'brand' : 'ok' }, checkpoint.kind === 'step' ? `step ${checkpoint.step}` : `提取 ${checkpoint.step}`),
                        h('span', { className: 'vl-train-version-meta' }, `${new Date(checkpoint.createdAt).toLocaleString()} · ${(Number(checkpoint.size || 0) / 1048576).toFixed(1)} MB`),
                        h(Btn, { size: 'sm', icon: 'plus', onClick: () => createVoiceFromCheckpoint(checkpoint), disabled: !!busyLocal }, t('train.addToLibrary', '加入声线库')),
                        h(Btn, { size: 'sm', icon: 'play', onClick: () => previewCheckpoint(checkpoint), disabled: !!busyLocal }, t('train.preview', '试听')),
                        h(Btn, { size: 'sm', kind: 'ghost', icon: 'trash', onClick: () => deleteCheckpoint(checkpoint), disabled: !!busyLocal }, t('delete', '删除')),
                      ),
                    ),
                  )
                : h('p', { className: 'vl-help' }, t('train.noVersions', '训练开始后，检查点和定时提取的权重会出现在这里。')),
              previewUrl ? h('audio', { controls: true, src: previewUrl, className: 'vl-inline-audio' }) : null,
              busyLocal ? h('div', { className: 'vl-help' }, busyLocal) : null,
            )
          : null,
      )
    }

    // ── 配音历史 ────────────────────────────────────────────────────────────
    function HistoryPanel({ ctx, data, busy, run, refresh, localAutoRead, toggleAutoRead, localAutoPlay, toggleAutoPlay, saveSetting, playUrl, t }) {
      const items = data.outbox || []
      const douyinPresets = (data.presets || []).filter((p) => p.status === 'ready')
      const takeOverFromFairy = () => {
        if (!window.confirm(t('conflict.takeoverConfirm', '关闭 Fairy 的「自动朗读回复」，改由声线工坊朗读？页面会刷新一次。'))) return
        try {
          localStorage.setItem('fairy.zzz.voice', JSON.stringify(false))
        } catch {
          /* ignore */
        }
        try {
          window.location.reload()
        } catch {
          /* ignore */
        }
      }
      return h(
        'div',
        { className: 'vl-engine-page' },
        h(
          'section',
          { className: 'vl-card' },
          h('div', { className: 'vl-card-head' }, h('span', { className: 'vl-card-title' }, '实时配音')),
          h(Switch, {
            on: data.settings?.autoSpeakDouyin !== false,
            onChange: (v) => saveSetting({ autoSpeakDouyin: v }, t('toast.saved', '已保存')),
            label: t('history.autoDouyin', '自动为抖音回复配音'),
            desc: '同一 Host 内 dye_reply / dye_comment / dye_chat_send 成功后自动合成（每条回复一次）',
          }),
          h(
            Field,
            { label: t('history.douyinPreset', '抖音回复使用声线') },
            h(
              'select',
              {
                className: 'vl-input',
                value: data.settings?.douyinPresetId || '',
                onChange: (e) => saveSetting({ douyinPresetId: e.target.value }, t('toast.saved', '已保存')),
              },
              h('option', { value: '' }, '跟随当前声线'),
              douyinPresets.map((p) => h('option', { key: p.id, value: p.id }, p.name)),
            ),
          ),
          h(Switch, { on: localAutoRead, onChange: toggleAutoRead, label: t('history.autoRead', '自动朗读助手回复'), desc: '助手消息完成后自动点击“朗读”（浏览器需要一次用户交互才能发声）' }),
          fairyAutoVoiceOn() && localAutoRead
            ? h(
                'div',
                { className: 'vl-conflict' },
                h(Icon, { name: 'speaker', size: 15 }),
                h(
                  'div',
                  { className: 'vl-conflict-body' },
                  h('div', { className: 'vl-label' }, t('conflict.title', '检测到两个朗读插件同时开启')),
                  h(
                    'div',
                    { className: 'vl-muted' },
                    t(
                      'conflict.body',
                      'Fairy（dsh-fairy-zzz）的「自动朗读回复」也开着，所以同一条回复会被两套声线各念一遍。本插件已经让出自动朗读，避免双声；想让本插件接管，请到 Fairy 设置里关闭「自动朗读回复」。',
                    ),
                  ),
                ),
                h(
                  'div',
                  { className: 'vl-conflict-actions' },
                  h(Btn, { size: 'sm', kind: 'primary', onClick: takeOverFromFairy }, t('conflict.takeover', '让声线工坊接管')),
                  h(Btn, { size: 'sm', onClick: () => toggleAutoRead(false) }, t('conflict.turnOff', '关闭本插件自动朗读')),
                ),
              )
            : null,
          h(Switch, { on: localAutoPlay, onChange: toggleAutoPlay, label: t('history.autoPlay', '自动播放新配音'), desc: '训练台/抖音产生新音频时自动播放' }),
          h(
            Field,
            { label: t('history.maxChars', '自动朗读最大字数') },
            h(TextInput, {
              type: 'number',
              min: 20,
              max: 2000,
              defaultValue: data.settings?.maxSpeakChars ?? 160,
              onBlur: (e) => saveSetting({ maxSpeakChars: Number(e.target.value) }, t('toast.saved', '已保存')),
            }),
          ),
          data.douyin?.pending ? h('div', { className: 'vl-help' }, t('history.pending', '正在合成 {n} 条…', { n: data.douyin.pending })) : null,
          data.douyin?.lastError ? h('div', { className: 'vl-error-inline' }, t('history.error', '最近一次自动配音失败：{msg}', { msg: data.douyin.lastError })) : null,
        ),
        h(
          'section',
          { className: 'vl-card' },
          h(
            'div',
            { className: 'vl-card-head' },
            h('span', { className: 'vl-card-title' }, t('tab.history', '配音历史')),
            h('span', { className: 'vl-muted' }, `${items.length}`),
            h(
              'div',
              { className: 'vl-actions' },
              h(Btn, { icon: 'refresh', onClick: () => refresh(), disabled: !!busy }, t('refresh', '刷新')),
              h(Btn, { kind: 'danger', icon: 'trash', onClick: () => run('清空历史', () => post('outbox.clear'), t('toast.cleared', '配音历史已清空')), disabled: !!busy || !items.length }, t('history.clear', '清空历史')),
            ),
          ),
          items.length
            ? h(
                'div',
                { className: 'vl-outbox' },
                items.map((item) =>
                  h(
                    'div',
                    { key: item.id, className: 'vl-outbox-item' },
                    h(
                      'button',
                      { type: 'button', className: 'vl-play-dot', onClick: () => playUrl(item.url), title: t('play', '播放音频') },
                      h(Icon, { name: 'play', size: 11 }),
                    ),
                    h(
                      'div',
                      { className: 'vl-outbox-body' },
                      h('div', { className: 'vl-outbox-text' }, item.text),
                      h(
                        'div',
                        { className: 'vl-outbox-meta' },
                        [
                          item.source === 'douyin' ? `${item.tool || '抖音'}${item.target ? ` · ${item.target}` : ''}` : item.source === 'agent' ? 'Agent 工具' : item.source === 'studio' ? '训练台' : '接口',
                          item.presetName,
                          item.durationSec != null ? formatSeconds(item.durationSec) : null,
                          formatTime(item.at),
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      ),
                    ),
                    h(
                      'a',
                      { className: 'vl-link-btn', href: item.url, download: `${item.id}.wav`, title: t('history.download', '下载') },
                      h(Icon, { name: 'down', size: 13 }),
                    ),
                  ),
                ),
              )
            : h('div', { className: 'vl-muted' }, t('history.empty', '还没有配音记录。')),
        ),
      )
    }

    // ── 助手消息“朗读”按钮 ──────────────────────────────────────────────────
    const seenIds = (() => {
      try {
        const raw = localStorage.getItem(LS_SEEN)
        const arr = raw ? JSON.parse(raw) : []
        return new Set(Array.isArray(arr) ? arr.slice(-400) : [])
      } catch {
        return new Set()
      }
    })()

    function rememberSeen(id) {
      if (!id || seenIds.has(id)) return
      seenIds.add(id)
      try {
        localStorage.setItem(LS_SEEN, JSON.stringify(Array.from(seenIds).slice(-400)))
      } catch {
        /* ignore */
      }
    }

    function extractTurnText(el) {
      if (!el || typeof el.closest !== 'function') return ''
      try {
        const turn = el.closest('[data-chat-turn]')
        if (!turn) return ''
        const turnId = turn.getAttribute('data-chat-turn')
        const scope =
          el.closest('[data-slot="conversation.chat.flow"]') ||
          el.closest('[data-conversation-scroll]') ||
          document.body
        const matches = Array.from(scope.querySelectorAll('[data-chat-turn]'))
        let answer = null
        let step = null
        for (const item of matches) {
          if (turnId !== null && item.getAttribute('data-chat-turn') !== turnId) continue
          if (item.hasAttribute('data-turn-process-answer')) answer = item
          const kind = item.getAttribute('data-chat-flow-kind')
          if (kind === 'assistant-step') step = item
        }
        const target = answer || step
        if (!target) return ''
        const clone = target.cloneNode(true)
        clone
          .querySelectorAll('button, svg, script, style, [data-chat-flow-kind="tool-call"], [data-chat-flow-kind="turn-process"], [data-slot="conversation.chat.assistant-actions"]')
          .forEach((node) => node.remove())
        const text = String(clone.innerText || clone.textContent || '')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        return text.slice(0, 1200)
      } catch {
        return ''
      }
    }

    async function speakText(text) {
      const res = await post('tts', { text })
      if (!res?.url) throw new Error(res?.error || '没有返回音频')
      return res
    }

    /**
     * 检测 dsh-fairy-zzz 的“自动朗读回复”是否开着。
     * 两个插件都注册在 conversation.chat.assistant-actions 上，如果都自动朗读，
     * 同一条回复会被两套声线各念一遍。这里让声线工坊主动让出，避免双声。
     */
    function fairyAutoVoiceOn() {
      try {
        let present = false
        try {
          if (typeof document !== 'undefined' && document.querySelector('button.fz3-voice')) present = true
        } catch {
          present = false
        }
        if (!present) {
          try {
            for (let i = 0; i < localStorage.length; i += 1) {
              const key = localStorage.key(i)
              if (key && key.indexOf('fairy.zzz.') === 0) {
                present = true
                break
              }
            }
          } catch {
            present = false
          }
        }
        if (!present) return false
        const raw = localStorage.getItem('fairy.zzz.voice')
        if (raw === null) return true
        try {
          return JSON.parse(raw) !== false
        } catch {
          return raw !== 'false' && raw !== '0'
        }
      } catch {
        return false
      }
    }

    function ReadAloudAction(props) {
      const messageId = props?.messageId
      const [state, setState] = useState('idle')
      const [err, setErr] = useState('')
      const ref = useRef(null)
      const audioRef = useRef(null)
      const busyRef = useRef(false)

      const runRead = useCallback(
        async (auto) => {
          if (busyRef.current) return
          if (auto && autoReadBusy) return
          const raw = extractTurnText(ref.current)
          if (!raw) {
            setErr('没有读到这一轮的回复文本')
            return
          }
          const text = raw.slice(0, auto ? SPEAK_LIMIT : 800)
          busyRef.current = true
          if (auto) autoReadBusy = true
          setState('busy')
          setErr('')
          try {
            const res = await speakText(text)
            if (!audioRef.current) audioRef.current = new Audio()
            const audio = audioRef.current
            audio.pause()
            audio.src = res.url
            audio.onended = () => setState('idle')
            audio.onerror = () => setState('idle')
            try {
              await audio.play()
            } catch {
              /* 浏览器拦截自动播放时保留按钮态，用户可再点 */
            }
            setState('play')
            if (auto) rememberSeen(messageId)
          } catch (e) {
            setState('error')
            setErr(String(e?.message || e))
          } finally {
            busyRef.current = false
            if (auto) autoReadBusy = false
          }
        },
        [messageId],
      )

      useEffect(() => {
        let auto = false
        try {
          auto = localStorage.getItem(LS_AUTO_READ) !== '0'
        } catch {
          auto = true
        }
        if (!auto) return
        if (Date.now() < AUTO_ARM_AT) return
        if (!messageId || seenIds.has(messageId)) return
        rememberSeen(messageId)
        if (fairyAutoVoiceOn()) {
          setState('yielded')
          return
        }
        void runRead(true)
        return () => {
          try {
            audioRef.current?.pause()
          } catch {
            /* ignore */
          }
        }
      }, [messageId, runRead])

      const onClick = () => {
        if (state === 'busy') return
        if (state === 'play') {
          try {
            audioRef.current?.pause()
          } catch {
            /* ignore */
          }
          setState('idle')
          return
        }
        void runRead(false)
      }

      const title =
        state === 'busy'
          ? '声线工坊正在合成…'
          : state === 'play'
            ? '停止朗读'
            : state === 'yielded'
              ? 'Fairy 正在自动朗读；点这里用声线工坊再念一遍'
              : err || '用声线工坊朗读这条回复'
      return h(
        'button',
        {
          ref,
          type: 'button',
          className: 'vl-read-btn',
          'data-state': state,
          title,
          'aria-label': '朗读',
          onClick,
        },
        h(
          'svg',
          {
            width: 14,
            height: 14,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.9,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
          },
          h('path', { d: 'M4 9.5v5a1 1 0 0 0 1 1h2.6l3.6 3.1a1 1 0 0 0 1.7-.8V6.2a1 1 0 0 0-1.7-.8L7.6 8.5H5a1 1 0 0 0-1 1Z' }),
          h('path', { d: 'M16 8.6a4.6 4.6 0 0 1 0 6.8' }),
          h('path', { d: 'M18.8 6a8 8 0 0 1 0 12' }),
        ),
        h('span', null, state === 'busy' ? '合成中' : state === 'play' ? '停止' : '朗读'),
      )
    }

    // ── 侧栏图标 ────────────────────────────────────────────────────────────
    function SidebarIcon({ size = 16, active }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: active ? 2.2 : 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z' }),
        h('path', { d: 'M5.5 11a6.5 6.5 0 0 0 13 0' }),
        h('path', { d: 'M12 18v3' }),
        h('path', { d: 'M8.5 21h7' }),
      )
    }

    // ── 样式 ────────────────────────────────────────────────────────────────
    const CSS = `
      .vl-root{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;overflow:hidden;position:relative}
      .vl-root *{box-sizing:border-box}
      .vl-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px 24px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
      .vl-ident{display:flex;align-items:center;gap:12px;min-width:0}
      .vl-logo{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,var(--dsw-alias-brand-primary),color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--dsw-alias-bg-layer-2)));color:#fff;flex:none;box-shadow:0 4px 14px color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}
      .vl-title{font-size:18px;font-weight:650;letter-spacing:-.01em;line-height:1.25}
      .vl-sub{margin-top:2px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .vl-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .vl-engine{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
      .vl-engine i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);flex:none}
      .vl-engine[data-state="ready"] i{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 18%,transparent)}
      .vl-engine[data-state="busy"] i,.vl-engine[data-state="loading"] i,.vl-engine[data-state="starting"] i{background:var(--dsw-alias-state-warn-primary);animation:vl-pulse 1.1s ease-in-out infinite}
      .vl-engine[data-state="error"] i{background:var(--dsw-alias-state-error-primary)}
      .vl-tabs{display:flex;align-items:center;gap:4px;padding:9px 20px 0;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
      .vl-tab{position:relative;border:0;background:transparent;color:var(--dsw-alias-label-secondary);height:32px;padding:0 12px;border-radius:8px 8px 0 0;font-size:12.5px;cursor:pointer}
      .vl-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
      .vl-tab[data-on="1"]{color:var(--dsw-alias-label-primary);font-weight:600}
      .vl-tab[data-on="1"]::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;background:var(--dsw-alias-brand-primary)}
      .vl-tab-badge{margin-left:6px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--dsw-alias-brand-primary);color:#fff;font-size:10px;display:inline-flex;align-items:center;justify-content:center;vertical-align:1px}
      .vl-tab-spacer{flex:1}
      .vl-busy{display:inline-flex;align-items:center;gap:7px;color:var(--dsw-alias-label-secondary);font-size:11.5px;padding-right:4px}
      .vl-scroll{flex:1;min-height:0;overflow:auto;padding:16px 24px 30px;scrollbar-gutter:stable}
      .vl-grid{display:grid;grid-template-columns:248px minmax(0,1fr);gap:16px;align-items:start;max-width:1180px;margin:0 auto}
      .vl-main{display:flex;flex-direction:column;gap:14px;min-width:0}
      .vl-card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:13px;padding:15px 16px;min-width:0}
      .vl-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px;flex-wrap:wrap}
      .vl-card-title{font-size:13px;font-weight:650;letter-spacing:-.005em}
      .vl-aside{position:sticky;top:0;padding:13px;max-height:calc(100vh - 180px);overflow:auto}
      .vl-aside .vl-card-head{margin-bottom:8px}
      .vl-group-title{margin:12px 2px 6px;font-size:10.5px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
      .vl-aside-empty{padding:4px 6px 10px}
      .vl-preset{display:flex;align-items:center;gap:2px;width:100%;border:1px solid transparent;background:transparent;border-radius:9px;padding:0;color:inherit}
      .vl-preset:hover{background:var(--dsw-alias-bg-layer-2)}
      .vl-preset[data-selected="1"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent)}
      .vl-preset-main{display:flex;align-items:center;gap:9px;flex:1;min-width:0;text-align:left;border:0;background:transparent;border-radius:8px;padding:7px 2px 7px 8px;cursor:pointer;color:inherit;font:inherit}
      .vl-preset-del{width:24px;height:24px;flex:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.32;padding:0;margin-right:3px}
      .vl-preset:hover .vl-preset-del,.vl-preset[data-selected="1"] .vl-preset-del{opacity:.9}
      .vl-preset-del:hover:not(:disabled){color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
      .vl-preset-del:disabled{opacity:.15;cursor:not-allowed}
      .vl-preset-lock{width:24px;height:24px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);opacity:.75;margin-right:3px}
      .vl-restore{display:flex;align-items:center;gap:5px;width:100%;margin:6px 0 2px;padding:6px 8px;border:1px dashed var(--dsw-alias-border-l1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
      .vl-restore:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
      .vl-restore:disabled{opacity:.4;cursor:not-allowed}
      .vl-preset-avatar{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
      .vl-preset-avatar[data-kind="builtin"]{color:var(--dsw-alias-state-warn-primary)}
      .vl-preset-body{min-width:0;flex:1;display:flex;flex-direction:column}
      .vl-preset-name-row{display:flex;align-items:center;gap:6px;min-width:0}
      .vl-preset-name{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vl-preset-meta{font-size:10.5px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
      .vl-active-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);flex:none}
      .vl-row-between{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .vl-wrap{flex-wrap:wrap}
      .vl-title-block{min-width:0}
      .vl-h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:650;letter-spacing:-.01em;flex-wrap:wrap}
      .vl-chip{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font-size:10.5px;font-weight:600;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);white-space:nowrap}
      .vl-chip[data-tone="ok"]{color:var(--dsw-alias-state-success-primary)}
      .vl-chip[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary)}
      .vl-chip[data-tone="brand"]{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent)}
      .vl-chip-btn{cursor:pointer;font-family:inherit}
      .vl-conflict{display:flex;align-items:flex-start;gap:10px;margin:10px 0 2px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 35%,var(--dsw-alias-border-l1));border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent)}
      .vl-conflict>svg{flex:none;color:var(--dsw-alias-state-warn-primary);margin-top:1px}
      .vl-conflict-body{flex:1;min-width:0}
      .vl-conflict .vl-label{margin-bottom:2px}
      .vl-conflict-actions{display:flex;flex-direction:column;gap:6px;flex:none}
      .vl-muted{color:var(--dsw-alias-label-secondary);font-size:11.5px}
      .vl-note{margin-top:6px;font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap}
      .vl-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .vl-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px}
      .vl-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;transition:background .12s,border-color .12s,opacity .12s}
      .vl-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
      .vl-btn:disabled{opacity:.42;cursor:not-allowed}
      .vl-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff;font-weight:600}
      .vl-btn-primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);filter:brightness(1.08)}
      .vl-btn-ghost{background:transparent}
      .vl-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,var(--dsw-alias-border-l1))}
      .vl-btn-danger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}
      .vl-btn-sm{height:25px;padding:0 9px;font-size:11px;border-radius:7px}
      .vl-audio-strip{display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:11px;border-top:1px solid var(--dsw-alias-border-l1)}
      .vl-audio-label{font-size:11px;color:var(--dsw-alias-label-secondary);flex:none}
      .vl-audio-strip audio{flex:1;min-width:0;height:32px}
      .vl-help{margin:2px 0 10px;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
      .vl-check{display:flex;align-items:flex-start;gap:8px;margin:8px 0 0;cursor:pointer}
      .vl-check input{accent-color:var(--dsw-alias-brand-primary);margin:2px 0 0;flex:none}
      .vl-check-text{display:flex;flex-direction:column;gap:1px;min-width:0}
      .vl-reader-model{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 2px}
      .vl-reader-model .vl-label{white-space:nowrap}
      .vl-input-sm{width:auto;min-width:170px;max-width:100%;padding:5px 8px;font-size:12px}
      .vl-reader-hint{font-size:11px;line-height:1.5;flex:1;min-width:180px}
      .vl-train-page{display:flex;flex-direction:column;gap:14px;padding:16px 20px 48px}
      .vl-train-target{display:flex;align-items:flex-start;gap:10px;border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,var(--dsw-alias-bg-layer-1))}
      .vl-train-target-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
      .vl-train-warn{color:var(--dsw-alias-state-error-primary)}
      .vl-train-rate-chip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:32px}
      .vl-train-rate-chip strong{font-size:15px;color:var(--dsw-alias-brand-primary)}
      .vl-write-table{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;margin-top:8px;background:var(--dsw-alias-bg-base)}
      .vl-write-head,.vl-write-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
      .vl-write-head{background:var(--dsw-alias-bg-layer-2);font-size:11px;font-weight:650;color:var(--dsw-alias-label-secondary)}
      .vl-write-head>div,.vl-write-row>div{padding:8px 10px;min-width:0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .vl-write-head>div:first-child{border-right:1px solid var(--dsw-alias-border-l1)}
      .vl-write-head-left{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .vl-write-selectall{display:inline-flex;align-items:center;gap:5px;cursor:pointer}
      .vl-write-check{width:13px;height:13px;flex:none;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
      .vl-order-btn{width:20px;height:20px;padding:0;font-size:12px;line-height:1;flex:none}
      .vl-write-row:last-child>div{border-bottom:0}
      .vl-write-row>div:first-child{border-right:1px solid var(--dsw-alias-border-l1)}
      .vl-write-left{display:flex;align-items:center;gap:7px;min-width:0}
      .vl-write-index{flex:none;font:600 10.5px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent);border-radius:5px;padding:0 5px}
      .vl-write-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
      .vl-write-rate{flex:none;font-size:10.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
      .vl-write-right textarea{min-height:40px;resize:vertical}
      .vl-write-empty{padding:18px 12px;text-align:center;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .vl-train-hint{margin:10px 0 0;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
      .vl-train-actions{margin-top:10px}
      .vl-train-select-actions{margin-top:10px}
      .vl-train-order-hint{font-size:11px}
      .vl-train-jsonl{margin-top:10px}
      .vl-train-jsonl pre{margin:6px 0 0;max-height:220px;overflow:auto;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-all}
      .vl-train-export{margin-top:14px;padding-top:12px;border-top:1px dashed var(--dsw-alias-border-l1)}
      .vl-train-export-result{margin-top:10px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:11px;line-height:1.6;word-break:break-all}
      .vl-train-metrics{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 2px}
      .vl-train-metric{display:flex;align-items:baseline;gap:5px;font-size:11px}
      .vl-train-metric strong{font:600 11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-brand-primary)}
      .vl-train-log{margin:8px 0 0;max-height:300px;overflow:auto;padding:10px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-all}
      .vl-train-version-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
      .vl-train-version{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
      .vl-train-version-meta{flex:1;min-width:160px;font-size:11px;color:var(--dsw-alias-label-secondary)}
      .vl-train-preview-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
      .vl-train-preview-row .vl-input{flex:1;min-width:200px}
      @media (max-width:820px){
        .vl-write-head,.vl-write-row{grid-template-columns:minmax(0,1fr)}
        .vl-write-row>div:first-child{border-right:0}
        .vl-write-head>div:first-child{border-right:0}
        .vl-write-head>div:last-child{display:none}
      }
      .vl-steps{margin:10px 0 2px;font-size:11.5px;color:var(--dsw-alias-label-secondary);padding:8px 11px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:1px dashed var(--dsw-alias-border-l1)}
      .vl-drop{margin-top:10px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:12px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 40%,transparent)}
      .vl-drop-text{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
      .vl-queue{margin-top:9px;display:flex;flex-direction:column;gap:6px}
      .vl-chips{display:flex;flex-wrap:wrap;gap:6px}
      .vl-file-chip{display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:3px 5px 3px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);font-size:10.5px}
      .vl-file-chip>button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:13px;line-height:1;padding:0 2px}
      .vl-textarea{width:100%;min-height:76px;resize:vertical;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:9px;padding:9px 10px;font:inherit;font-size:12.5px;outline:none}
      .vl-textarea:focus,.vl-input:focus{border-color:var(--dsw-alias-brand-primary)}
      .vl-input{width:100%;height:31px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 9px;font:inherit;font-size:12.5px;outline:none}
      select.vl-input{appearance:auto;padding-right:6px}
      .vl-kbd{margin-left:auto}
      .vl-inline-audio{height:32px;max-width:340px;flex:1;min-width:180px}
      .vl-clip-list{display:flex;flex-direction:column;gap:2px;margin-top:4px}
      .vl-clip{display:flex;align-items:center;gap:9px;padding:7px 6px;border-radius:8px}
      .vl-clip:hover{background:var(--dsw-alias-bg-layer-2)}
      .vl-clip[data-dim="1"]{opacity:.45}
      .vl-play-dot{width:24px;height:24px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0}
      .vl-play-dot:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
      .vl-play-dot:disabled{opacity:.35;cursor:not-allowed}
      .vl-clip-body{min-width:0;flex:1}
      .vl-clip-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vl-clip-meta{font-size:10.5px;color:var(--dsw-alias-label-secondary);margin-top:1px}
      .vl-icon-btn{width:26px;height:26px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:7px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
      .vl-icon-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
      .vl-icon-btn:disabled{opacity:.3;cursor:not-allowed}
      .vl-versions{display:flex;flex-direction:column;gap:2px}
      .vl-version{display:flex;align-items:center;gap:10px;padding:7px 7px;border-radius:8px;font-size:11.5px}
      .vl-version[data-current="1"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent)}
      .vl-version-index{width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);font-size:10.5px;font-weight:650;flex:none}
      .vl-version-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vl-danger-card{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 22%,var(--dsw-alias-border-l1))}
      .vl-note-card{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--dsw-alias-label-secondary);padding:12px 15px}
      .vl-empty{margin:60px auto;max-width:440px;text-align:center;padding:30px;border:1px dashed var(--dsw-alias-border-l1);border-radius:16px}
      .vl-empty-icon{width:54px;height:54px;margin:0 auto 12px;border-radius:15px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
      .vl-empty-title{font-size:16px;font-weight:650}
      .vl-empty-body{margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.65}
      .vl-loading{flex:1;display:flex;align-items:center;justify-content:center;gap:9px;color:var(--dsw-alias-label-secondary);font-size:12.5px}
      .vl-spinner{width:12px;height:12px;border-radius:50%;border:2px solid color-mix(in srgb,var(--dsw-alias-label-secondary) 30%,transparent);border-top-color:var(--dsw-alias-brand-primary);animation:vl-spin .8s linear infinite;display:inline-block;flex:none}
      .vl-error-bar{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:0 auto 12px;max-width:1180px;padding:9px 12px;border-radius:9px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,transparent);color:var(--dsw-alias-state-error-primary);font-size:12px;white-space:pre-wrap}
      .vl-error-bar>button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:15px;line-height:1}
      .vl-error-inline{margin-top:8px;font-size:11.5px;color:var(--dsw-alias-state-error-primary)}
      .vl-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);padding:8px 14px;border-radius:9px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.22);z-index:60;max-width:70%;text-align:center}
      .vl-mask{position:fixed;inset:0;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;z-index:80;padding:20px}
      .vl-modal{width:min(520px,100%);max-height:90vh;overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;padding:17px;box-shadow:0 24px 80px rgba(0,0,0,.35)}
      .vl-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      .vl-field{display:flex;flex-direction:column;gap:5px;margin-bottom:11px;min-width:0}
      .vl-field-label{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary)}
      .vl-field-hint{font-size:10.5px;color:var(--dsw-alias-label-secondary);opacity:.9}
      .vl-switch-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .vl-switch-row:last-child{border-bottom:0}
      .vl-switch-text{min-width:0}
      .vl-label{font-size:12.5px;font-weight:550}
      .vl-switch{width:38px;height:22px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);position:relative;cursor:pointer;flex:none;padding:0;transition:background .15s,border-color .15s}
      .vl-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s,background .15s}
      .vl-switch[data-on="1"]{background:var(--dsw-alias-brand-primary);border-color:transparent}
      .vl-switch[data-on="1"]::after{transform:translateX(16px);background:#fff}
      .vl-switch:disabled{opacity:.5;cursor:not-allowed}
      .vl-engine-page{display:flex;flex-direction:column;gap:14px;max-width:980px;margin:0 auto}
      .vl-status-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
      .vl-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
      .vl-probe{margin:10px 0 4px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2)}
      .vl-probe[data-ok="1"]{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 30%,var(--dsw-alias-border-l1))}
      .vl-probe[data-ok="0"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,var(--dsw-alias-border-l1))}
      .vl-probe-title{font-size:12px;font-weight:650;margin-bottom:6px;display:flex;align-items:center;gap:6px}
      .vl-probe-row{display:flex;align-items:center;gap:8px;font-size:11.5px;padding:2px 0;min-width:0}
      .vl-probe-row svg{flex:none;color:var(--dsw-alias-label-secondary)}
      .vl-probe[data-ok="1"] .vl-probe-row svg{color:var(--dsw-alias-state-success-primary)}
      .vl-probe[data-ok="0"] .vl-probe-row svg{color:var(--dsw-alias-state-error-primary)}
      .vl-probe-name{font-weight:600;flex:none;min-width:76px}
      .vl-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0 16px;margin-top:6px}
      .vl-switch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 22px;margin-top:2px}
      .vl-save-row{display:flex;align-items:center;gap:12px;margin-top:8px;padding-top:11px;border-top:1px solid var(--dsw-alias-border-l1)}
      .vl-kv{display:flex;align-items:baseline;gap:12px;font-size:11.5px;padding:4px 0;border-bottom:1px dashed var(--dsw-alias-border-l1)}
      .vl-kv>span{width:90px;flex:none;color:var(--dsw-alias-label-secondary)}
      .vl-kv>code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vl-outbox{display:flex;flex-direction:column;gap:2px}
      .vl-outbox-item{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:9px}
      .vl-outbox-item:hover{background:var(--dsw-alias-bg-layer-2)}
      .vl-outbox-body{min-width:0;flex:1}
      .vl-outbox-text{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vl-outbox-meta{font-size:10.5px;color:var(--dsw-alias-label-secondary);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vl-link-btn{width:26px;height:26px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);flex:none;text-decoration:none}
      .vl-link-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
      .vl-read-btn{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer}
      .vl-read-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
      .vl-read-btn[data-state="busy"]{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent)}
      .vl-read-btn[data-state="play"]{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,transparent)}
      .vl-read-btn[data-state="error"]{color:var(--dsw-alias-state-error-primary)}
      @keyframes vl-spin{to{transform:rotate(360deg)}}
      @keyframes vl-pulse{0%,100%{opacity:1}50%{opacity:.35}}
      @media (max-width:980px){.vl-grid{grid-template-columns:1fr}.vl-aside{position:static;max-height:none}}
      @media (max-width:680px){.vl-head,.vl-scroll,.vl-tabs{padding-left:14px;padding-right:14px}.vl-form-grid{grid-template-columns:1fr}.vl-head-actions{width:100%}}
    `

    // ── 注册 ────────────────────────────────────────────────────────────────
    const api = {
      inject: ['slots'],
      name: PLUGIN_ID,
      apply(ctx) {
        try {
          ctx.locale?.register?.('voice-lab-main', { 'zh-CN': ZH, 'en-US': EN })
        } catch {
          /* locale 服务不可用时退回内置中文 */
        }
        const label = () => tr(ctx, 'app.title', '声线工坊')
        try {
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 56, label }, SidebarIcon),
          )
        } catch (e) {
          console.warn('[voice-lab-main] sidebar.panellist 注册失败', e)
        }
        try {
          ctx.slots.inject('main', () =>
            ctx.slots.register({ name: 'main', key: PANEL_ID }, (props) => h(Workbench, { ...props, ctx })),
          )
        } catch (e) {
          console.warn('[voice-lab-main] main 面板注册失败', e)
        }
        try {
          ctx.slots.inject('conversation.chat.assistant-actions', () =>
            ctx.slots.register(
              { name: 'conversation.chat.assistant-actions', id: 'voice-lab-main-read', order: 21, label: () => tr(ctx, 'readAction', '朗读') },
              ReadAloudAction,
            ),
          )
        } catch (e) {
          console.warn('[voice-lab-main] 助手朗读按钮注册失败', e)
        }
      },
    }
    return api
  },
})
