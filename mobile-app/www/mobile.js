/**
 * 移动端原生功能桥接层
 * 提供 Capacitor 插件的封装，同时兼容浏览器环境
 */

// 检测是否在 Capacitor 环境中运行
const isMobile = typeof window.Capacitor !== 'undefined';

/**
 * 移动端日志系统
 * 将日志写入文件，便于诊断问题
 */
const MobileLogger = {
    // 日志缓冲区
    _buffer: [],
    // 日志文件名
    _logFile: 'ai-chat-debug.log',
    // 是否已初始化
    _initialized: false,
    // 写入定时器
    _writeTimer: null,
    // 最大缓冲条数
    _maxBufferSize: 50,

    // 初始化日志系统
    async init() {
        if (!isMobile) return;

        this._initialized = true;
        this._buffer = [];

        // 写入启动日志
        this.info('=== 应用启动 ===');
        this.info('时间: ' + new Date().toLocaleString());

        // 监听页面卸载，确保日志写入
        window.addEventListener('beforeunload', () => {
            this.flush();
        });

        // 定期写入日志
        this._writeTimer = setInterval(() => {
            if (this._buffer.length > 0) {
                this.flush();
            }
        }, 5000);
    },

    // 添加日志条目
    _addEntry(level, message, data = null) {
        const entry = {
            time: new Date().toISOString(),
            level: level,
            message: message,
            data: data
        };

        this._buffer.push(entry);

        // 控制台也输出一份
        const consoleMsg = `[${level}] ${message}`;
        if (level === 'ERROR') {
            console.error(consoleMsg, data || '');
        } else if (level === 'WARN') {
            console.warn(consoleMsg, data || '');
        } else {
            console.log(consoleMsg, data || '');
        }

        // 缓冲区过大时立即写入
        if (this._buffer.length >= this._maxBufferSize) {
            this.flush();
        }
    },

    // 信息日志
    info(message, data = null) {
        this._addEntry('INFO', message, data);
    },

    // 警告日志
    warn(message, data = null) {
        this._addEntry('WARN', message, data);
    },

    // 错误日志
    error(message, data = null) {
        this._addEntry('ERROR', message, data);
    },

    // 调试日志
    debug(message, data = null) {
        this._addEntry('DEBUG', message, data);
    },

    // 将缓冲区日志写入文件
    async flush() {
        if (!isMobile || this._buffer.length === 0) return;

        try {
            // 格式化日志内容
            const logContent = this._buffer.map(entry => {
                let line = `[${entry.time}] [${entry.level}] ${entry.message}`;
                if (entry.data) {
                    try {
                        line += ' | ' + JSON.stringify(entry.data);
                    } catch (e) {
                        line += ' | [无法序列化]';
                    }
                }
                return line;
            }).join('\n') + '\n';

            // 清空缓冲区
            this._buffer = [];

            // 读取现有日志
            let existingLog = '';
            try {
                existingLog = await MobileAPI.readFile(this._logFile) || '';
            } catch (e) {
                // 文件不存在，忽略
            }

            // 追加新日志（保留最近5000行）
            const lines = (existingLog + logContent).split('\n');
            const trimmedLog = lines.slice(-5000).join('\n');

            // 写入文件
            await MobileAPI.saveFile(this._logFile, trimmedLog);
        } catch (e) {
            console.error('写入日志文件失败:', e);
        }
    },

    // 获取日志内容
    async getLogContent() {
        await this.flush();
        try {
            return await MobileAPI.readFile(this._logFile) || '暂无日志';
        } catch (e) {
            return '读取日志失败: ' + e.message;
        }
    },

    // 清空日志
    async clearLog() {
        this._buffer = [];
        try {
            await MobileAPI.saveFile(this._logFile, '');
            return true;
        } catch (e) {
            return false;
        }
    },

    // 导出日志（返回可分享的文本）
    async exportLog() {
        const content = await this.getLogContent();
        return `AI对话系统调试日志\n导出时间: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n${content}`;
    }
};

// 导出日志系统
window.MobileLogger = MobileLogger;

