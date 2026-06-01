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

    // 获取 Capacitor 插件（安全访问）
    _getPlugin(name) {
        try {
            return window.Capacitor?.Plugins?.[name] || null;
        } catch (e) {
            return null;
        }
    },

    // 设置状态栏
    async setupStatusBar() {
        try {
            const StatusBar = this._getPlugin('StatusBar');
            if (StatusBar) {
                await StatusBar.setStyle({ style: 'DARK' });
                await StatusBar.setBackgroundColor({ color: '#1a1a1e' });
            }
        } catch (e) {
            console.log('StatusBar 插件不可用');
        }
    },

    // 隐藏启动画面
    async hideSplashScreen() {
        try {
            const SplashScreen = this._getPlugin('SplashScreen');
            if (SplashScreen) {
                await SplashScreen.hide();
            }
        } catch (e) {
            console.log('SplashScreen 插件不可用');
        }
    },

    // 设置键盘行为
    async setupKeyboard() {
        try {
            const Keyboard = this._getPlugin('Keyboard');
            if (Keyboard) {
                Keyboard.addListener('keyboardWillShow', () => {
                    setTimeout(() => this.scrollToBottom(), 150);
                });
                Keyboard.addListener('keyboardWillHide', () => {
                    setTimeout(() => this.scrollToBottom(), 150);
                });
            }
        } catch (e) {
            console.log('Keyboard 插件不可用');
        }
    },

    // 监听应用生命周期
    async setupAppListeners() {
        try {
            const App = this._getPlugin('App');
            if (!App) return;

            App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    console.log('应用回到前台');
                }
            });

            App.addListener('backButton', ({ canGoBack }) => {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    closeModal(activeModal.id);
                    return;
                }
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    const overlay = document.querySelector('.sidebar-overlay');
                    if (overlay) overlay.classList.remove('active');
                    return;
                }
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

    // 使用相机拍照或从相册选择
    async takePicture() {
        try {
            const Camera = this._getPlugin('Camera');
            if (!Camera) {
                console.error('[Camera] Camera插件未注册');
                if (window.showToast) window.showToast('相机插件不可用', 'error');
                return null;
            }

            const result = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: 'dataUrl',
                source: 'PROMPT'
            });

            return result.dataUrl;
        } catch (e) {
            if (e.message && (e.message.includes('cancel') || e.message.includes('User'))) return null;
            console.error('[Camera] 选择图片失败:', e.message || e);
            if (window.showToast) {
                window.showToast('图片选择失败: ' + (e.message || '未知错误'), 'error');
            }
            return null;
        }
    },

    // 从相册选择图片
    async pickImage() {
        try {
            const Camera = this._getPlugin('Camera');
            if (!Camera) return null;

            const result = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: 'dataUrl',
                source: 'PHOTOS'
            });

            return result.dataUrl;
        } catch (e) {
            if (e.message && (e.message.includes('cancel') || e.message.includes('User'))) return null;
            console.error('[Camera] 从相册选择失败:', e.message || e);
            return null;
        }
    },

    // 分享内容
    async shareContent(title, text) {
        try {
            const Share = this._getPlugin('Share');
            if (!Share) return false;

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

    // 保存文件到本地（使用应用私有存储）
    async saveFile(filename, data) {
        try {
            const Filesystem = this._getPlugin('Filesystem');
            if (!Filesystem) {
                console.error('[Filesystem] 插件未注册');
                return false;
            }

            console.log('[Filesystem] 保存文件:', filename);

            // 创建目录
            const lastSlashIndex = filename.lastIndexOf('/');
            if (lastSlashIndex > 0) {
                const dirPath = filename.slice(0, lastSlashIndex);
                try {
                    await Filesystem.mkdir({ path: dirPath, directory: 'DATA', recursive: true });
                } catch (e) {
                    // 目录可能已存在
                }
            }

            // 图片等二进制数据不使用encoding参数
            const isImage = filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg');
            const writeOptions = {
                path: filename,
                data: data,
                directory: 'DATA',
                recursive: true
            };
            if (!isImage) {
                writeOptions.encoding = 'UTF8';
            }

            await Filesystem.writeFile(writeOptions);
            console.log('[Filesystem] 文件保存成功:', filename);
            return true;
        } catch (e) {
            console.error('[Filesystem] 保存文件失败:', filename, e.message || e);
            return false;
        }
    },

    // 读取本地文件
    async readFile(filename, strict = false) {
        try {
            const Filesystem = this._getPlugin('Filesystem');
            if (!Filesystem) {
                console.error('[Filesystem] 插件未注册');
                return null;
            }

            console.log('[Filesystem] 读取文件:', filename);

            const isImage = filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg');
            const readOptions = {
                path: filename,
                directory: 'DATA'
            };
            if (!isImage) {
                readOptions.encoding = 'UTF8';
            }

            const result = await Filesystem.readFile(readOptions);
            console.log('[Filesystem] 文件读取成功:', filename);
            return result.data;
        } catch (e) {
            const message = (e?.message || '').toLowerCase();
            const missingFile = message.includes('not exist') || message.includes('no such file') || message.includes('cannot find');
            if (missingFile) {
                console.log('[Filesystem] 文件不存在:', filename);
                return null;
            }
            console.error('[Filesystem] 读取文件失败:', filename, e.message || e);
            if (strict) throw e;
            return null;
        }
    },

    // 删除文件
    async deleteFile(filename) {
        try {
            const Filesystem = this._getPlugin('Filesystem');
            if (!Filesystem) return false;

            await Filesystem.deleteFile({ path: filename, directory: 'DATA' });
            return true;
        } catch (e) {
            console.error('删除文件失败:', filename, e);
            return false;
        }
    },

    // 删除目录
    async removeDirectory(dirName) {
        try {
            const Filesystem = this._getPlugin('Filesystem');
            if (!Filesystem) return false;

            await Filesystem.rmdir({ path: dirName, directory: 'DATA', recursive: true });
            return true;
        } catch (e) {
            console.error('删除目录失败:', dirName, e);
            return false;
        }
    },

    async sendNotification(title, body) {
        try {
            const LocalNotifications = this._getPlugin('LocalNotifications');
            if (!LocalNotifications) return false;

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
            const Haptics = this._getPlugin('Haptics');
            if (Haptics) {
                await Haptics.impact({ style: 'LIGHT' });
            }
        } catch (e) {
            // 静默失败
        }
    },

    // 获取设备信息
    async getDeviceInfo() {
        try {
            const Device = this._getPlugin('Device');
            if (Device) {
                return await Device.getInfo();
            }
            return { platform: 'web' };
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
