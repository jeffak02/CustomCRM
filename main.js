'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path  = require('path');
const fs    = require('fs');
const https = require('https');

// ── Data paths ────────────────────────────────────────────────────────────────
const dataDir  = path.join(app.getPath('userData'), 'data');
const dataFile = path.join(dataDir, 'geistwerks.json');

const SCHEMA_VERSION = 1;
const EMPTY = { schemaVersion: SCHEMA_VERSION, customers: [], vehicles: [], workorders: [], invoices: [], settings: {} };

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// One-time migration: copy data from old bundle location if userData is empty
const bundleData = path.join(__dirname, '..', 'app', 'Contents', 'Resources', 'data', 'geistwerks.json');
if (!fs.existsSync(dataFile)) {
  for (const candidate of [
    bundleData,
    '/Applications/GeistWerks.app/Contents/Resources/data/geistwerks.json',
  ]) {
    if (fs.existsSync(candidate)) {
      try { fs.copyFileSync(candidate, dataFile); } catch {}
      break;
    }
  }
}

// ── Schema migrations ─────────────────────────────────────────────────────────
// Each entry migrates from version (index) to (index + 1).
// Add a new function here whenever the data shape changes between releases.
const MIGRATIONS = [
  // v0 → v1: introduce schemaVersion; ensure all top-level collections exist
  (data) => {
    data.schemaVersion = 1;
    data.customers  = data.customers  || [];
    data.vehicles   = data.vehicles   || [];
    data.workorders = data.workorders || [];
    data.invoices   = data.invoices   || [];
    data.settings   = data.settings   || {};
    return data;
  },
];

function migrate(raw) {
  const fromVersion = raw.schemaVersion || 0;
  if (fromVersion >= SCHEMA_VERSION) return { data: raw, changed: false };

  let data = JSON.parse(JSON.stringify(raw)); // deep-copy before mutating
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    data = MIGRATIONS[v](data);
  }
  return { data, changed: true };
}

function loadData() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
  catch { return { ...EMPTY }; }

  const { data, changed } = migrate(raw);
  if (changed) {
    // Preserve a pre-migration snapshot so the user can roll back manually
    const fromVersion = raw.schemaVersion || 0;
    const backupFile  = dataFile + `.pre-v${fromVersion}.bak`;
    if (!fs.existsSync(backupFile)) {
      try { fs.writeFileSync(backupFile, JSON.stringify(raw, null, 2)); } catch {}
    }
    saveData(data);
  }
  return data;
}

function saveData(obj) {
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, dataFile);
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('load-data', () => loadData());
ipcMain.handle('save-data', (_, data) => { saveData(data); return { ok: true }; });
ipcMain.on('open-releases', (_, url) => shell.openExternal(url));

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width:  1300,
    height: 860,
    minWidth:  900,
    minHeight: 600,
    title: 'GeistWerks CRM',
    icon: path.join(__dirname, 'AppIcon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'geistwerks.html'));
  win.on('closed', () => { win = null; });
}

// ── Update check (GitHub Releases API) ────────────────────────────────────────
// Set these to match your GitHub repo:
const GITHUB_OWNER = 'jeffak02';
const GITHUB_REPO  = 'CustomCRM';

function checkForUpdates() {
  if (!app.isPackaged) return;

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const req = https.get(url, { headers: { 'User-Agent': 'GeistWerks-Updater' } }, (res) => {
    let body = '';
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => {
      try {
        const release = JSON.parse(body);
        const latest  = release.tag_name?.replace(/^v/, '');
        const current = app.getVersion();
        if (latest && latest !== current && isNewer(latest, current)) {
          win?.webContents.send('update-status', {
            version: latest,
            url: release.html_url,
          });
        }
      } catch { /* ignore parse errors */ }
    });
  });
  req.on('error', () => {}); // silently ignore network errors
  req.end();
}

function isNewer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  // Check on launch, then every 4 hours
  checkForUpdates();
  setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (win) win.focus();
});

app.on('window-all-closed', () => app.quit());
