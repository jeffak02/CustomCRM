'use strict';
// ─── COLOR SCHEME ENGINE ────────────────────────────────
function _hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function _rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v =>
    Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  ).join('');
}

function _hexToHsl(hex) {
  let [r, g, b] = _hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function _hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function schemeFromColors(hudHex, accentHex) {
  const [h, s, l] = _hexToHsl(hudHex);
  const [ah, as_, al] = _hexToHsl(accentHex);
  const [hr, hg, hb] = _hexToRgb(hudHex);
  const [ar, ag, ab] = _hexToRgb(accentHex);
  const bgSat = Math.min(s, 90);

  return {
    '--bg':       _hslToHex(h, bgSat, 3),
    '--surface':  _hslToHex(h, bgSat, 5),
    '--surface2': _hslToHex(h, bgSat, 7),
    '--surface3': _hslToHex(h, bgSat, 9),
    '--border':   _hslToHex(h, bgSat, 13),
    '--accent':   accentHex,
    '--accent-h': _hslToHex(ah, as_, Math.min(al + 12, 90)),
    '--hud':      hudHex,
    '--hud-dim':  _hslToHex(h, bgSat, Math.max(l * 0.33, 10)),
    '--hud-glow': `rgba(${hr},${hg},${hb},0.12)`,
    '--text':     _hslToHex(h, 22, 72),
    '--text2':    _hslToHex(h, 35, 38),
    '--text3':    _hslToHex(h, 40, 20),
  };
}

function applyColorScheme(hudHex, accentHex) {
  const scheme = schemeFromColors(hudHex, accentHex);
  const root = document.documentElement.style;
  Object.entries(scheme).forEach(([k, v]) => root.setProperty(k, v));
  // Sync hex labels if the inputs exist
  const hudHexEl    = document.getElementById('s-hud-hex');
  const accentHexEl = document.getElementById('s-accent-hex');
  if (hudHexEl)    hudHexEl.textContent = hudHex;
  if (accentHexEl) accentHexEl.textContent = accentHex;
  // Auto-save on change
  DB.settings = { ...DB.settings, hudColor: hudHex, accentColor: accentHex };
}

// ─── SETTINGS ──────────────────────────────────────────
function loadSettings() {
  const s = DB.settings;
  ['name','address','phone','email','website','license','footer','tax','labor-rate'].forEach(k => {
    const el = document.getElementById('s-'+k); if (el && s[k] !== undefined) el.value = s[k];
  });
  const hud    = s.hudColor    || '#39ff14';
  const accent = s.accentColor || '#cc1e1e';
  const hudEl    = document.getElementById('s-hud-color');
  const accentEl = document.getElementById('s-accent-color');
  if (hudEl)    hudEl.value = hud;
  if (accentEl) accentEl.value = accent;
  const hudHexEl    = document.getElementById('s-hud-hex');
  const accentHexEl = document.getElementById('s-accent-hex');
  if (hudHexEl)    hudHexEl.textContent = hud;
  if (accentHexEl) accentHexEl.textContent = accent;
}

function saveSettings() {
  const s = {};
  ['name','address','phone','email','website','license','footer','tax','labor-rate'].forEach(k => {
    const el = document.getElementById('s-'+k); if (el) s[k] = el.value;
  });
  const hudEl    = document.getElementById('s-hud-color');
  const accentEl = document.getElementById('s-accent-color');
  s.hudColor    = (hudEl    ? hudEl.value    : DB.settings.hudColor)    || '#39ff14';
  s.accentColor = (accentEl ? accentEl.value : DB.settings.accentColor) || '#cc1e1e';
  DB.settings = { ...DB.settings, ...s };
  toast('Settings saved');
}

function exportData() {
  const data = { customers:DB.customers, vehicles:DB.vehicles, workorders:DB.workorders,
                 invoices:DB.invoices, settings:DB.settings, exportedAt:new Date().toISOString() };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}));
  a.download = 'geistwerks-backup-'+new Date().toISOString().split('T')[0]+'.json';
  toast('Backup saved — keep this file safe outside the app bundle');
  a.click(); toast('Data exported');
}

function importData(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.customers)  DB.customers  = data.customers;
      if (data.vehicles)   DB.vehicles   = data.vehicles;
      if (data.workorders) DB.workorders = data.workorders;
      if (data.invoices)   DB.invoices   = data.invoices;
      if (data.settings)   DB.settings   = data.settings;
      const s = DB.settings;
      applyColorScheme(s.hudColor || '#39ff14', s.accentColor || '#cc1e1e');
      renderAll(); loadSettings(); toast('Data imported');
    } catch { toast('Invalid file format', true); }
  };
  reader.readAsText(file); input.value = '';
}

async function clearAllData() {
  if (!confirm('Delete ALL data? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure?')) return;
  DB._data = { schemaVersion:DB._data.schemaVersion, customers:[], vehicles:[],
               workorders:[], invoices:[], settings:{} };
  await DB._flush();
  renderAll(); toast('All data cleared');
}
