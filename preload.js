'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData:       ()         => ipcRenderer.invoke('load-data'),
  saveData:       (data)     => ipcRenderer.invoke('save-data', data),
  openReleasePage: (url)      => ipcRenderer.send('open-releases', url),
  onUpdateStatus:  (callback) => ipcRenderer.on('update-status', (_, info) => callback(info)),
});
