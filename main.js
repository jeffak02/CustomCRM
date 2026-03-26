'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const https = require('https');
const os    = require('os');
const { execFile } = require('child_process');

// ── Data paths ────────────────────────────────────────────────────────────────
const dataDir  = path.join(app.getPath('userData'), 'data');
const dataFile = path.join(dataDir, 'geistwerks.json');

const SCHEMA_VERSION = 1;
const EMPTY = { schemaVersion: SCHEMA_VERSION, customers: [], vehicles: [], workorders: [], invoices: [], expenses: [], calEvents: [], settings: {} };

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
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('load-data', () => loadData());
ipcMain.handle('save-data', (_, data) => { saveData(data); return { ok: true }; });
ipcMain.on('open-releases', (_, url) => shell.openExternal(url));

// ── Apple Calendar sync ────────────────────────────────────────────────────────
function buildAppleScript(ev) {
  const [year, month, day] = (ev.date || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  const title = (ev.title || 'Event').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  const notes = (ev.notes || '').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  const sh = ev.startTime ? parseInt(ev.startTime.split(':')[0]) : 9;
  const sm = ev.startTime ? parseInt(ev.startTime.split(':')[1]) : 0;
  const eh = ev.endTime   ? parseInt(ev.endTime.split(':')[0])   : sh + 1;
  const em = ev.endTime   ? parseInt(ev.endTime.split(':')[1])   : 0;
  const uid = ev.appleUid || '';
  // When a UID exists: try to update the existing event in-place.
  // Only create a new event if no match is found (handles manual deletion).
  // Updating in-place avoids the delete-while-iterating bug.
  return `tell application "Calendar"
  if not (exists calendar "GeistWerks") then
    make new calendar with properties {name:"GeistWerks"}
  end if
  tell calendar "GeistWerks"
    set sd to current date
    set year of sd to ${year}
    set month of sd to ${month}
    set day of sd to ${day}
    set hours of sd to ${sh}
    set minutes of sd to ${sm}
    set seconds of sd to 0
    set ed to current date
    set year of ed to ${year}
    set month of ed to ${month}
    set day of ed to ${day}
    set hours of ed to ${eh}
    set minutes of ed to ${em}
    set seconds of ed to 0
    set foundEvent to missing value
    ${uid ? `try
      repeat with oe in (every event)
        if uid of oe is "${uid}" then
          set foundEvent to oe
          exit repeat
        end if
      end repeat
    end try` : ''}
    if foundEvent is not missing value then
      set summary of foundEvent to "${title}"
      set description of foundEvent to "${notes}"
      -- Push end date 2 years out first so the new start can never land after it
      set safeEnd to current date
      set year of safeEnd to (year of sd) + 2
      set end date of foundEvent to safeEnd
      set start date of foundEvent to sd
      set end date of foundEvent to ed
      return uid of foundEvent
    else
      set theEvent to make new event with properties {summary:"${title}", start date:sd, end date:ed, description:"${notes}"}
      return uid of theEvent
    end if
  end tell
end tell`;
}

ipcMain.handle('apple-cal-sync', async (_, ev) => {
  const script = buildAppleScript(ev);
  if (!script) return { ok: false, error: 'Invalid event date' };
  const tmpFile = path.join(os.tmpdir(), 'gw-cal-' + Date.now() + '.scpt');
  try {
    fs.writeFileSync(tmpFile, script, 'utf8');
    return await new Promise(resolve => {
      execFile('osascript', [tmpFile], (err, stdout) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        if (err) resolve({ ok: false, error: err.message });
        else resolve({ ok: true, uid: stdout.trim() });
      });
    });
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch {}
    return { ok: false, error: e.message };
  }
});

// ── PDF export ────────────────────────────────────────────────────────────────
ipcMain.handle('print-to-pdf', async (_, filename) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: filename,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    const data = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });
    fs.writeFileSync(filePath, data);
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('apple-cal-remove', async (_, appleUid) => {
  if (!appleUid) return { ok: false };
  const script = `tell application "Calendar"
  if exists calendar "GeistWerks" then
    tell calendar "GeistWerks"
      set matchEvents to (every event whose uid is "${appleUid}")
      repeat with ev in matchEvents
        delete ev
      end repeat
    end tell
  end if
end tell`;
  const tmpFile = path.join(os.tmpdir(), 'gw-cal-rm-' + Date.now() + '.scpt');
  try {
    fs.writeFileSync(tmpFile, script, 'utf8');
    return await new Promise(resolve => {
      execFile('osascript', [tmpFile], (err) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        resolve({ ok: !err });
      });
    });
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch {}
    return { ok: false, error: e.message };
  }
});

