"use strict";

const makeOptions = require('optionator');

const optionSpec = {
  options: [
    { option: 'help', alias: 'h', type: 'Boolean', description: 'displays help' },
    { option: 'port', alias: 'p', type: 'Int', description: 'port', default: '8080' },
    { option: 'dirs', type: 'Boolean', description: 'show directory listing', default: 'true', },
    { option: 'cors', type: 'Boolean', description: 'send CORS headers', default: 'true', },
    { option: 'ssl', type: 'Boolean', description: 'use HTTPS', default: 'false', },
    { option: 'local', type: 'Boolean', description: 'local machine only', default: 'false', },
    { option: 'index', type: 'Boolean', description: 'serve index.html for directories', default: 'true', },
  ],
  prepend: `Usage: servez${process.platform === 'win32' ? '.exe' : '' } [options] path-to-serve`,
  helpStyle: {
    typeSeparator: '=',
    descriptionSeparator: ' : ',
    initialIndent: 4,
  },
};
/* eslint-enable object-curly-newline */
const optionator = makeOptions(optionSpec);

let args;
try {
  args = optionator.parse(process.argv);
} catch (e) {
  console.error(e);
  printHelp();
}

function printHelp() {
  console.log(optionator.generateHelp());
  process.exit(0);  // eslint-disable-line
}

if (args.help) {
  printHelp();
}


const isOSX = process.platform === 'darwin';
const isDevMode = process.env.NODE_ENV === 'development';

const electron = require('electron');
const ipcMain = electron.ipcMain;
const path = require('path');
const fs = require('fs');
const Servez = require('servez-lib');
const colorSupport = require('color-support') || {};
const c = require('ansi-colors');

require('@electron/remote/main').initialize();

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
let mainWindow = null;
let mainWebContents = null;
let servez = null;
let running = false;
let restart = false;

const dataDir = app.getPath("userData");
const settingsPath = path.join(dataDir, "config.json");
const defaultSettings = {
  port: 8080,
  root: app.getPath("home"),
  local: false,
  cors: true,
  ssl: false,
  dirs: true,
  index: true,
  scan: true,
  unityHack: true,
  extensions: ['html'],
  recent: [],
};
const maxRecent = 10;

let settings;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, {encoding: 'utf8'}));
  const keys = Object.keys(defaultSettings).sort();
  if (!compareArrays(keys, Object.keys(settings).sort())) {
    throw new Error("bad settings");
  }
  keys.forEach(key => {
    const aType = typeof defaultSettings[key];
    const bType = typeof settings[key];
    if (aType !== bType) {
      throw new Error(`${key} of wrong type. Expected ${aType}, was ${bType}`);
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

const isShell = args._.length > 0;
const debug = (process.env.SERVEZ_ECHO) ? logToWindow : require('debug')('main');
c.enabled = colorSupport.hasBasic || !isShell;
let skipSaveBecauseStartedByShell = isShell;

function createWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    height: 650,
    defaultEncoding: "utf8",
  });

  require("@electron/remote/main").enable(mainWindow.webContents);

  mainWindow.loadURL(`file://${__dirname}/src/index.html?start=${isShell}`);
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
  servez = null;
  running = false;
  sendToWindow('stopped');
  debug("restart:", restart);
  if (restart) {
    restart = false;
    debug("startServer-restart");
    startServer();
  }
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
  try {
    servez = new Servez(Object.assign({}, settings, {
      logger: {
        log: logToWindow,
        error: errorToWindow,
        c,
      },
      dataDir,
    }));
    servez.on('host', (info) => {
      sendToWindow('host', info);
    });
    servez.on('start', (startInfo) => {
      running = true;
      if (!skipSaveBecauseStartedByShell) {
        saveSettings();
      }
      sendToWindow('started', startInfo);
      sendToWindow('settings', settings);
    });
    servez.on('close', serverClosed);
  } catch (e) {
    debug("error starting server");
    errorToWindow("ERROR:", e, e.message, e.stack);
  }
}

function stopServer() {
  debug("stopServer");
  debug("running:", running);
  debug("server:", servez);
  if (running && servez) {
    // if the stopped the server they changed settings manually I think?
    skipSaveBecauseStartedByShell = false;
    debug("stopServer really");
    servez.close();
  }
}

function saveSettings() {
  try {
    // remove root from recent
    settings.recent = settings.recent.filter(v => v !== settings.root);
    // add root to recent
    settings.recent.unshift(settings.root);
    // remove excess
    settings.recent.splice(maxRecent, settings.length - maxRecent);

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    errorToWindow('ERROR: could not save settings:', e);
  }
}

function updateSettings(event, newSettings) {
  let changed = false;
  // this is horrible but for now it works
  for (const key of Object.keys(newSettings)) {
    const newValue = newSettings[key];
    const oldValue = settings[key];
    if (!Array.isArray(oldValue) && oldValue !== newValue) {
      changed = true;
      settings[key] = newValue;
    }
  }
  if (changed && running) {
    startServer();
  }
}

function getSettings(event) {
  event.sender.send('settings', settings);
  event.sender.send((running && servez) ? 'started' : 'stopped');
}

function launch(event, startInfo) {
  electron.shell.openExternal(startInfo.baseUrl);
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

if (isShell) {
  settings.port = args.port;
  settings.dirs = args.dirs;
  settings.local = args.local;
  settings.index = args.index;
  settings.cors = args.cors;
  settings.ssl = args.ssl;
  settings.root = args._[0];
  settings.extensions = ['html'];
}

app.on('ready', () => {
  startIfReady();
});

app.on('window-all-closed', () => {
  mainWebContents = null;
  if (running && servez) {
    servez.close();
  }
  app.quit();
});

function setupMenus() {
  const menuTemplate = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isOSX ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startspeaking' },
              { role: 'stopspeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },    
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

