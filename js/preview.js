'use strict';
// ─── WORK ORDER PREVIEW ────────────────────────────────
let _previewWoId = null;

function openWOPreview(woId) {
  _previewWoId = woId;
  const wo   = DB.workorders.find(w => w.id === woId); if (!wo) return;
  const cust = DB.customers.find(c => c.id === wo.customerId);
  const veh  = DB.vehicles.find(v => v.id === wo.vehicleId);

  document.getElementById('wop-title').textContent = 'Work Order #' + wo.number;

  // Status + priority controls in the header badge slot
  const statusOpts = ['estimate','open','inprogress','waiting','completed']
    .map(s => `<option value="${s}" ${wo.status===s?'selected':''}>${{estimate:'Estimate',open:'Open',inprogress:'In Progress',waiting:'Waiting Parts',completed:'Completed'}[s]}</option>`).join('');
  const priOpts = ['normal','high','urgent','low']
    .map(p => `<option value="${p}" ${(wo.priority||'normal')===p?'selected':''}>${{normal:'Normal',high:'High',urgent:'Urgent',low:'Low'}[p]}</option>`).join('');
  const priColors = {urgent:'var(--red)',high:'var(--amber)',normal:'var(--hud-dim)',low:'var(--text3)'};
  document.getElementById('wop-status-badge').innerHTML = `
    <div style="display:flex;gap:6px;align-items:center">
      <select id="wop-status-sel" onchange="updateWOFromPreview()" style="background:var(--surface2);border:1px solid var(--hud-dim);color:var(--hud);font-family:'Share Tech Mono',monospace;font-size:10px;padding:4px 6px;border-radius:1px;cursor:pointer">${statusOpts}</select>
      <select id="wop-priority-sel" onchange="updateWOFromPreview()" style="background:var(--surface2);border:1px solid var(--hud-dim);color:${priColors[wo.priority||'normal']};font-family:'Share Tech Mono',monospace;font-size:10px;padding:4px 6px;border-radius:1px;cursor:pointer">${priOpts}</select>
    </div>`;

  // Update priority select color on change
  document.getElementById('wop-priority-sel')?.addEventListener('change', function() {
    this.style.color = priColors[this.value] || 'var(--hud-dim)';
  });

  const pColor  = priColors[wo.priority||'normal'];

  // Due date
  let dueDisplay = '—', dueColor = 'var(--text2)';
  if (wo.datePromise) {
    const due = new Date(wo.datePromise + 'T00:00:00');
    const diff = Math.ceil((due - new Date()) / 86400000);
    if (diff < 0)       { dueDisplay = Math.abs(diff)+'d OVERDUE'; dueColor = 'var(--red)'; }
    else if (diff === 0){ dueDisplay = 'TODAY';  dueColor = 'var(--red)'; }
    else if (diff <= 2) { dueDisplay = diff+'d'; dueColor = 'var(--amber)'; }
    else                { dueDisplay = wo.datePromise; }
  }

  // Build checklist HTML
  function buildChecklist(items, typeLabel) {
    if (!items || !items.length) return '<div style="color:var(--text3);font-size:11px;padding:6px 0">— none —</div>';
    return items.map((item, i) => {
      const idStr = `wop-check-${typeLabel}-${i}`;
      return `<div class="wo-check-item ${item.done?'done':''}" onclick="togglePreviewCheck(this,'${woId}','${typeLabel}',${i})">
        <input type="checkbox" id="${idStr}" ${item.done?'checked':''} onclick="event.stopPropagation()">
        <span>${item.desc || '—'}</span>
        ${item.total>0 ? `<span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--hud-dim)">$${item.total.toFixed(2)}</span>` : ''}
        <span class="wo-check-type">${typeLabel==='part' ? (item.qty+'× $'+(item.unit||0).toFixed(2)) : ((item.hours||0)+'hr')}</span>
      </div>`;
    }).join('');
  }

  const pi = wo.parts_items || [];
  const li = wo.labor_items || [];
  const partsTotal = pi.reduce((s,p)=>s+(p.total||0),0);
  const laborTotal = li.reduce((s,l)=>s+(l.total||0),0);
  const partsDone  = pi.filter(p=>p.done).length;
  const laborDone  = li.filter(l=>l.done).length;
  const totalItems = pi.length + li.length;
  const doneItems  = partsDone + laborDone;
  const pct = totalItems > 0 ? Math.round(doneItems/totalItems*100) : 0;

  document.getElementById('wop-body').innerHTML = `
    <div class="wo-preview-grid">
      <div class="wo-preview-field">
        <label>Customer</label>
        <div class="val highlight">${cust ? cust.first+' '+cust.last : '—'}</div>
        ${cust?.phone ? `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--hud-dim);margin-top:2px">${cust.phone}</div>` : ''}
      </div>
      <div class="wo-preview-field">
        <label>Vehicle</label>
        <div class="val highlight">${veh ? veh.year+' '+veh.make+' '+veh.model : '—'}</div>
        ${veh?.plate ? `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--hud-dim);margin-top:2px">Plate: ${veh.plate}</div>` : ''}
        ${wo.mileageIn ? `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--hud-dim)">Mi in: ${parseInt(wo.mileageIn).toLocaleString()}</div>` : ''}
      </div>
      <div class="wo-preview-field">
        <label>Due Date</label>
        <div class="val" style="color:${dueColor}">${dueDisplay}</div>
        ${wo.dateIn ? `<div style="font-size:9px;color:var(--text3);margin-top:2px">In: ${wo.dateIn}</div>` : ''}
      </div>
      <div class="wo-preview-field">
        <label>Technician</label>
        <div class="val">${wo.tech || '—'}</div>
      </div>
      <div class="wo-preview-field">
        <label>Est. Cost</label>
        <div class="val">$${(wo.cost||0).toFixed(2)}</div>
      </div>
      <div class="wo-preview-field">
        <label>Dates</label>
        <div class="val" style="font-size:10px">In: ${wo.dateIn||'—'}</div>
        <div class="val" style="font-size:10px">Due: ${wo.datePromise||'—'}</div>
      </div>
    </div>

    <div class="wo-preview-field">
      <label>Description</label>
      <div class="val" style="margin-top:4px;line-height:1.5;white-space:pre-wrap">${wo.description}</div>
    </div>

    ${totalItems > 0 ? `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <label style="display:block;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--hud-dim)">Overall Progress</label>
        <span style="font-family:'Share Tech Mono',monospace;font-size:11px;color:${pct===100?'var(--hud)':'var(--text2)'}">${doneItems}/${totalItems} items · ${pct}%</span>
      </div>
      <div class="wo-progress-track" style="height:6px">
        <div class="wo-progress-fill ${pct===100?'complete':''}" style="width:${pct}%"></div>
      </div>
    </div>` : ''}

    ${pi.length > 0 ? `
    <div>
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--hud-dim);margin-bottom:6px">
        Parts &amp; Materials — ${partsDone}/${pi.length} done · $${partsTotal.toFixed(2)}
      </div>
      <div class="wo-preview-checklist">${buildChecklist(pi,'part')}</div>
    </div>` : ''}

    ${li.length > 0 ? `
    <div>
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--hud-dim);margin-bottom:6px">
        Labor — ${laborDone}/${li.length} done · $${laborTotal.toFixed(2)}
      </div>
      <div class="wo-preview-checklist">${buildChecklist(li,'labor')}</div>
    </div>` : ''}

    ${wo.notes ? `
    <div class="wo-preview-field">
      <label>Tech Notes</label>
      <div class="val" style="margin-top:4px;font-size:11px;color:var(--text2);white-space:pre-wrap">${wo.notes}</div>
    </div>` : ''}
  `;

  document.getElementById('wo-preview-overlay').classList.add('open');
}

// Save status/priority changes made directly in the preview
function updateWOFromPreview() {
  if (!_previewWoId) return;
  const wo = DB.workorders.find(w => w.id === _previewWoId);
  if (!wo) return;
  const newStatus = document.getElementById('wop-status-sel')?.value;
  const newPri    = document.getElementById('wop-priority-sel')?.value;
  if (newStatus) wo.status   = newStatus;
  if (newPri)    wo.priority = newPri;
  DB.workorders = DB.workorders.map(w => w.id === _previewWoId ? wo : w);
  // Refresh dashboard job board in background without closing preview
  renderJobBoard();
}

function closeWOPreview() {
  document.getElementById('wo-preview-overlay').classList.remove('open');
  _previewWoId = null;
}

function editFromPreview() {
  // Capture ID before closing (closeWOPreview nulls it)
  const woId = _previewWoId;
  if (!woId) return;
  closeWOPreview();
  openModal('workorder', woId);
}

function invoiceFromPreview() {
  // Capture ID before closing
  const woId = _previewWoId;
  if (!woId) return;
  closeWOPreview();
  newInvoiceFromWO(woId);
}

function togglePreviewCheck(el, woId, type, idx) {
  const wo = DB.workorders.find(w => w.id === woId);
  if (!wo) return;
  const arr = type === 'part' ? (wo.parts_items||[]) : (wo.labor_items||[]);
  if (arr[idx]) {
    arr[idx].done = !arr[idx].done;
    if (type === 'part') wo.parts_items = arr; else wo.labor_items = arr;
    DB.workorders = DB.workorders.map(w => w.id===woId ? wo : w);
  }
  el.classList.toggle('done', arr[idx]?.done);
  const cb = el.querySelector('input[type=checkbox]');
  if (cb) cb.checked = arr[idx]?.done;
  openWOPreview(woId);
}

// Close preview on overlay click
document.getElementById('wo-preview-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('wo-preview-overlay')) closeWOPreview();
});