// ── Update: download with progress ────────────────────────────────────────────
ipcMain.handle('download-update', async (_, downloadUrl) => {
  const ext  = downloadUrl.includes('.pkg') ? '.pkg' : '.zip';
  const dest = path.join(os.tmpdir(), 'geistwerks-update' + ext);
  await downloadFile(downloadUrl, dest, (pct) => {
    win?.webContents.send('download-progress', pct);
  });
  return dest;
});

// ── Update: launch installer and quit ─────────────────────────────────────────
ipcMain.on('launch-update', (_, localPath) => {
  if (localPath.endsWith('.pkg')) {
    // macOS system installer wizard handles the rest
    shell.openPath(localPath).then(() => app.quit());
  } else {
    // ZIP: write a tiny shell script that waits for us to quit, swaps the bundle, relaunches
    const appBundle  = path.dirname(path.dirname(path.dirname(app.getPath('exe')))); // .../GeistWerks.app
    const appsDir    = path.dirname(appBundle);
    const extractDir = path.join(os.tmpdir(), 'gw-update-extracted');
    const scriptPath = path.join(os.tmpdir(), 'gw-update.sh');
    const script = [
      '#!/bin/bash',
      'sleep 2',
      `rm -rf "${extractDir}"`,
      `unzip -o "${localPath}" -d "${extractDir}"`,
      `APP=$(find "${extractDir}" -name "*.app" -maxdepth 2 | head -1)`,
      '[ -z "$APP" ] && exit 1',
      `rm -rf "${appBundle}"`,
      `cp -r "$APP" "${appsDir}/"`,
      `open "${appBundle}"`,
      `rm -rf "${extractDir}" "${localPath}" "${scriptPath}"`,
    ].join('\n');
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    execFile('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  }
});

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let win = null;
let _pendingUpdate = null; // holds update info until the renderer is ready

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

  // Flush any update notification that arrived before the page was ready
  win.webContents.on('did-finish-load', () => {
    if (_pendingUpdate) {
      win.webContents.send('update-status', _pendingUpdate);
      _pendingUpdate = null;
    }
  });

  win.on('closed', () => { win = null; });
}

// ── Update check (GitHub Releases API) ────────────────────────────────────────
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
          // Pick the best asset download URL for this machine's arch
          const arch   = process.arch; // 'arm64' or 'x64'
          const assets = release.assets || [];
          let downloadUrl = null;
          if (arch === 'arm64') {
            const pkg = assets.find(a => a.name.endsWith('-arm64.pkg'));
            const zip = assets.find(a => a.name.includes('-arm64-mac.zip'));
            downloadUrl = (pkg || zip)?.browser_download_url || null;
          } else {
            const zip = assets.find(a => a.name.endsWith('-mac.zip') && !a.name.includes('arm64'));
            downloadUrl = zip?.browser_download_url || null;
          }
          const payload = { version: latest, url: release.html_url, downloadUrl };
          if (win && !win.webContents.isLoading()) {
            win.webContents.send('update-status', payload);
          } else {
            _pendingUpdate = payload; // renderer not ready yet — flush on did-finish-load
          }
        }
      } catch { /* ignore parse errors */ }
    });
  });
  req.on('error', () => {});
  req.end();
}

// ── File downloader (follows redirects, emits progress) ───────────────────────
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl) => {
      https.get(currentUrl, { headers: { 'User-Agent': 'GeistWerks-Updater' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
        const total    = parseInt(res.headers['content-length'] || '0');
        let   received = 0;
        const file     = fs.createWriteStream(dest);
        res.on('data', chunk => {
          received += chunk.length;
          file.write(chunk);
          if (total) onProgress(Math.round(received / total * 100));
        });
        res.on('end',   () => { file.end(() => resolve(dest)); });
        res.on('error', (e) => { file.destroy(); reject(e); });
      }).on('error', reject);
    };
    follow(url);
  });
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
