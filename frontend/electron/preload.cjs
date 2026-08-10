const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeApp: () => ipcRenderer.invoke('window:close'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdate: (options) => ipcRenderer.invoke('update:checkForUpdate', options),
  downloadUpdate: (options) => ipcRenderer.invoke('update:download', options),
  installUpdate: (options) => ipcRenderer.invoke('update:install', options),
  selectReleaseBinary: () => ipcRenderer.invoke('update:selectBinary'),
  publishRelease: (options) => ipcRenderer.invoke('update:publishRelease', options),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', callback),
  removeUpdateProgress: (callback) => ipcRenderer.removeListener('update-download-progress', callback),
});
