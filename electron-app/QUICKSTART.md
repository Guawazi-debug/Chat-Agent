# 快速入门指南

## 方法一：双击脚本（推荐）

1. 双击 `dev.bat` - 首次运行会自动安装依赖并启动应用
2. 双击 `build.bat` - 构建 Windows 安装包

## 方法二：命令行操作

### 1. 安装依赖

```bash
cd electron-app
npm install
```

### 2. 开发运行

```bash
npm start
```

### 3. 构建安装包

```bash
npm run build
```

构建完成后，在 `dist` 文件夹中找到安装包：
- `AI对话系统 Setup x.x.x.exe` - 安装版
- `AI对话系统 x.x.x.exe` - 便携版（无需安装）

## 常见问题

### Q: 提示 "node 不是内部命令"
A: 需要先安装 Node.js，下载地址：https://nodejs.org/

### Q: npm install 失败
A: 尝试使用国内镜像：
```bash
npm install --registry=https://registry.npmmirror.com
```

### Q: 构建后的应用无法启动
A: 检查是否有杀毒软件拦截，或者尝试以管理员身份运行

### Q: 如何修改应用图标？
A: 替换 `icon.svg` 文件，然后重新构建

## 开发调试

启动应用后，按 F12 打开开发者工具进行调试。

## 数据位置

桌面版数据存储在：
```
Windows: %APPDATA%/ai-chat-desktop/chat-data.json
```

可以手动备份或编辑此文件。
