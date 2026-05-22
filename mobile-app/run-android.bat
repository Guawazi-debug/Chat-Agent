@echo off
echo ========================================
echo   AI 对话系统 - Android 构建运行
echo ========================================
echo.

echo [1/3] 同步代码...
call npx cap sync
if errorlevel 1 (
    echo 错误: 同步失败
    pause
    exit /b 1
)
echo 同步完成
echo.

echo [2/3] 构建 Android 应用...
echo 请确保 Android Studio 已打开项目
echo.
echo 选择运行方式:
echo 1. 在连接的设备上运行
echo 2. 在模拟器上运行
echo 3. 仅构建 APK
echo.
set /p choice="请选择 (1/2/3): "

if "%choice%"=="1" (
    echo 正在连接设备运行...
    call npx cap run android
) else if "%choice%"=="2" (
    echo 正在启动模拟器运行...
    call npx cap run android --target
) else if "%choice%"=="3" (
    echo 正在构建 APK...
    cd android
    call gradlew assembleDebug
    echo.
    echo APK 位置: android/app/build/outputs/apk/debug/
    cd ..
) else (
    echo 无效选择
)

echo.
echo ========================================
echo   完成！
echo ========================================
echo.
pause
