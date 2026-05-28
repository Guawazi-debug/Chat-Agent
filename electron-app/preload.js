const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveData: (data) => ipcRenderer.invoke('save-data', data),
    loadData: () => ipcRenderer.invoke('load-data'),

    exportData: (data) => ipcRenderer.invoke('export-data', data),
    importData: () => ipcRenderer.invoke('import-data'),

    showMessage: (options) => ipcRenderer.invoke('show-message', options),
    showConfirm: (options) => ipcRenderer.invoke('show-confirm', options),

    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    setDataPath: (targetPath) => ipcRenderer.invoke('set-data-path', targetPath),
    clearData: () => ipcRenderer.invoke('clear-data'),
    clearImages: () => ipcRenderer.invoke('clear-images'),
    getDataPath: () => ipcRenderer.invoke('get-data-path'),

    saveImage: (id, dataUrl) => ipcRenderer.invoke('save-image', id, dataUrl),
    loadImage: (id) => ipcRenderer.invoke('load-image', id),
    loadAllImages: (ids) => ipcRenderer.invoke('load-all-images', ids),

    onMenuNewChat: (callback) => {
        ipcRenderer.on('menu-new-chat', callback);
        return () => {
            ipcRenderer.removeListener('menu-new-chat', callback);
        };
    },

    getAppPath: () => ipcRenderer.invoke('get-app-path'),

    platform: process.platform,

    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
    }
});
