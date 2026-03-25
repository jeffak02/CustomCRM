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
    Object.assign(_toastEl.style,{
      position:'fixed', bottom:'24px', right:'24px',
      zIndex:'2147483647', display:'block',
      background:'#0d1a0c', border:'1px solid #1a5c0a',
      borderLeft:'4px solid '+(isErr?'#cc1e1e':'#39ff14'),
      padding:'12px 18px', fontFamily:'monospace', fontSize:'13px',
      color:'#c8e8c0', maxWidth:'360px', borderRadius:'2px',
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
  renderAll();
})();

// ─── AUTO-UPDATER ──────────────────────────────────────
if (window.electronAPI && window.electronAPI.onUpdateStatus) {
  window.electronAPI.onUpdateStatus(({ version, url }) => {
    var btn = document.getElementById('update-btn');
    if (btn) {
      btn.textContent = '\u2191 v'+version+' AVAILABLE';
      btn.style.display = '';
      btn.onclick = () => window.electronAPI.openReleasePage(url);
    }
    toast('v'+version+' available \u2014 click to download');
  });
}
