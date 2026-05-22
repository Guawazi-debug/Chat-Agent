# AI 对话系统 - 移动端 App (Capacitor)

基于 Capacitor 构建的移动端应用，支持 Android 和 iOS 平台。

## 功能特性

- 支持多个 AI 模型：小米 MiMo、DeepSeek、GPT-5.2~5.5
- 图片上传：支持相机拍照和相册选择
- 联网搜索功能
- 亮色/暗色主题切换
- 历史对话管理
- 长期记忆系统
- 移动端优化：触摸手势、滑动侧边栏、安全区域适配

## 环境要求

### Android 开发
- Node.js 16+
- Android Studio
- JDK 17+
- Android SDK 33+

### iOS 开发（需要 macOS）
- Node.js 16+
- Xcode 14+
- CocoaPods

## 快速开始

### 1. 安装依赖

```bash
cd mobile-app
npm install
```

### 2. 添加平台

```bash
# Android
npx cap add android

# iOS（需要 macOS）
npx cap add ios
```

### 3. 同步代码到原生项目

```bash
npx cap sync
```

### 4. 打开原生 IDE

```bash
# Android
npx cap open android

# iOS
npx cap open ios
```

### 5. 构建运行

在 Android Studio 或 Xcode 中点击运行按钮。

## 开发调试

### 浏览器预览

```bash
npx cap serve
```

### Android 调试

1. 连接 Android 设备或启动模拟器
2. 运行 `npx cap run android`

### iOS 调试

1. 连接 iOS 设备或启动模拟器
2. 运行 `npx cap run ios`

## 项目结构

```
mobile-app/
├── www/                    # Web 源文件
│   ├── index.html         # 主页面
│   ├── styles.css         # 样式文件
│   ├── config.js          # 配置文件
│   ├── app.js             # 应用逻辑
│   └── mobile.js          # 移动端桥接层
├── android/               # Android 原生项目（自动生成）
├── ios/                   # iOS 原生项目（自动生成）
├── capacitor.config.json  # Capacitor 配置
├── package.json           # 项目配置
└── README.md              # 说明文档
```

## 原生功能使用

### 相机拍照

```javascript
// 拍照
const imageData = await MobileAPI.takePicture();

// 从相册选择
const imageData = await MobileAPI.pickImage();
```

### 分享功能

```javascript
await MobileAPI.shareContent('标题', '内容');
```

### 本地通知

```javascript
await MobileAPI.sendNotification('标题', '内容');
```

### 震动反馈

```javascript
await MobileAPI.vibrate(100);
```

## 构建发布

### Android APK

1. 在 Android Studio 中选择 Build > Build Bundle(s) / APK(s) > Build APK(s)
2. APK 位于 `android/app/build/outputs/apk/debug/`

### Android App Bundle (推荐)

1. 在 Android Studio 中选择 Build > Build Bundle(s) / APK(s) > Build Bundle(s)
2. AAB 位于 `android/app/build/outputs/bundle/release/`

### iOS

1. 在 Xcode 中选择 Product > Archive
2. 按照向导发布到 App Store

## 配置说明

### 修改应用信息

编辑 `capacitor.config.json`：

```json
{
  "appId": "com.yourcompany.appid",
  "appName": "你的应用名称"
}
```

### 修改应用图标

1. Android: 替换 `android/app/src/main/res/` 下的图标文件
2. iOS: 在 Xcode 中打开 Assets.xcassets 替换图标

### 修改启动画面

编辑 `capacitor.config.json` 中的 SplashScreen 配置：

```json
{
  "plugins": {
    "SplashScreen": {
      "backgroundColor": "#1a1a1e",
      "launchShowDuration": 2000
    }
  }
}
```

## 常见问题

### Q: 如何在真机上调试？

A: 
1. Android: 开启开发者选项和 USB 调试
2. iOS: 需要 Apple Developer 账号

### Q: 如何添加原生插件？

A: 
```bash
npm install @capacitor/插件名
npx cap sync
```

### Q: 构建失败怎么办？

A: 
1. 检查 Node.js 版本
2. 清理缓存：`npx cap sync --inline`
3. 检查 Android Studio/Xcode 版本

### Q: 如何更新 Capacitor？

A: 
```bash
npm update @capacitor/core @capacitor/cli
npx cap sync
```

## 许可证

MIT License
