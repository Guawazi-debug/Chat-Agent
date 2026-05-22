# AI 对话系统 - 桌面版 (Electron)

基于 Electron 构建的 Windows 桌面应用程序，与网页版功能完全一致。

## 功能特性

- 支持多个 AI 模型：小米 MiMo、DeepSeek、GPT-5.2~5.5
- 图片上传和多模态对话
- 联网搜索功能
- 亮色/暗色主题切换
- 历史对话管理
- 长期记忆系统
- 自定义模型添加
- 数据本地存储（保存到用户目录）

## 开发环境要求

- Node.js 16+ 
- npm 或 yarn

## 安装依赖

```bash
cd electron-app
npm install
```

## 开发运行

```bash
npm start
```

## 构建打包

### 构建 Windows 安装包 (NSIS)

```bash
npm run build
```

构建完成后，安装包位于 `dist` 目录。

### 构建便携版 (Portable)

```bash
npm run build:portable
```

## 项目结构

```
electron-app/
├── main.js          # Electron 主进程
├── preload.js       # 预加载脚本（安全桥接）
├── index.html       # 主页面
├── styles.css       # 样式文件
├── config.js        # 配置文件
├── app.js           # 应用逻辑
├── icon.svg         # 应用图标
├── package.json     # 项目配置
└── README.md        # 说明文档
```

## 数据存储

桌面版数据存储在用户目录下：

- Windows: `%APPDATA%/ai-chat-desktop/chat-data.json`
- macOS: `~/Library/Application Support/ai-chat-desktop/chat-data.json`
- Linux: `~/.config/ai-chat-desktop/chat-data.json`

## 与网页版的区别

| 功能 | 网页版 | 桌面版 |
|------|--------|--------|
| 数据存储 | localStorage | JSON 文件 |
| 导入导出 | 浏览器下载 | 系统文件对话框 |
| 确认对话框 | 浏览器 confirm | Electron dialog |
| 菜单 | 无 | 应用菜单 |
| 快捷键 | 浏览器默认 | 自定义菜单快捷键 |
| 开发者工具 | F12 | F12 (可配置) |

## 快捷键

- `Ctrl+N` - 新建对话
- `Ctrl+R` - 重新加载
- `F12` - 开发者工具
- `F11` - 全屏切换
- `Ctrl+Q` - 退出

## 注意事项

1. 首次运行需要配置 API 密钥
2. 数据文件是纯 JSON，可以手动编辑
3. 构建前请确保已安装所有依赖
4. 如需自定义图标，替换 `icon.svg` 文件

## 许可证

MIT License
