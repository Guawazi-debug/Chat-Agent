@echo off
echo ========================================
echo   AI 对话系统 - 开发模式启动
echo ========================================
echo.

echo 检查依赖...
if not exist "node_modules" (
    echo 首次运行，安装依赖...
    call npm install
    echo.
)

echo 启动应用...
call npm start
