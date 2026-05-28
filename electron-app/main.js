const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const baseUserDataPath = app.getPath('userData');
const storageSettingsPath = path.join(baseUserDataPath, 'storage-settings.json');
const iconPath = path.join(__dirname, 'icon.ico');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function readStorageSettings() {
    try {
        if (!fs.existsSync(storageSettingsPath)) {
            return {};
        }
        const raw = fs.readFileSync(storageSettingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return typeof parsed.customPath === 'string' ? { customPath: path.resolve(parsed.customPath) } : {};
    } catch (error) {
        console.error('读取存储配置失败:', error);
        return {};
    }
}

function writeStorageSettings(settings) {
    try {
        ensureDir(baseUserDataPath);
        fs.writeFileSync(storageSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (error) {
        console.error('写入存储配置失败:', error);
    }
}

function getEffectiveDataRoot() {
    const settings = readStorageSettings();
    return settings.customPath || baseUserDataPath;
}

function getDataFilePath(rootPath = getEffectiveDataRoot()) {
    return path.join(rootPath, 'chat-data.json');
}

function getImagesDir(rootPath = getEffectiveDataRoot()) {
    return path.join(rootPath, 'images');
}

function ensureStorageRoot(rootPath = getEffectiveDataRoot()) {
    ensureDir(rootPath);
    ensureDir(getImagesDir(rootPath));
}

function copyFileIfExists(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) {
        return;
    }
    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectoryContents(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
        return;
    }
    ensureDir(targetDir);
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        // 跳过符号链接，防止循环引用
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
            copyDirectoryContents(sourcePath, targetPath);
        } else {
            ensureDir(path.dirname(targetPath));
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function clearDirectoryContents(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return;
    }
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const targetPath = path.join(dirPath, entry.name);
        fs.rmSync(targetPath, { recursive: true, force: true });
    }
}

function migrateStorage(sourceRoot, targetRoot) {
    const normalizedSource = path.resolve(sourceRoot);
    const normalizedTarget = path.resolve(targetRoot);
    if (normalizedSource === normalizedTarget) {
        return;
    }

    ensureStorageRoot(normalizedSource);
    ensureStorageRoot(normalizedTarget);
    copyFileIfExists(getDataFilePath(normalizedSource), getDataFilePath(normalizedTarget));
    copyDirectoryContents(getImagesDir(normalizedSource), getImagesDir(normalizedTarget));
}

function hasExistingStorageData(rootPath) {
    const dataFilePath = getDataFilePath(rootPath);
    const imagesDir = getImagesDir(rootPath);

    const hasDataFile = fs.existsSync(dataFilePath) && fs.statSync(dataFilePath).size > 2;
    const hasImages = fs.existsSync(imagesDir) && fs.readdirSync(imagesDir).length > 0;

    return hasDataFile || hasImages;
}

function createWindow() {
    ensureStorageRoot();

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        },
        titleBarStyle: 'default',
        show: false
    });

    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 安全：限制导航和新窗口，防止渲染进程被劫持
    mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    createMenu();
}

function createMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '新建对话',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow.webContents.send('menu-new-chat')
                },
                { type: 'separator' },
                {
                    label: '退出',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
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
                            detail: '版本: 1.0.0\n支持 MiMo、DeepSeek、GPT 等多种 AI 模型\n\n© 2026 AI Chat Team'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: '数据目录',
                    click: () => {
                        shell.openPath(getEffectiveDataRoot());
                    }
                }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('save-data', async (event, data) => {
    try {
        ensureStorageRoot();
        fs.writeFileSync(getDataFilePath(), JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('保存数据失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-data', async () => {
    try {
        ensureStorageRoot();
        const dataFilePath = getDataFilePath();
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
            const filePath = result.filePaths[0];
            const stats = fs.statSync(filePath);
            if (stats.size > 50 * 1024 * 1024) {
                return { success: false, error: '文件过大（超过50MB）' };
            }
            const data = fs.readFileSync(filePath, 'utf-8');
            return { success: true, data: JSON.parse(data) };
        }
        return { success: false, canceled: true };
    } catch (error) {
        console.error('导入数据失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('show-message', async (event, options) => {
    return dialog.showMessageBox(mainWindow, options);
});

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

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] };
    }
    return { success: false };
});

ipcMain.handle('set-data-path', async (event, targetPath) => {
    try {
        if (!targetPath) {
            throw new Error('目标目录不能为空');
        }
        const normalizedTargetPath = path.resolve(targetPath);
        const currentRoot = getEffectiveDataRoot();
        if (normalizedTargetPath !== currentRoot && hasExistingStorageData(normalizedTargetPath)) {
            throw new Error('目标目录已有聊天数据或图片，请先清空目标目录后再切换');
        }
        migrateStorage(currentRoot, normalizedTargetPath);
        writeStorageSettings({ customPath: normalizedTargetPath });
        ensureStorageRoot(normalizedTargetPath);
        return { success: true, path: normalizedTargetPath };
    } catch (error) {
        console.error('设置数据目录失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-data', async () => {
    try {
        ensureStorageRoot();
        fs.writeFileSync(getDataFilePath(), JSON.stringify({}, null, 2), 'utf-8');
        clearDirectoryContents(getImagesDir());
        return { success: true };
    } catch (error) {
        console.error('清除数据失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-images', async () => {
    try {
        ensureStorageRoot();
        clearDirectoryContents(getImagesDir());
        return { success: true };
    } catch (error) {
        console.error('清除图片失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-data-path', async () => {
    return getEffectiveDataRoot();
});

ipcMain.handle('get-app-path', async () => {
    return __dirname;
});

ipcMain.handle('save-image', async (event, id, dataUrl) => {
    try {
        // 校验 id 参数，防止路径遍历攻击
        if (!id || !/^[\w\-]+$/.test(id)) {
            return { success: false, error: '无效的图片 ID' };
        }
        ensureStorageRoot();
        const filePath = path.join(getImagesDir(), `${id}.png`);
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(filePath, base64Data, 'base64');
        return { success: true };
    } catch (error) {
        console.error('保存图片失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-image', async (event, id) => {
    try {
        ensureStorageRoot();
        const filePath = path.join(getImagesDir(), `${id}.png`);
        if (!fs.existsSync(filePath)) {
            return { success: true, data: null };
        }
        const base64 = fs.readFileSync(filePath, 'base64');
        return { success: true, data: `data:image/png;base64,${base64}` };
    } catch (error) {
        console.error('加载图片失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-all-images', async (event, ids) => {
    try {
        ensureStorageRoot();
        const result = {};
        for (const id of ids) {
            const filePath = path.join(getImagesDir(), `${id}.png`);
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
