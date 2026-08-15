const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const updateService = require('./updateService.cjs');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

function isDev() {
  return !app.isPackaged;
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    alwaysOnTop: false,
    hasShadow: true,
    title: 'Rusty',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  if (isDev()) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load app:', errorCode, errorDescription);
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<h1 style="font-family:sans-serif;padding:24px;color:#fff;background:#04070b;">Rusty no pudo cargar la interfaz.</h1><p style="padding:24px;color:#93adbd;">Revisa si el build de Vite está presente en dist/.</p>')}`);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('Renderer finished loading');
  });
}

ipcMain.handle('window:minimize', () => {
  if (win) win.minimize();
  return true;
});

ipcMain.handle('window:close', () => {
  app.quit();
  return true;
});

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('update:checkForUpdate', async (_, { owner, repo, fallbackJsonUrl }) => {
  const isGitHubConfigured =
    owner &&
    owner !== 'GITHUB_OWNER' &&
    repo &&
    repo !== 'GITHUB_REPO';

  if (!isGitHubConfigured && !fallbackJsonUrl) {
    return null;
  }

  const release = await updateService.getLatestRelease(owner, repo, fallbackJsonUrl);
  return {
    latestVersion: release.latestVersion,
    body: release.body,
    publishedAt: release.publishedAt,
    downloadUrl: release.downloadUrl,
    checksumUrl: release.checksumUrl,
    tagName: release.tagName,
  };
});

ipcMain.handle('update:download', async (_, { downloadUrl, checksumUrl }) => {
  if (!downloadUrl) {
    throw new Error('Download URL is required');
  }

  const tempDir = app.getPath('temp');
  const fileName = path.basename(new URL(downloadUrl).pathname);
  const filePath = path.join(tempDir, `${Date.now()}-${fileName}`);

  let lastTime = Date.now();
  let lastBytes = 0;

  await updateService.downloadFile(downloadUrl, filePath, ({ bytesReceived, bytesTotal }) => {
    const now = Date.now();
    const elapsed = now - lastTime;
    const deltaBytes = bytesReceived - lastBytes;
    lastTime = now;
    lastBytes = bytesReceived;

    const speed = elapsed > 0 ? (deltaBytes * 1000) / elapsed : 0;
    const percent = bytesTotal > 0 ? bytesReceived / bytesTotal : 0;
    const timeRemaining = speed > 0 && bytesTotal > 0 ? Math.round((bytesTotal - bytesReceived) / speed) : 0;

    if (win && win.webContents) {
      win.webContents.send('update-download-progress', {
        percent,
        bytesReceived,
        bytesTotal,
        speed,
        timeRemaining,
      });
    }
  });

  if (checksumUrl) {
    const expectedChecksum = await updateService.downloadReleaseChecksum(checksumUrl);
    const actualChecksum = await updateService.computeSha256(filePath);
    if (expectedChecksum !== actualChecksum) {
      throw new Error('Checksum mismatch: el archivo descargado no coincide con el checksum esperado.');
    }
  }

  return { downloadedFilePath: filePath };
});

ipcMain.handle('update:install', async (_, { filePath }) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('No update file found for installation');
  }

  const openResult = await shell.openPath(filePath);
  if (openResult) {
    throw new Error(`Unable to launch installer: ${openResult}`);
  }

  app.quit();
  return { launched: true };
});

ipcMain.handle('update:selectBinary', async () => {
  return dialog.showOpenDialog({
    title: 'Seleccionar binario de release',
    properties: ['openFile'],
    filters: [
      { name: 'Electron builds', extensions: ['exe', 'msi', 'zip'] },
      { name: 'Todos los archivos', extensions: ['*'] },
    ],
  });
});

ipcMain.handle('update:publishRelease', async (_, payload) => {
  return updateService.publishGithubRelease(payload);
});

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
