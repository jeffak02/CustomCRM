'use strict';
/** @type {{ loadData:()=>Promise<any>, saveData:(d:any)=>Promise<any>, openReleasePage:(url:string)=>void, onUpdateStatus:(cb:(info:{version:string,url:string})=>void)=>void }} */
const electronAPI = /** @type {any} */(window).electronAPI;
// ─── TOAST ─────────────────────────────────────────────
let _toastTimer=null;
function toast(msg,isErr=false) {
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.style.borderLeftColor=isErr?'var(--red)':'var(--green)';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}

// No demo seed data

// ─── INIT ──────────────────────────────────────────────
document.getElementById('dateDisplay').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
window.addEventListener('resize', () => { if(document.getElementById('chart-area')) renderChart(); });
const _slider = document.getElementById('chart-range-slider');
if (_slider) { _slider.value = daysToSlider(activeChartRange); updateSliderLabel(); }

(async () => {
  await DB.load();
  const s = DB.settings;
  applyColorScheme(s.hudColor || '#39ff14', s.accentColor || '#cc1e1e');
  renderAll();
})();

// ─── AUTO-UPDATER ──────────────────────────────────────
if (electronAPI?.onUpdateStatus) {
  electronAPI.onUpdateStatus(({ version, url }) => {
    const btn = document.getElementById('update-btn');
    if (btn) {
      btn.textContent = `↑ v${version} AVAILABLE`;
      btn.style.display = '';
      btn.onclick = () => electronAPI.openReleasePage(url);
    }
    toast(`v${version} available — click to download`);
  });
}
