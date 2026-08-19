const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

Menu.setApplicationMenu(null);

function createWindow () {
  const win = new BrowserWindow({
    width: 320,
    height: 390,
    minWidth: 280,
    minHeight: 340,
    resizable: true,
    frame: false,
    backgroundColor: '#FFFDF8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
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
