'use strict';
const path = require('path');
const { app, BrowserWindow, Menu, session } = require('electron');

const ROOT = path.join(__dirname, '..');
let mainWindow = null;
let guideWindow = null;

const webPreferences = { contextIsolation: true, nodeIntegration: false, sandbox: true };

function lockDown(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: '학교 3D 안내도 제작기',
    backgroundColor: '#f4f2ec',
    webPreferences
  });
  lockDown(mainWindow);
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadFile(path.join(ROOT, 'maker.html'));
}

function openGuide() {
  if (guideWindow) {
    guideWindow.focus();
    return;
  }
  guideWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    title: '사용 안내',
    backgroundColor: '#f4f2ec',
    webPreferences
  });
  guideWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  guideWindow.webContents.on('will-navigate', (event, url) => {
    const current = guideWindow.webContents.getURL().split('#')[0];
    if (url.split('#')[0] !== current) event.preventDefault();
  });
  guideWindow.on('closed', () => { guideWindow = null; });
  guideWindow.loadFile(path.join(ROOT, '사용안내.html'));
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: '파일', submenu: [{ role: 'quit', label: '끝내기' }] },
    {
      label: '편집',
      submenu: [
        { role: 'cut', label: '잘라내기' },
        { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        { role: 'selectAll', label: '모두 선택' }
      ]
    },
    {
      label: '보기',
      submenu: [
        { role: 'zoomIn', label: '화면 확대' },
        { role: 'zoomOut', label: '화면 축소' },
        { role: 'resetZoom', label: '원래 크기' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' }
      ]
    },
    { label: '도움말', submenu: [{ label: '사용 안내', accelerator: 'F1', click: openGuide }] }
  ]);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    Menu.setApplicationMenu(buildMenu());
    createMainWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
