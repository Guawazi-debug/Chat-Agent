const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// 主窗口引用
let mainWindow;

// 数据存储路径
const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'chat-data.json');
const imagesDir = path.join(userDataPath, 'images');
const iconPath = path.join(__dirname, 'icon.ico');
// 确保 images 目录存在
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

function createWindow() {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        titleBarStyle: 'default',
        show: false
    });

    // 加载 index.html
    mainWindow.loadFile('index.html');

    // 窗口准备好后显示（避免白屏）
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // 打开开发者工具（调试用，发布时注释掉）
    // mainWindow.webContents.openDevTools();

    // 窗口关闭事件
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 创建菜单
    createMenu();
}

// 创建应用菜单
function createMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '新建对话',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-new-chat');
                    }
                },
                { type: 'separator' },
                {
                    label: '退出',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
            ]
        },
        {
            label: '视图',
            submenu: [
                { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
                { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
                { label: '放大', accelerator: 'CmdOrCtrl+Shift+=', role: 'zoomIn' },
                { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { type: 'separator' },
                { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: '关于 AI 对话系统',
                            message: 'AI 对话系统 - 多模型集成',
                            detail: '版本: 1.0.0\n支持 MiMo、DeepSeek、GPT 等多个AI模型\n\n© 2026 AI Chat Team'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: '数据目录',
                    click: () => {
                        shell.openPath(userDataPath);
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// 应用准备就绪
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC 通信：保存数据
ipcMain.handle('save-data', async (event, data) => {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('保存数据失败:', error);
        return { success: false, error: error.message };
    }
});

// IPC 通信：加载数据
ipcMain.handle('load-data', async () => {
    try {
        if (fs.existsSync(dataFilePath)) {
            const data = fs.readFileSync(dataFilePath, 'utf-8');
            return { success: true, data: JSON.parse(data) };
        }
        return { success: true, data: null };
    } catch (error) {
        console.error('加载数据失败:', error);
        return { success: false, error: error.message };
    }
});

// IPC 通信：导出数据
ipcMain.handle('export-data', async (event, data) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: '导出数据',
            defaultPath: `ai-chat-export-${Date.now()}.json`,
            filters: [
                { name: 'JSON 文件', extensions: ['json'] },
                { name: '所有文件', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
            return { success: true, filePath: result.filePath };
        }
        return { success: false, canceled: true };
    } catch (error) {
        console.error('导出数据失败:', error);
        return { success: false, error: error.message };
    }
});

// IPC 通信：导入数据
ipcMain.handle('import-data', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: '导入数据',
            filters: [
                { name: 'JSON 文件', extensions: ['json'] },
                { name: '所有文件', extensions: ['*'] }
            ],
            properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const data = fs.readFileSync(result.filePaths[0], 'utf-8');
            return { success: true, data: JSON.parse(data) };
        }
        return { success: false, canceled: true };
    } catch (error) {
        console.error('导入数据失败:', error);
        return { success: false, error: error.message };
    }
});

// IPC 通信：显示消息框
ipcMain.handle('show-message', async (event, options) => {
    return await dialog.showMessageBox(mainWindow, options);
});

// IPC 通信：显示确认框
ipcMain.handle('show-confirm', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['确定', '取消'],
        defaultId: 0,
        cancelId: 1,
        ...options
    });
    return result.response === 0;
});

// IPC 通信：选择目录
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] };
    }
    return { success: false };
});

// IPC 通信：获取数据路径
ipcMain.handle('get-data-path', async () => {
    return userDataPath;
});

// IPC 通信：获取应用根目录路径
ipcMain.handle('get-app-path', async () => {
    return __dirname;
});

// IPC 通信：保存生成的图片
ipcMain.handle('save-image', async (event, id, dataUrl) => {
    try {
        const filePath = path.join(imagesDir, `${id}.png`);
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(filePath, base64Data, 'base64');
        return { success: true };
    } catch (error) {
        console.error('保存图片失败:', error);
        return { success: false, error: error.message };
    }
});

// IPC 通信：加载单张图片
ipcMain.handle('load-image', async (event, id) => {
    try {
        const filePath = path.join(imagesDir, `${id}.png`);
        if (!fs.existsSync(filePath)) return { success: true, data: null };
        const base64 = fs.readFileSync(filePath, 'base64');
        return { success: true, data: `data:image/png;base64,${base64}` };
    } catch (error) {
        console.error('加载图片失败:', error);
        return { success: false, error: error.message };
    }
});

// IPC 通信：批量加载图片
ipcMain.handle('load-all-images', async (event, ids) => {
    try {
        const result = {};
        for (const id of ids) {
            const filePath = path.join(imagesDir, `${id}.png`);
            if (fs.existsSync(filePath)) {
                result[id] = `data:image/png;base64,${fs.readFileSync(filePath, 'base64')}`;
            }
        }
        return { success: true, data: result };
    } catch (error) {
        console.error('批量加载图片失败:', error);
        return { success: false, error: error.message };
    }
});
