const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 数据存储
    saveData: (data) => ipcRenderer.invoke('save-data', data),
    loadData: () => ipcRenderer.invoke('load-data'),

    // 数据导入导出
    exportData: (data) => ipcRenderer.invoke('export-data', data),
    importData: () => ipcRenderer.invoke('import-data'),

    // 对话框
    showMessage: (options) => ipcRenderer.invoke('show-message', options),
    showConfirm: (options) => ipcRenderer.invoke('show-confirm', options),

    // 目录操作
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    getDataPath: () => ipcRenderer.invoke('get-data-path'),

    // 图片存储
    saveImage: (id, dataUrl) => ipcRenderer.invoke('save-image', id, dataUrl),
    loadImage: (id) => ipcRenderer.invoke('load-image', id),
    loadAllImages: (ids) => ipcRenderer.invoke('load-all-images', ids),

    // 菜单事件监听
    onMenuNewChat: (callback) => {
        ipcRenderer.on('menu-new-chat', callback);
        return () => {
            ipcRenderer.removeListener('menu-new-chat', callback);
        };
    },

    // 应用路径
    getAppPath: () => ipcRenderer.invoke('get-app-path'),

    // 平台信息
    platform: process.platform,

    // 版本信息
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
    }
});
