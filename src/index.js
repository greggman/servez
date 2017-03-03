const $ = document.querySelector.bind(document);
const {ipcRenderer} = require('electron')
const remote = require('electron').remote;
const dialog = remote.dialog;
const fs = require('fs');

const browseRootElem = $("#browseRoot");
const rootElem = $("#root");
const rootpairElem = $("#rootpair");
const startElem = $("#start");
const launchElem = $("#launch");
const logElem = $("#log");
const clearElem = $("#clear");

launchElem.disabled = true;

const settingsInfo = {
};

$(".form").querySelectorAll("input").forEach(elem => {
  const id = elem.id;
  switch(elem.type) {
    case "text":
      settingsInfo[id] = {
        set: settings => {
          elem.value = settings[id];
        },
        get: settings => {
          settings[id] = elem.value;
        },
      };
      elem.addEventListener('change', updateSettings);
      break;
    case "number":
      settingsInfo[id] = {
        set: settings => {
          elem.value = settings[id];
        },
        get: settings => {
          settings[id] = parseInt(elem.value);
        },
      };
      elem.addEventListener('change', updateSettings);
      break;
    case "checkbox":
      settingsInfo[id] = {
        set: settings => {
          elem.checked = settings[id];
        },
        get: settings => {
          settings[id] = elem.checked;
        },
      };
      elem.addEventListener('change', updateSettings);
      break;
  }
});

function logImpl(className, ...args) {
  const pre = document.createElement("pre");
  pre.textContent = [...args].join(" ");
  pre.className = className
  logElem.appendChild(pre);
  logElem.scrollTop = pre.offsetTop;
}

function log(...args) {
  logImpl("log", ...args);
}

function error(...args) {
  logImpl("error", ...args);
}

function clearLog() {
  logElem.innerHTML = "";
}

ipcRenderer.on('settings', (event, settings) => {
  Object.keys(settingsInfo).forEach(id => {
    const info = settingsInfo[id];
    info.set(settings);
  });
});

ipcRenderer.on('log', (event, ...args) => {
  log(...args);
});
ipcRenderer.on('error', (event, ...args) => {
  error(...args);
});

ipcRenderer.on('started', () => {
  startElem.textContent = "Stop";
  launchElem.disabled = false;
});

ipcRenderer.on('stopped', () => {
  startElem.textContent = "Start";
  launchElem.disabled = true;
});

ipcRenderer.send('getSettings');

function updateSettings() {
  const newSettings = {};
  Object.keys(settingsInfo).forEach(id => {
    const info = settingsInfo[id];
    info.get(newSettings);
  });
  if (fs.existsSync(newSettings.root)) {
    rootpairElem.className = "good";
    ipcRenderer.send('updateSettings', newSettings);
  } else {
    rootpairElem.className = "bad";
  }
}

startElem.addEventListener('click', e => {
  if (launchElem.disabled) {
    ipcRenderer.send('start');
  } else {
    ipcRenderer.send('stop');
  }
});

launchElem.addEventListener('click', e => {
  ipcRenderer.send('launch');
});

browseRootElem.addEventListener('click', e => {
  const paths = dialog.showOpenDialog(remote.getCurrentWindow(), {
    title: "Select Folder to Serve",
    defaultPath: rootElem.value,
    properties: ["openDirectory"],
  });
  if (paths && paths.length) {
    rootElem.value = paths[0];
    updateSettings();
  }
});
clearElem.addEventListener('click', clearLog);

