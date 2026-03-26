'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion:         ()           => ipcRenderer.invoke('get-version'),
  loadData:           ()           => ipcRenderer.invoke('load-data'),
  saveData:           (data)       => ipcRenderer.invoke('save-data', data),
  openReleasePage:    (url)        => ipcRenderer.send('open-releases', url),
  onUpdateStatus:     (callback)   => ipcRenderer.on('update-status',    (_, info) => callback(info)),
  downloadUpdate:     (url)        => ipcRenderer.invoke('download-update', url),
  launchUpdate:       (localPath)  => ipcRenderer.send('launch-update', localPath),
  onDownloadProgress: (callback)   => ipcRenderer.on('download-progress', (_, pct) => callback(pct)),
  appleCalSync:       (ev)         => ipcRenderer.invoke('apple-cal-sync', ev),
  appleCalRemove:     (uid)        => ipcRenderer.invoke('apple-cal-remove', uid),
  printToPDF:         (filename)   => ipcRenderer.invoke('print-to-pdf', filename),
});
