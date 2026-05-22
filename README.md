# AI 对话系统 - 集成全能智能体

一个集成的全能智能体对话系统，通过统一工作流自动处理用户请求，无需手动选择模型。系统集成了多个AI模型的能力，包括意图识别、图片理解、联网搜索和深度思考，为用户提供智能化的对话体验。

## 项目特点

- **统一工作流**：用户无需选择模型，系统自动根据任务类型调用合适的模型
- **智能意图识别**：自动分析用户需求，判断是否需要搜索或生成图片
- **图片理解**：支持图片上传和内容识别分析
- **联网搜索**：自动获取实时信息，回答时效性问题
- **深度思考**：复杂问题推理分析，支持深度思考模式
- **流式响应**：实时显示AI回答，提升用户体验
- **上下文记忆**：保持对话连贯性，支持长期记忆
- **多平台支持**：Web、Desktop（Electron）、Mobile（Capacitor）三端部署

## 技术架构

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端 | HTML/CSS/JavaScript | 纯原生实现，零外部依赖 |
| 桌面端 | Electron | Windows桌面应用 |
| 移动端 | Capacitor | Android/iOS应用 |
| 存储 | localStorage/IndexedDB | 本地数据持久化 |

### 部署目标

| 平台 | 目录 | 说明 |
|------|------|------|
| Web | `web-app/` | 浏览器端独立应用 |
| Desktop | `electron-app/` | Electron桌面应用 |
| Mobile | `mobile-app/` | Capacitor移动应用 |

## 系统工作流

系统使用统一工作流处理所有用户输入，无需手动选择模型：

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  步骤1: 意图识别                                                │
│  模型: DeepSeek V4 Flash                                        │
│  输入: 用户文本                                                 │
│  输出: {intent, needSearch, needImageGeneration, keywords}      │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  步骤2: 图片识别 (仅在有图片时执行)                              │
│  模型: MiMo v2.5                                                │
│  输入: 图片base64数据                                           │
│  输出: 图片内容描述文本                                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  步骤3: 联网搜索 (仅在意图识别判断需要时执行)                    │
│  模型: MiMo v2.5 Pro (联网搜索工具)                             │
│  输入: 意图识别提取的关键词                                     │
│  输出: 搜索结果摘要                                             │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  步骤4: 生成最终回答                                            │
│  模型: DeepSeek V4 Flash (深度思考模式)                         │
│  输入: 用户问题 + 图片识别结果 + 搜索结果 + 意图分析            │
│  输出: 最终回答 (流式输出)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 核心函数

| 函数名 | 功能 | 所在文件 |
|--------|------|----------|
| `executeWorkflow()` | 工作流主入口 | app.js |
| `analyzeIntentWithDeepSeek()` | 意图识别 | app.js |
| `recognizeImageWithMiMo()` | 图片识别 | app.js |
| `searchWithMiMoPro()` | 联网搜索 | app.js |
| `generateFinalAnswer()` | 生成最终回答 | app.js |
| `streamResponse()` | 流式响应处理 | app.js |
| `updateWorkflowUI()` | 更新工作流状态显示 | app.js |

### 降级策略

| 场景 | 处理方式 |
|------|----------|
| 意图识别失败 | 使用默认意图继续处理 |
| 图片识别失败 | 跳过，继续下一步 |
| 联网搜索失败 | 跳过，继续下一步 |
| 最终回答失败 | 降级到直接调用模型回答 |

## 项目结构

