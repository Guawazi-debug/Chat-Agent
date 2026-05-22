# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 对话系统 — 集成的全能智能体，支持意图识别、图片理解、联网搜索和深度思考。三个部署目标：

- **Web**: standalone browser client (`web-app/`)
- **Desktop**: Electron client (`electron-app/`)
- **Mobile**: Capacitor Android/iOS client (`mobile-app/`)

## Build & Run Commands

### Web (no build step)
```bash
cd web-app
python -m http.server 8080
# or
npx http-server -p 8080
```

### Desktop (Electron)
```bash
cd electron-app
npm install          # install deps
npm start            # dev mode
npm run build        # build Windows installer (NSIS + portable)
```

### Mobile (Capacitor)
```bash
cd mobile-app
npm install
npx cap sync         # sync web assets to native project
npx cap open android # open in Android Studio
```

## Architecture

### Core Files (web-app/)
| File | Purpose |
|------|---------|
| `config.js` | 模型配置、系统提示词、工作流配置 |
| `app.js` | 主程序：UI逻辑、API调用、状态管理、工作流引擎 |
| `memory.js` | 增强记忆系统，语义搜索 |
| `index.html` | UI界面 |
| `styles.css` | 样式 |

### Unified Workflow System
系统使用统一工作流处理所有用户输入，无需手动选择模型：

```
用户输入 → 意图识别 → 图片识别(可选) → 联网搜索(可选) → 生成回答
             ↓              ↓                ↓              ↓
        DeepSeek Flash   MiMo v2.5      MiMo v2.5 Pro   DeepSeek Flash
        (深度思考)       (图片理解)      (联网搜索)       (深度思考)
```

**核心函数** (`app.js`):
- `executeWorkflow()` — 工作流主入口
- `analyzeIntentWithDeepSeek()` — 意图识别
- `recognizeImageWithMiMo()` — 图片识别
- `searchWithMiMoPro()` — 联网搜索
- `generateFinalAnswer()` — 生成最终回答
- `streamResponse()` — 流式响应处理
- `updateWorkflowUI()` — 更新工作流状态显示
- `syncWorkflowUIForCurrentChat()` — 切换对话时同步工作流状态

### Chat History Management
- `renderHistoryList()` — 渲染历史对话列表，支持多选模式
- `toggleSelectMode()` — 进入/退出多选模式
- `deleteSelectedChats()` — 删除选中的对话
- `clearAllChats()` — 清空所有对话
- `toggleSelectAll()` — 全选/取消全选

### Data Flow
1. `config.js` exports globals (`APP_CONFIG`, `DEFAULT_API_CONFIG`, `MODEL_CONFIG`, `WORKFLOW_MODELS`, `WORKFLOW_SYSTEM_PROMPTS`) to `window`
2. `app.js` reads those globals and manages state via `AppState` and `WorkflowState`
3. All persistence uses `localStorage` with prefix `ai_chat_`

### StorageAdapter Pattern
Abstracts storage across platforms (top of `app.js`):
- **Web**: direct `localStorage`
- **Electron**: IPC to `app.getPath('userData')/chat-data.json`
- **Mobile**: Capacitor Filesystem → `chat-data.json` in app-private `Directory.Data`
- `saveSync(key, data)` / `loadSync(key)` — synchronous wrappers
- `init()` — on startup, syncs persistent storage → localStorage for Electron/Mobile

### ImageStore Pattern
Generated images are stored separately from chat data:
- **Web**: IndexedDB (`ai_chat_images` database)
- **Electron**: IPC → file system (`images/` in userData)
- **Mobile**: Capacitor Filesystem → `images/{id}.png` in `Directory.Data`

### API Integration
| Provider | Models | Auth Header | Streaming | Notes |
|----------|--------|-------------|-----------|-------|
| MiMo | `mimo-v2.5-pro`, `mimo-v2.5`, `mimo-v2-pro`, `mimo-v2-omni`, `mimo-v2-flash` | `api-key` | No | 联网搜索通过 `tools` 参数 |
| DeepSeek | `deepseek-v4-flash`, `deepseek-v4-pro` | `Authorization: Bearer` | Yes | 深度思考模式支持 |
| Image | `gpt-image-2` | `Authorization: Bearer` | No | 图像生成，返回 b64_json |

