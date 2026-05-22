@echo off
echo ========================================
echo   AI 对话系统 - 桌面版构建脚本
echo ========================================
echo.

echo [1/3] 检查 Node.js 环境...
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

echo [2/3] 安装依赖...
call npm install
if errorlevel 1 (
    echo 错误: 安装依赖失败
    pause
    exit /b 1
)
echo 依赖安装完成
echo.

echo [3/3] 构建 Windows 应用...
call npm run build
if errorlevel 1 (
    echo 错误: 构建失败
    pause
    exit /b 1
)
echo.
echo ========================================
echo   构建完成！
echo   安装包位于: dist 目录
echo ========================================
echo.
pause
