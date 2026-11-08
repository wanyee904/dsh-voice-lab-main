# DSH Voice Lab

把本机语音模型接进 **DeepSeek Harness**：管理声线、做多音频训练、导出能直接拿去 AutoDL 的训练包，并在回复时实时合成语音。

这是公开发布版，插件 ID、界面、功能与 `dsh-voice-lab` 基本一致，但**不包含任何个人声线、个人权重、训练数据、日志或账号配置**。

## 功能

| 能力 | 说明 |
| --- | --- |
| 本机语音引擎 | MOSS-TTS-Nano、VoxCPM2（含 LoRA）、OpenAI 兼容接口、HTTP JSON、任意命令行 |
| 声线库 | 内置音色、克隆音色、多轮训练声线、只读声线 |
| Studio | 上传素材、参考音、试听、文本阅读、选择预设 |
| 多音频训练 | 批量上传、编号对齐台词、多选删除、调整顺序、LoRA/步数/检查点 |
| 台词导入 | 上传 `.txt`，按编号把台词写进对应音频 |
| 训练导出 | 生成与 AutoDL 实测可用包同结构的 `audio/N.wav + train.jsonl + README_AutoDL.txt` |
| 实时配音 | 助手消息朗读、自动朗读、可选与 `dsh-douyin-edge` 联动 |
| 本机 HTTP 桥 | 同源 `POST /voice-lab-main/api/tts` |

## 和 `dsh-voice-lab` 的关系

两个是**独立插件**，可以单独安装：

- 插件 ID：`dsh-voice-lab-main`
- 面板 ID：`voicelab-main-panel`
- API 前缀：`/voice-lab-main/api`
- 数据目录：`%USERPROFILE%\.dsh\voice-lab-main`
- Agent 工具名：`voice_speak_main`
- 默认不读取 `dsh-voice-lab` 的数据目录，也不会带出原插件的声线/日志。

## 环境要求

- DeepSeek Harness，Node.js >= 22
- Python 3.10+（按使用的引擎准备）
- FFmpeg（训练素材转 16 kHz WAV 时需要）
- 可选：
  - MOSS-TTS-Nano 仓库与 ONNX 模型
  - VoxCPM2 代码、底座与 LoRA 权重
  - 本机 `dsh-douyin-edge`

## 安装

```bash
git clone <your-repo-url> dsh-voice-lab-main
dsh plugin --profile desktop add link:<绝对路径>/dsh-voice-lab-main
```

重启或重新加载 DSH Web 后，侧边栏会出现声线工坊入口。

首次启动会在 `%USERPROFILE%\.dsh\voice-lab-main` 建空数据目录；不会自动创建个人声线。

## 配置

进入 **声线工坊 → 引擎**：

- **MOSS-TTS-Nano**
  - Python 路径：例如 `%USERPROFILE%\miniconda3\envs\moss-tts-nano\python.exe`
  - MOSS 仓库目录
  - ONNX 模型目录
- **VoxCPM2**
  - Python 路径
  - VoxCPM2 底座目录
  - LoRA 权重目录（可选；没有就只用底座）
- **OpenAI 兼容 / HTTP JSON / 命令**
  - 按自己的服务地址填写

所有路径都按当前机器配置，不写死在代码里。

## 训练流程

1. 写入端口批量上传音频；
2. 填写右侧台词，或上传 `.txt` 一键导入；
3. 选择模型采样率、LoRA r、步数、检查点间隔；
4. 开始训练；
5. 训练版本可试听、删除、加入声线库；
6. 导出训练包到自定义目录。

台词文件支持：

```text
（1）.台词
（1），台词
（1）,台词
（1）。台词
```

也兼容 `1.台词`。插件会去掉行首编号和那一个标点，并按编号写入对应音频。

## 导出训练包

导出结构：

```text
audio/1.wav ... audio/N.wav   # 16 kHz 单声道 PCM16
train.jsonl                    # {"audio": "audio/N.wav", "text": "台词"}
README_AutoDL.txt
```