```
Chat-AI/
├── web-app/                    # Web端应用
│   ├── index.html              # UI界面
│   ├── app.js                  # 主程序（UI逻辑、API调用、状态管理、工作流引擎）
│   ├── config.js               # 模型配置、系统提示词、工作流配置
│   ├── styles.css              # 样式文件
│   ├── memory.js               # 增强记忆系统
│   └── dev-server.mjs          # 开发服务器
│
├── electron-app/               # Electron桌面端
│   ├── main.js                 # Electron主进程
│   ├── preload.js              # 预加载脚本
│   ├── index.html              # 桌面端UI
│   ├── app.js                  # 桌面端主程序
│   ├── config.js               # 桌面端配置
│   ├── styles.css              # 桌面端样式
│   ├── memory.js               # 桌面端记忆系统
│   ├── package.json            # Electron依赖配置
│   └── build.bat               # Windows构建脚本
│
├── mobile-app/                 # Capacitor移动端
│   ├── capacitor.config.json   # Capacitor配置
│   ├── www/                    # Web资源目录
│   │   ├── index.html          # 移动端UI
│   │   ├── app.js              # 移动端主程序
│   │   ├── config.js           # 移动端配置
│   │   ├── styles.css          # 移动端样式
│   │   └── mobile.js           # Capacitor桥接
│   ├── android/                # Android原生项目
│   └── package.json            # Capacitor依赖配置
│
├── package.json                # 根目录工作区配置
├── CLAUDE.md                   # Claude Code指导文件
├── README.md                   # 项目说明文档
└── 项目书.md                   # 详细项目文档
```

## 快速开始

### 前置要求

- Node.js 16+
- npm 或 yarn
- 现代浏览器（Chrome、Firefox、Edge、Safari）
- Android Studio（移动端开发）
- Xcode（iOS开发，仅macOS）

### API密钥配置

在使用前，需要配置以下API密钥：

| 服务 | 获取地址 |
|------|----------|
| MiMo | https://platform.xiaomimimo.com/console/api-keys |
| DeepSeek | https://platform.deepseek.com/api_keys |

### Web端运行

```bash
# 方式1: 使用Python
cd web-app
python -m http.server 8080

# 方式2: 使用Node.js
cd web-app
npx http-server -p 8080

# 方式3: 使用根目录命令
npm run web
```

访问 http://localhost:8080 即可使用。

### Desktop端运行

```bash
cd electron-app
npm install          # 安装依赖
npm start            # 开发模式运行
```

### Mobile端运行

```bash
cd mobile-app
npm install          # 安装依赖
npx cap sync         # 同步Web资源到原生项目
npx cap open android # 在Android Studio中打开
```

## 构建命令

### Web端

Web端无需构建，直接运行即可。

### Desktop端构建

```bash
# 构建Windows安装包和便携版
npm run desktop:build

# 仅构建便携版
npm run desktop:portable
```

构建产物位于 `electron-app/dist/` 目录。

### Mobile端构建

```bash
# 同步Web资源到原生项目
npm run mobile:sync

# 打开Android Studio
npm run mobile:android

# 打开Xcode（仅macOS）
npm run mobile:ios
```

## 根目录命令

根目录提供了统一的快捷命令：

```bash
# 运行Web端
npm run web

# 运行Desktop端
npm run desktop

# 构建Desktop端
npm run desktop:build
npm run desktop:portable

# 运行Mobile端
npm run mobile:serve

# 同步Mobile端
npm run mobile:sync

# 打开Mobile端IDE
npm run mobile:android
npm run mobile:ios
```

## API集成

### 模型配置

| 提供商 | 模型ID | 用途 | 认证方式 | 流式支持 |
|--------|--------|------|----------|----------|
| MiMo | `mimo-v2.5-pro` | 联网搜索 | `api-key` header | 否 |
| MiMo | `mimo-v2.5` | 图片识别 | `api-key` header | 否 |
| MiMo | `mimo-v2-pro` | 通用对话 | `api-key` header | 否 |
| MiMo | `mimo-v2-omni` | 多模态 | `api-key` header | 否 |
| DeepSeek | `deepseek-v4-flash` | 意图识别/生成回答 | `Authorization: Bearer` | 是 |
| DeepSeek | `deepseek-v4-pro` | 深度思考 | `Authorization: Bearer` | 是 |
| Image | `gpt-image-2` | 图像生成 | `Authorization: Bearer` | 否 |

### 工作流模型配置

```javascript
const WORKFLOW_MODELS = {
    intentAnalysis: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        thinking: false,  // 意图识别关闭深度思考以提高速度
        maxTokens: 1024
    },
    imageRecognition: {
        provider: 'mimo',
        model: 'mimo-v2.5',
        stream: false,
        maxTokens: 1024
    },
    webSearch: {
        provider: 'mimo',
        model: 'mimo-v2.5-pro',
        stream: false,
        tools: true,
        maxTokens: 2048
    },
    finalAnswer: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        thinking: true,
        reasoningEffort: 'medium'  // 中等推理强度，平衡速度和质量
    }
};
```

