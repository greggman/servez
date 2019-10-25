"use strict";

const isOSX = process.platform === 'darwin';
const isDevMode = process.env.NODE_ENV === 'development';

const electron = require('electron');
const webContents = electron.webContents;
const ipcMain = electron.ipcMain;
const express = require('express');
const cors = require('cors');
const serveIndex = require('serve-index');
const path = require('path');
const fs = require('fs');
const enableDestroy = require('server-destroy');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
let mainWindow = null;
let mainWebContents = null;
let expressApp = null;
let server = null;
let running = false;
let restart = false;

const dataDir = app.getPath("userData");
const settingsPath = path.join(dataDir, "config.json");
const defaultSettings = {
  port: 8080,
  root: app.getPath("home"),
  local: false,
  cors: true,
  dirs: true,
  index: true,
};
let settings;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, {encoding: 'utf8'}));
  const keys = Object.keys(defaultSettings).sort();
  if (!compareArrays(keys, Object.keys(settings).sort())) {
    throw new Error("bad settings");
  }
  keys.forEach(key => {
    const atype = typeof defaultSettings[key];
    const btype = typeof settings[key];
    if (atype !== btype) {
      throw new Error(`${key} of wrong type. Expected ${atype}, was ${btype}`);
    }
  });
} catch (e) {
  settings = Object.assign({}, defaultSettings);
}

function compareArrays(a, b) {
  if (!a) {
    return (!b);
  } else if (!b) {
    return false
  }

  const len = a.length;
  if (len !== b.length) {
    return false;
  }

  for (var i = 0; i < len; ++i) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

const staticOptions = {
  fallthrough: true,
  setHeaders: setHeaders,
};

const debug = process.env.SERVEZ_ECHO ? logToWindow : require('debug')('main');

function setHeaders(res /*, path, stat */) {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate', // HTTP 1.1.
    'Pragma':        'no-cache',                            // HTTP 1.0.
    'Expires':       '0',                                   // Proxies.
  });
}

function createWindow() {
  const {width: screenWidth, height: screenHeight} = electron.screen.getPrimaryDisplay().workAreaSize;
  const space = 50;
  const x = space;
  const y = space;
  const width = screenWidth - space * 2;
  const height = screenHeight - space * 2;

  mainWindow = new BrowserWindow({
    webPreferences: {
        nodeIntegration: true
    },
    defaultEncoding: "utf8",
  });

  mainWindow.loadURL(`file://${__dirname}/src/index.html`);
  if (isDevMode) {
    mainWindow.webContents.openDevTools();
  }

  // open links in browser
  mainWebContents = mainWindow.webContents;
  const handleRedirect = (e, url) => {
    if(url != mainWebContents.getURL()) {
      e.preventDefault();
      electron.shell.openExternal(url);
    }
  };

  mainWebContents.on('will-navigate', handleRedirect);
  mainWebContents.on('new-window', handleRedirect);
}

function sendToWindow(...args) {
  if (mainWebContents) {
    mainWebContents.send(...args);
  }
}

function serverClosed() {
  debug("serverClosed");
  server = null;
  expressApp = null;
  running = false;
  sendToWindow('stopped');
  debug("restart:", restart);
  if (restart) {
    restart = false;
    debug("startServer-restart");
    startServer();
  }
}

function localErrorHandler(err, req, res, next) {
  debug(`ERROR: ${req.method} ${req.url} ${err}`);
  errorToWindow(`ERROR: ${req.method} ${req.url} ${err}`);
  res.status(500).send(`<pre>${err}</pre>`);
}

function nonErrorLocalErrorHandler(req, res, next) {
  debug(`ERROR: ${req.method} ${req.url} 404`);
  errorToWindow(`ERROR: ${req.method} ${req.url}`);
  res.status(404).send(`<pre>ERROR 404: No such path ${req.path}</pre>`);
}

function startServer() {
  debug("startServer");
  debug("running:", running);
  if (running) {
    restart = true;
    stopServer();
    return;
  }
  debug("really start");
  const root = settings.root;
  const port = settings.port;
  const local = settings.local;
  const hostname = local ? "127.0.0.1" : undefined;
  expressApp = express()
  if (settings.cors) {
    expressApp.use(cors());
  }
  expressApp.use((req, res, next) => {
    logToWindow(req.method, req.originalUrl);
    next();
  });
  staticOptions.index = settings.index ? "index.html" : false;
  expressApp.use(express.static(root, staticOptions));
  if (settings.dirs) {
    expressApp.use(serveIndex(root, {
      icons: true,
      stylesheet: path.join(__dirname, "src", "listing.css"),
    }));
  }
  expressApp.use(nonErrorLocalErrorHandler);
  expressApp.use(localErrorHandler);
  try {
    debug("starting server");
    server = expressApp.listen(port, hostname);
    enableDestroy(server);
    server.on('error', (e) => {
       errorToWindow("ERROR:", e.message);
    });
    server.on('listening', () => {
      running = true;
      saveSettings();
      sendToWindow('started');
      logToWindow("server started on port:", local ? "127.0.0.1:" : "::", port, "for path:", root);
    });
    server.on('close', serverClosed);
  } catch (e) {
    debug("error starting server");
    errorToWindow("ERROR:", e, e.message, e.stack);
  }
}

function stopServer() {
  debug("stopServer");
  debug("running:", running);
  debug("server:", server);
  if (running && server) {
    debug("stopServer really");
    //server.close();
    server.destroy();
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    errorToWindow('ERROR: could not save settings:', e);
  }
}

function updateSettings(event, newSettings) {
  Object.assign(settings, newSettings);
  if (running) {
    startServer();
  }
}

function getSettings(event) {
  event.sender.send('settings', settings);
  event.sender.send((running && server) ? 'started' : 'stopped');
}

function launch(event) {
  const url = "http://localhost:" + settings.port;
  electron.shell.openExternal(url);
}

function logToWindow(...args) {
  sendToWindow('log', ...args);
}

function errorToWindow(...args) {
  sendToWindow('error', ...args);
}

function setupServer() {
}

function setupIPC() {
  ipcMain.on('start', startServer);
  ipcMain.on('stop', stopServer);
  ipcMain.on('updateSettings', updateSettings);
  ipcMain.on('getSettings', getSettings);
  ipcMain.on('launch', launch);
}

function startIfReady() {
  setupServer();
  setupIPC();
  setupMenus();
  createWindow();
}

app.on('ready', () => {
  startIfReady();
});

app.on('window-all-closed', () => {
  mainWebContents = null;
  if (running && server) {
    //server.close();
    server.destroy();
  }
  app.quit();
});

function setupMenus() {
  const menuTemplate = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: isOSX ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click(item, focusedWindow) {
            if (focusedWindow)
              focusedWindow.webContents.toggleDevTools();
          }
        },
      ]
    },
  ];


  if (isOSX) {
    const name = electron.app.name;
    menuTemplate.unshift({
      label: name,
      submenu: [
        {
          label: 'About ' + name,
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click() { app.quit(); }
        },
      ]
    });
  }

  const menu = electron.Menu.buildFromTemplate(menuTemplate);
  electron.Menu.setApplicationMenu(menu);
}