- 音频统一转成 16 kHz 单声道 WAV；
- `train.jsonl` 使用相对路径，换机器不用改写；
- 不包含 `config.yaml`、`audio_16k/` 或绝对路径；
- 导出前要求每段都有台词。

## 使用权重训练

「导出训练包」旁边的 **使用权重训练** 可导入上一次训练后的 LoRA 权重继续训练：

```text
lora_weights.safetensors
lora_config.json
```

选择包含这两个文件的目录，或直接选 `lora_weights.safetensors` 文件即可；`lora_config.json` 里的 `r` 会自动同步到训练参数。

- 导入成功后会**清空当前写入端口的全部音频和台词 JSONL**，避免旧数据混进新训练；
- 然后重新上传音频、填写台词，再开始训练；
- 训练时会先把该权重放进新会话的 `latest`，VoxCPM 训练器从它初始化；
- 点「清除导入权重」可恢复从底座重新训练。

## 直接使用权重

导出区还有 **使用权重**，它不会进入训练，而是把权重直接载入 Studio 当前选中的声线：

- 目录或 `lora_weights.safetensors` 路径均可；
- 会保留当前声线的参考音，重新生成 `speak.py` 并切成命令引擎；
- 训练版本的每一行也有 **载入权重**，可以把该检查点直接载入当前声线；
- 内置音色、只读声线、当前训练目标声线不能载入。

## 每个预设独立训练设置

通过 **多音频训练** 锁定某个目标声线后，训练步数、LoRA r、检查点间隔、路径模式、模型和导出目录会按该预设分别记忆。切换到其他预设的「多音频训练」不会串用上一套参数。

## 训练日志

日志面板支持：

- **下载日志**
- **打开日志**：用系统默认编辑器打开本地日志文件
- **删除日志**：只删除日志，不删除权重和检查点
- **关闭日志 / 查看日志**：收起或展开日志内容

## 本机 API

```http
POST /voice-lab-main/api/tts
Content-Type: application/json

{"text":"你好","presetId":"可选"}
```

返回：

```json
{"ok":true,"url":"/voice-lab-main/audio/out/xxx.wav","path":"..."}
```

健康检查：

```http
GET /voice-lab-main/api/health
```

## Agent 工具

公共版工具名为 **`voice_speak_main`**，支持：

- `action: "speak"`，`text`
- `action: "presets"`
- `action: "status"`

## 与抖音插件联动

如果同一 Host 安装了 `dsh-douyin-edge`，本插件会监听 `dye_reply` / `dye_comment` / `dye_chat_send` 的成功结果，用当前声线在本地合成语音并写入配音历史。抖音评论/私信本身仍然发送文字，音频只是本地可播放/下载的配音。

不需要联动时，可在「配音历史 → 实时配音」关闭。

## 数据与隐私

- 所有声线、素材、训练日志、权重都在本机数据目录；
- 默认使用本机模型；没有遥测，也不会上传声线素材；
- 只有当你主动配置 OpenAI 兼容 / HTTP JSON 等远程引擎时，待合成文本才会发送到你填写的接口；
- 公开仓库不包含任何个人声音、训练权重、日志或账号信息；
- `.dsh/`、音频、权重、训练输出和 ZIP 已加入 `.gitignore`。

## 已知限制

- VoxCPM2 2B 训练对显存要求较高；8 GB 显存可能在第一个 step 报错，建议 16 GB+ 或使用云端（如 AutoDL）。
- VoxCPM 命令/自训练声线每次朗读可能重新加载模型，首次较慢。
- 本机引擎需要自行准备 Python 环境和模型，插件不附带模型权重。

## 许可

MIT License。`python/voxcpm_train.py` 来自 OpenBMB/VoxCPM，按其上游许可证使用；详见 `THIRD_PARTY_NOTICES.md`。
