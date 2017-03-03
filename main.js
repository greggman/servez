"use strict";

const isOSX = process.platform === 'darwin';
const isDevMode = process.env.NODE_ENV === 'development';

const electron = require('electron');
const webContents = electron.webContents;
const ipcMain = electron.ipcMain;
const express = require('express');
const serveIndex = require('serve-index');
const path = require('path');
const fs = require('fs');
const debug = require('debug')('main');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
let mainWindow = null;
let mainWebContents = null;
let expressApp = null;
let server = null;
let running = false;
let restart = false;
const settings = {
  port: 8080,
  root: app.getPath("home"),
  local: false,
  cors: true,
  dirs: true,
  index: true,
};
const staticOptions = {
  fallthrough: true,
  setHeaders: setHeaders,
};

function log(...args) {
  logToWindow(...args);
}

function setHeaders(res /*, path, stat */) {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate', // HTTP 1.1.
    'Pragma':        'no-cache',                            // HTTP 1.0.
    'Expires':       '0',                                   // Proxies.
  });
}

function handleOPTIONS(req, res) {
  res.removeHeader('Content-Type');
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept',
    'Access-Control-Allow-Credentials': false,
    'Access-Control-Max-Age': 86400,
  });
  res.end('{}');
}

function createWindow() {
  const {width: screenWidth, height: screenHeight} = electron.screen.getPrimaryDisplay().workAreaSize;
  const space = 50;
  const x = space;
  const y = space;
  const width = screenWidth - space * 2;
  const height = screenHeight - space * 2;

  mainWindow = new BrowserWindow({
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
  log("serverClosed")
  server = null;
  expressApp = null;
  running = false;
  sendToWindow('stopped');
  log("restart:", restart);
  if (restart) {
    restart = false;
    log("startServer-restart");
    startServer();
  }
}

function startServer() {
  log("startServer");
  log("running:", running);
  if (running) {
    restart = true;
    stopServer();
    return;
  }
  log("really start");
  const root = settings.root;
  const port = settings.port;
  const local = settings.local;
  const hostname = local ? "127.0.0.1" : undefined;
  expressApp = express();
  if (settings.index) {
    expressApp.use((req, res, next) => {
      const base = path.join(root, req.path);
      log("checking:", base);
      if (fs.existsSync(base)) {
        log("stat:", base);
        const stat = fs.statSync(base);
        if (stat.isDirectory()) {
          const index = path.join(base, "index.html");
          log("check:", index);
          if (fs.existsSync(index)) {
            log("send:", index);
            res.sendFile(index);
            return;
          }
        }
      }
      next();
    });
  }
  if (settings.dirs) {
    expressApp.use(serveIndex(root, {
      icons: true,
      stylesheet: path.join(__dirname, "src", "listing.css"),
    }));
  }
  expressApp.use(express.static(root, staticOptions));
  expressApp.options(/.*/, handleOPTIONS);
  try {
    logToWindow("starting server");
    server = expressApp.listen(port, hostname);
    server.on('error', (e) => {
       errorToWindow("ERROR:", e.message);
    });
    server.on('listening', () => {
      running = true;
      sendToWindow('started');
      logToWindow("started server on port:", local ? "127.0.0.1:" : "::", port, "for path:", root);
    });
    server.on('close', serverClosed);
  } catch (e) {
    log("error starting server");
    errorToWindow("ERROR:", e, e.message, e.stack);
  }
}

function stopServer() {
  log("stopServer");
  log("running:", running);
  log("server:", server);
  if (running && server) {
    log("stopServer really");
    logToWindow("stopping server");
    server.close();
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
    server.close();
  }
  app.quit();
});

function setupMenus() {
  const menuTemplate = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.reload();
          }
        },
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
    const name = electron.app.getName();
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

