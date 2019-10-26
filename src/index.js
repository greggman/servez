const $ = document.querySelector.bind(document);
const {ipcRenderer, remote} = require('electron')
const dialog = remote.dialog;
const fs = require('fs');

const browseRootElem = $("#browseRoot");
const rootElem = $("#root");
const rootareaElem = $("#rootarea");
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
  log("server stopped");
});

ipcRenderer.send('getSettings');

function removeClass(elem, className) {
  elem.classList.remove(className);
}

function addClass(elem, className) {
  elem.classList.add(className);
}

class Dropdown {
  constructor(elem, callback) {
    this.toggle = this.toggle.bind(this);
    this.hide = this.hide.bind(this);
    this.callback = callback;
    this.elem = elem;
    this.buttonElem = elem.querySelector('button');
    this.contentElem = elem.querySelector('div');
    this.buttonElem.addEventListener('click', this.toggle);
    this.contentElem.addEventListener('blur', this.hide);
  }
  toggle() {
    const style = this.contentElem.style;
    const show = !!style.display;
    style.display = show ? '' : 'block';
    if (show) {
      this.contentElem.focus();
    }
  }
  hide() {
    const style = this.contentElem.style;
    const show = !!style.display;
    if (show) {
      this.toggle();
    }
  }
  setOptions(options) {
    this.contentElem.innerHTML = '';
    options.forEach((option, ndx) => {
      const div = document.createElement('div');
      div.textContent = option;
      div.addEventListener('click', () => {
        this.hide();
        this.callback(option);
      });
      this.contentElem.appendChild(div);
    });
    this.elem.style.display = options.length ? '' : 'none';
  }
}

function updateSettings() {
  const newSettings = {};
  Object.keys(settingsInfo).forEach(id => {
    const info = settingsInfo[id];
    info.get(newSettings);
  });
  if (fs.existsSync(newSettings.root)) {
    removeClass(rootareaElem, "bad");
    ipcRenderer.send('updateSettings', newSettings);
  } else {
    error("non existent path:", newSettings.root);
    addClass(rootareaElem, "bad");
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

async function getFolderToServe() {
  const result = await dialog.showOpenDialog(remote.getCurrentWindow(), {
    title: "Select Folder to Serve",
    defaultPath: rootElem.value,
    properties: ["openDirectory"],
  });
  if (!result.canceled) {
    const paths = result.filePaths;
    if (paths && paths.length) {
      rootElem.value = paths[0];
      updateSettings();
    }
  }
}

const recent = new Dropdown($('#recent'), (newPath) => {
  rootElem.value = newPath;
  updateSettings();
});

settingsInfo.recent = {
  set: settings => {
    recent.setOptions(settings.recent || ['abc', 'def', 'ghi']);
  },
  get: settings => {
    //
  },
};

browseRootElem.addEventListener('click', e => {
  getFolderToServe();
});
clearElem.addEventListener('click', clearLog);

