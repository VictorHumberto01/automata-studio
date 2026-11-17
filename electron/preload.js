const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  openFile: () => ipcRenderer.invoke("file:open"),
  saveFile: (opts) => ipcRenderer.invoke("file:save", opts),
  setTheme: (opts) => ipcRenderer.invoke("theme:set", opts),
  onMenu: (cb) => {
    const listener = (_e, channel) => cb(channel);
    ipcRenderer.on("menu", listener);
    return () => ipcRenderer.removeListener("menu", listener);
  },
});
