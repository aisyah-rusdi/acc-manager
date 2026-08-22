const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

Menu.setApplicationMenu(null);

function createWindow () {
  const win = new BrowserWindow({
    width: 306,
    height: 300,
    minWidth: 306,
    minHeight: 300,
    resizable: true,
    frame: false,
    backgroundColor: '#FFFDF8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize-toggle', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', () => win.close());
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
