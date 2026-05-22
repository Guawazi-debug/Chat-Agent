# 快速入门指南

## 前置条件

1. 安装 [Node.js 16+](https://nodejs.org/)
2. 安装 [Android Studio](https://developer.android.com/studio)

## 方法一：一键配置（推荐新手）

双击 `setup-android.bat`，脚本会自动：
1. 检查环境
2. 安装依赖
3. 添加 Android 平台
4. 同步代码
5. 打开 Android Studio

## 方法二：命令行操作

### 步骤 1：安装依赖

```bash
cd mobile-app
npm install
```

### 步骤 2：添加 Android 平台

```bash
npx cap add android
```

### 步骤 3：同步代码

```bash
npx cap sync
```

### 步骤 4：运行应用

```bash
# 方式 A：直接在设备上运行
npx cap run android

# 方式 B：打开 Android Studio
npx cap open android
```

## 浏览器预览

想先在浏览器中预览效果？

```bash
npx cap serve
```

然后访问 http://localhost:3000

## 构建 APK

### 方式一：使用脚本

双击 `run-android.bat`，选择 "3. 仅构建 APK"

### 方式二：命令行

```bash
cd android
gradlew assembleDebug
```

APK 位置：`android/app/build/outputs/apk/debug/`

### 方式三：Android Studio

1. 选择 Build > Build Bundle(s) / APK(s) > Build APK(s)
2. 等待构建完成
3. 点击通知中的 "locate" 找到 APK

## 真机调试

### Android 设备设置

1. 进入 设置 > 关于手机
2. 连续点击 "版本号" 7 次，开启开发者模式
3. 返回设置，进入 "开发者选项"
4. 开启 "USB 调试"
5. 用 USB 线连接电脑
6. 在手机上允许 USB 调试

### 运行到真机

```bash
npx cap run android
```

或在 Android Studio 中选择你的设备，点击运行按钮。

## 常见问题

### Q: 提示 "ANDROID_HOME not found"

A: 设置环境变量：
1. 打开系统环境变量设置
2. 添加 `ANDROID_HOME`，值为 Android SDK 路径
3. 通常是 `C:\Users\你的用户名\AppData\Local\Android\Sdk`

### Q: Gradle 下载慢

A: 使用国内镜像，编辑 `android/build.gradle`，在 repositories 中添加：
```gradle
maven { url 'https://maven.aliyun.com/repository/public' }
maven { url 'https://maven.aliyun.com/repository/google' }
```

### Q: 如何修改应用名称？

A: 编辑 `capacitor.config.json` 中的 `appName` 字段

### Q: 如何修改应用图标？

A: 
1. 准备不同尺寸的图标（建议 512x512）
2. 在 Android Studio 中右键 res 目录
3. 选择 New > Image Asset
4. 按照向导生成图标

## 下一步

- 阅读 [README.md](README.md) 了解更多功能
- 访问 [Capacitor 文档](https://capacitorjs.com/docs) 学习更多
- 访问 [Android 开发者文档](https://developer.android.com/docs) 深入学习
