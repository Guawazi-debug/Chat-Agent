@echo off
echo ========================================
echo   AI 对话系统 - Android 环境配置
echo ========================================
echo.

echo [1/5] 检查 Node.js 环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Node.js，请先安装 Node.js 16+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js 版本:
node --version
echo.

echo [2/5] 安装项目依赖...
call npm install
if errorlevel 1 (
    echo 错误: 安装依赖失败
    pause
    exit /b 1
)
echo 依赖安装完成
echo.

echo [3/5] 添加 Android 平台...
call npx cap add android
if errorlevel 1 (
    echo Android 平台可能已存在，继续...
)
echo.

echo [4/5] 同步代码到 Android 项目...
call npx cap sync
if errorlevel 1 (
    echo 错误: 同步失败
    pause
    exit /b 1
)
echo 同步完成
echo.

echo [5/5] 打开 Android Studio...
call npx cap open android
echo.

echo ========================================
echo   配置完成！
echo   请在 Android Studio 中运行项目
echo ========================================
echo.
pause