// 移动端 API 封装
const MobileAPI = {
    // 初始化移动端功能
    async init() {
        if (!isMobile) {
            console.log('运行在浏览器环境');
            return;
        }

        console.log('运行在移动端环境');

        // 初始化日志系统
        await MobileLogger.init();

        // 设置状态栏
        await this.setupStatusBar();

        // 隐藏启动画面
        await this.hideSplashScreen();

        // 设置键盘行为
        await this.setupKeyboard();

        // 监听应用生命周期
        this.setupAppListeners();

        MobileLogger.info('移动端初始化完成');
    },

    // 设置状态栏
    async setupStatusBar() {
        try {
            const { StatusBar, Style } = await import('@capacitor/status-bar');
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#1a1a1e' });
        } catch (e) {
            console.log('StatusBar 插件不可用');
        }
    },

    // 隐藏启动画面
    async hideSplashScreen() {
        try {
            const { SplashScreen } = await import('@capacitor/splash-screen');
            await SplashScreen.hide();
        } catch (e) {
            console.log('SplashScreen 插件不可用');
        }
    },

    // 设置键盘行为
    async setupKeyboard() {
        try {
            const { Keyboard } = await import('@capacitor/keyboard');

            // 键盘显示时调整布局
            Keyboard.addListener('keyboardWillShow', (info) => {
                document.body.style.paddingBottom = info.keyboardHeight + 'px';
                this.scrollToBottom();
            });

            // 键盘隐藏时恢复布局
            Keyboard.addListener('keyboardWillHide', () => {
                document.body.style.paddingBottom = '0px';
            });
        } catch (e) {
            console.log('Keyboard 插件不可用');
        }
    },

    // 监听应用生命周期
    setupAppListeners() {
        try {
            const { App } = require('@capacitor/app');

            // 应用恢复到前台
            App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    console.log('应用回到前台');
                }
            });

            // 返回按钮处理（Android）
            App.addListener('backButton', ({ canGoBack }) => {
                if (!canGoBack) {
                    App.exitApp();
                } else {
                    window.history.back();
                }
            });
        } catch (e) {
            console.log('App 插件不可用');
        }
    },

    // 滚动到底部
    scrollToBottom() {
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 100);
        }
    },

    // 使用相机拍照
    async takePicture() {
        try {
            const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Prompt // 让用户选择拍照或从相册选择
            });

            return image.dataUrl;
        } catch (e) {
            console.log('拍照取消或失败:', e);
            return null;
        }
    },

    // 从相册选择图片
    async pickImage() {
        try {
            const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Photos
            });

            return image.dataUrl;
        } catch (e) {
            console.log('选择图片取消或失败:', e);
            return null;
        }
    },

    // 分享内容
    async shareContent(title, text) {
        try {
            const { Share } = await import('@capacitor/share');

            await Share.share({
                title: title,
                text: text,
                dialogTitle: '分享对话'
            });
            return true;
        } catch (e) {
            console.log('分享取消或失败:', e);
            return false;
        }
    },

    // 保存文件到本地
    async saveFile(filename, data) {
        try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');

            await Filesystem.writeFile({
                path: filename,
                data: data,
                directory: Directory.Documents
            });
            return true;
        } catch (e) {
            console.log('保存文件失败:', e);
            return false;
        }
    },

    // 读取本地文件
    async readFile(filename) {
        try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');

            const result = await Filesystem.readFile({
                path: filename,
                directory: Directory.Documents
            });
            return result.data;
        } catch (e) {
            console.log('读取文件失败:', e);
            return null;
        }
    },

    // 发送本地通知
    async sendNotification(title, body) {
        try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');

            await LocalNotifications.requestPermissions();

            await LocalNotifications.schedule({
                notifications: [{
                    title: title,
                    body: body,
                    id: Date.now()
                }]
            });
            return true;
        } catch (e) {
            console.log('发送通知失败:', e);
            return false;
        }
    },

    // 触发震动反馈
    async vibrate(duration = 100) {
        try {
            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch (e) {
            // 静默失败
        }
    },

    // 获取设备信息
    async getDeviceInfo() {
        try {
            const { Device } = await import('@capacitor/device');
            return await Device.getInfo();
        } catch (e) {
            return { platform: 'web' };
        }
    },

    // === 日志相关方法 ===

    // 写入日志
    log(level, message, data = null) {
        if (MobileLogger._initialized) {
            MobileLogger._addEntry(level, message, data);
        }
    },

    // 获取日志内容
    async getLogContent() {
        return await MobileLogger.getLogContent();
    },

    // 导出日志
    async exportLog() {
        return await MobileLogger.exportLog();
    },

    // 清空日志
    async clearLog() {
        return await MobileLogger.clearLog();
    },

    // 分享日志
    async shareLog() {
        try {
            const logContent = await this.exportLog();
            await this.shareContent('AI对话系统日志', logContent);
            return true;
        } catch (e) {
            console.error('分享日志失败:', e);
            return false;
        }
    }
};

// 导出到全局
window.MobileAPI = MobileAPI;
window.isMobileApp = isMobile;
