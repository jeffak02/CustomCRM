'use strict';
// ─── TOAST ─────────────────────────────────────────────
var _toastTimer=null;
var _toastEl=null;
function toast(msg,isErr=false) {
  try {
    if(!_toastEl||!document.body.contains(_toastEl)){
      _toastEl=document.createElement('div');
      document.body.appendChild(_toastEl);
    }
    _toastEl.textContent=msg;
    var cs=getComputedStyle(document.documentElement);
    var hud=cs.getPropertyValue('--hud').trim()||'#39ff14';
    var surface=cs.getPropertyValue('--surface2').trim()||'#121812';
    var border=cs.getPropertyValue('--border').trim()||'#1a2a1a';
    var text=cs.getPropertyValue('--text').trim()||'#b8d4b0';
    var red=cs.getPropertyValue('--red').trim()||'#cc1e1e';
    Object.assign(_toastEl.style,{
      position:'fixed', bottom:'24px', right:'24px',
      zIndex:'2147483647', display:'block',
      background:surface, border:'1px solid '+border,
      borderLeft:'4px solid '+(isErr?red:hud),
      padding:'12px 18px', fontFamily:'monospace', fontSize:'13px',
      color:text, maxWidth:'360px', borderRadius:'2px',
      boxShadow:'0 4px 24px rgba(0,0,0,0.9)', pointerEvents:'none',
    });
    clearTimeout(_toastTimer);
    _toastTimer=setTimeout(()=>{ if(_toastEl) _toastEl.style.display='none'; },3200);
  } catch(e){ console.error('toast error:',e); }
}

// ─── INIT ──────────────────────────────────────────────
document.getElementById('dateDisplay').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
window.addEventListener('resize', () => { if(document.getElementById('chart-area')) renderChart(); });
var _slider = document.getElementById('chart-range-slider');
if (_slider) { _slider.value = daysToSlider(activeChartRange); updateSliderLabel(); }

(async () => {
  await DB.load();
  var s = DB.settings;
  applyColorScheme(s.hudColor || '#39ff14', s.accentColor || '#cc1e1e');
  initDashboard();
  renderAll();
  if (window.electronAPI && window.electronAPI.getVersion) {
    var ver = await window.electronAPI.getVersion();
    var el = document.getElementById('settings-version-num');
    if (el) el.textContent = 'v' + ver;
  }
})();

// ─── AUTO-UPDATER ──────────────────────────────────────
var _updateInfo = null; // { version, url, downloadUrl }

if (window.electronAPI && window.electronAPI.onUpdateStatus) {
  window.electronAPI.onUpdateStatus(function(info) {
    _updateInfo = info;
    var btn = document.getElementById('update-btn');
    if (btn) {
      btn.textContent = '\u2191 v'+info.version+' AVAILABLE';
      btn.style.display = '';
      btn.onclick = function() { openUpdateModal(); };
    }
    toast('v'+info.version+' available \u2014 click to install');
  });
}

if (window.electronAPI && window.electronAPI.onDownloadProgress) {
  window.electronAPI.onDownloadProgress(function(pct) {
    var bar = document.getElementById('update-progress-bar');
    var lbl = document.getElementById('update-progress-label');
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = pct < 100 ? 'Downloading\u2026 ' + pct + '%' : 'Download complete \u2014 launching installer\u2026';
  });
}

// ─── UPDATE MODAL ──────────────────────────────────────
function openUpdateModal() {
  if (!_updateInfo) return;
  var msg = document.getElementById('update-modal-msg');
  if (msg) msg.textContent = 'GeistWerks v'+_updateInfo.version+' is available. Click \u201cInstall Now\u201d to download and run the installer, then the app will close.';
  // reset state
  var wrap = document.getElementById('update-progress-wrap');
  var bar  = document.getElementById('update-progress-bar');
  var lbl  = document.getElementById('update-progress-label');
  if (wrap) wrap.style.display = 'none';
  if (bar)  bar.style.width = '0%';
  if (lbl)  lbl.textContent = 'Downloading\u2026';
  _setUpdateButtons(true);
  document.getElementById('modal-update').classList.add('open');
}

function closeUpdateModal() {
  document.getElementById('modal-update').classList.remove('open');
}

function _setUpdateButtons(enabled) {
  var installBtn = document.getElementById('update-install-btn');
  var laterBtn   = document.getElementById('update-later-btn');
  var closeBtn   = document.getElementById('update-modal-close');
  if (installBtn) { installBtn.disabled = !enabled; installBtn.textContent = enabled ? 'Install Now' : 'Downloading\u2026'; }
  if (laterBtn)   laterBtn.disabled = !enabled;
  if (closeBtn)   closeBtn.disabled = !enabled;
}

async function startUpdate() {
  if (!_updateInfo) return;

  // No direct download URL — fall back to opening the release page
  if (!_updateInfo.downloadUrl) {
    if (window.electronAPI) window.electronAPI.openReleasePage(_updateInfo.url);
    closeUpdateModal();
    return;
  }

  _setUpdateButtons(false);
  var wrap = document.getElementById('update-progress-wrap');
  if (wrap) wrap.style.display = 'block';

  try {
    var localPath = await window.electronAPI.downloadUpdate(_updateInfo.downloadUrl);
    window.electronAPI.launchUpdate(localPath);
    // App will quit — no need to re-enable buttons
  } catch(e) {
    toast('Download failed \u2014 check your connection', true);
    _setUpdateButtons(true);
    if (wrap) wrap.style.display = 'none';
  }
}

// Attach modal button handlers after DOM is ready
document.getElementById('update-install-btn').addEventListener('click', startUpdate);
document.getElementById('update-later-btn').addEventListener('click', closeUpdateModal);
document.getElementById('update-modal-close').addEventListener('click', closeUpdateModal);