## 功能列表

### 核心功能

| 功能 | 说明 | 状态 |
|------|------|------|
| 统一工作流 | 自动识别意图并调用合适的模型 | 已实现 |
| 意图识别 | 使用DeepSeek分析用户需求 | 已实现 |
| 图片理解 | 使用MiMo识别图片内容 | 已实现 |
| 联网搜索 | 使用MiMo Pro获取实时信息 | 已实现 |
| 深度思考 | DeepSeek深度推理模式 | 已实现 |
| 流式响应 | 实时显示AI回答 | 已实现 |
| 上下文记忆 | 保持对话连贯性 | 已实现 |
| 长期记忆 | 跨对话记忆重要信息 | 已实现 |

### 对话管理

| 功能 | 说明 | 状态 |
|------|------|------|
| 新建对话 | 创建新的对话会话 | 已实现 |
| 历史对话 | 查看和加载历史对话 | 已实现 |
| 删除对话 | 删除不需要的对话（支持批量删除） | 已实现 |
| 对话标题 | 自动生成对话标题 | 已实现 |
| 多选模式 | 批量选择和管理对话 | 已实现 |

### 设置功能

| 功能 | 说明 | 状态 |
|------|------|------|
| API配置 | 配置MiMo、DeepSeek、GPT-Image的API Key | 已实现 |
| 记忆设置 | 配置上下文记忆参数 | 已实现 |
| 头像设置 | 选择或上传用户头像 | 已实现 |
| 存储设置 | 数据导入导出和清除 | 已实现 |
| 主题切换 | 深色/浅色主题 | 已实现 |
| API测速 | 测试API连接状态 | 已实现 |

## 数据存储

### localStorage Keys

| Key | 用途 |
|-----|------|
| `ai_chat_api_config` | API密钥和端点配置 |
| `ai_chat_memory_config` | 上下文/记忆设置 |
| `ai_chat_chat_history` | 所有对话记录 |
| `ai_chat_long_term_memory` | 长期记忆数据 |
| `ai_chat_theme` | 主题偏好设置 |
| `ai_chat_user_avatar` | 用户头像设置 |

### StorageAdapter模式

系统使用StorageAdapter模式抽象存储层，支持多平台：

- **Web端**：直接使用localStorage
- **Desktop端**：通过IPC调用Electron的文件系统，存储在 `app.getPath('userData')/chat-data.json`
- **Mobile端**：通过Capacitor Filesystem API，存储在应用私有目录 `Directory.Data`

### ImageStore模式

生成的图片单独存储：

- **Web端**：使用IndexedDB（`ai_chat_images`数据库）
- **Desktop端**：通过IPC调用文件系统，存储在 `images/` 目录
- **Mobile端**：通过Capacitor Filesystem API，存储在 `images/{id}.png`

## 开发指南

### 开发规范

1. **代码风格**：保持代码简洁、可读，添加必要的中文注释
2. **提交规范**：使用清晰的提交信息，说明修改内容
3. **测试验证**：修改后务必测试功能是否正常
4. **文档更新**：重要功能变更需更新相关文档

### 跨平台开发

- 平台特定逻辑保留在对应的目录中
- 相同功能需要在多个平台实现时，需分别更新和验证
- 保持以下内容的一致性：模型ID、API端点、请求格式、localStorage键名、聊天历史结构、记忆数据结构

### 性能优化

- 流式响应节流（30ms）减少DOM更新
- 聊天历史保存防抖
- 滚动优化使用requestAnimationFrame
- 意图识别关闭深度思考以提高速度

## 系统要求

### 浏览器要求

- 现代浏览器（Chrome、Firefox、Edge、Safari）
- 支持ES6+
- 支持Fetch API
- 支持localStorage

### 开发环境

- Node.js 16+
- npm 或 yarn
- Android Studio（移动端开发）
- Xcode（iOS开发，仅macOS）

## 许可证

MIT License

## 项目维护

- **版本**: 1.0.0
- **最后更新**: 2026-05-22

---

如有问题或建议，欢迎提交Issue或Pull Request。
