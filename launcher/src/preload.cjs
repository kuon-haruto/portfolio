const { contextBridge, ipcRenderer } = require('electron');
const call = channel => (...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('library', {
  snapshot: call('library:snapshot'), install: call('library:install'), launch: call('library:launch'),
  cancel: call('library:cancel'), check: call('library:check'), folder: call('library:folder'),
  checkApp: call('app:check'), downloadApp: call('app:download'), restartApp: call('app:restart'),
  subscribe: callback => { const listener = () => callback(); ipcRenderer.on('library:changed', listener); return () => ipcRenderer.removeListener('library:changed', listener); },
});