### Model Parameters (`config.js` → `MODEL_CONFIG.modelParams`)
MiMo 模型在思考模式下 temperature 会被强制设为 1.0，不支持自定义。
- mimo-v2.5-pro, mimo-v2.5, mimo-v2-pro, mimo-v2-omni: temperature=1.0, top_p=0.95
- mimo-v2-flash: temperature=0.3, top_p=0.95
- `getModelParams(model, thinking)` 函数根据模型和思考模式返回正确的参数

### API Key Management (`app.js`)
- `hasApiKey(provider)` — 检查指定 provider 的 Key 是否已配置
- `hasAnyApiKey()` — 检查是否有任意一个 Key 已配置
- `getAvailableModels(stepType)` — 获取指定步骤可用的模型列表
- `hasAvailableModel(stepType)` — 检查指定步骤是否有可用模型
- 工作流执行时自动跳过没有 Key 的步骤
- 设置页面提供 API 连接测速功能 (`testApiConnection`)

### Stream Output State Management
流式输出使用 `isStreaming` 标志控制 UI 状态：
- 收到第一个有效内容时设置 `isStreaming = true`
- `updateLastMessageContent()` 根据 `isStreaming` 决定是否显示 loading 提示
- 深度思考过程流式输出时自动展开，完成后自动收缩
- 流式输出完成时设置 `isStreaming = false` 和 `isLoading = false`

### Key Design Decisions
- **Zero external dependencies** — Markdown rendering and syntax highlighting are self-implemented
- **Unified workflow** — 用户无需选择模型，系统自动根据任务类型调用合适的模型
- **Graceful degradation** — 工作流任何阶段失败都会跳过，用已有结果继续
- **API Key auto-detection** — 没有 Key 的模型自动从选项中隐藏，工作流步骤自动跳过
- **Dynamic model selection** — 意图识别和生成回答步骤根据可用 Key 自动选择模型
- **Chat history is lazy-created** — only saved after first message (`AppState.isNewChat` flag)
- **Context window**: configurable `maxContextMessages` (default 50), with auto-summarization
- **Long-term memory**: extracted from recent messages, injected as system prompt
- **PC/Mobile responsive** — Two sets of UI elements with `desktop-only-btn` and `more-menu-container`
- **Sidebar on mobile** — Overlay pattern: `.sidebar.active` slides in with `z-index: 1001`
- **Multi-select mode** — `AppState.selectMode` and `AppState.selectedChats` (Set) for batch operations

### Workflow State Management
- `WorkflowStateMap` (Map) — per-chat workflow state for concurrent execution
- `getWorkflowState(chatId)` — get/create workflow state for specific chat
- `WorkflowState.isRunning` — indicates if workflow is active for that chat
- `WorkflowState.steps[]` — tracks status of each workflow step (pending/running/done/skipped)

### Performance Optimizations
- Stream response throttling (`STREAM_THROTTLE_MS` = 30ms) — reduces DOM updates
- Debounced chat history saves (`saveChatHistoryDebounced`)
- Scroll optimization with `requestAnimationFrame`
- Intent analysis without thinking mode for faster response
- MiMo intent analysis uses reduced max_tokens (512) for faster response

### localStorage Keys
- `ai_chat_api_config` — API keys and endpoints
- `ai_chat_memory_config` — Context/memory settings
- `ai_chat_chat_history` — All conversations
- `ai_chat_long_term_memory` — Extracted long-term memories
- `ai_chat_theme` — Theme preference (dark/light)
- `ai_chat_user_avatar` — User avatar preference

### Electron Desktop (`electron-app/`)
- `main.js` — BrowserWindow creation, app menu, IPC handlers
- `preload.js` — Exposes `electronAPI` to renderer via `contextBridge`

### Mobile App (`mobile-app/`)
- `www/mobile.js` — Capacitor bridge: camera, filesystem, sharing, haptics, keyboard, safe area
- `MobileAPI` object wraps Capacitor plugins
- Uses `Directory.Data` for all file operations — no Android storage permissions required

## Repository Hygiene

Generated output should not be edited by hand:
- `node_modules/`
- `electron-app/dist/`
- Capacitor and Android build output
- packaged installers

Do not commit real API keys, exported chat data, or local user data.
