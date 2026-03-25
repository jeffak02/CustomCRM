'use strict';
// ─── LINE ITEM BUILDER ────────────────────────────────
function getLaborRate() {
  return parseFloat(DB.settings['labor-rate']) || 120;
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Parts rows: description | qty | unit | total | taxable | remove
// CDTFA rule: parts/materials ARE taxable by default.
// Exceptions: resale, US gov (gov credit card), farm equipment.
function addPartRow(desc='', qty=1, unit='', taxable=true) {
  const id = 'pt-' + Date.now() + '-' + Math.random().toString(36).slice(2,5);
  const row = document.createElement('div');
  row.className = 'li-part-row';
  row.innerHTML = `
    <input type="text"   class="p-desc"       placeholder="Oil filter, brake pads, coolant…" value="${escHtml(desc)}">
    <input type="number" class="p-qty  li-num" placeholder="1"    min="0" step="1"    value="${qty}"  oninput="updatePartTotal(this);calcTotal()">
    <input type="number" class="p-unit li-num" placeholder="0.00" min="0" step="0.01" value="${unit}" oninput="updatePartTotal(this);calcTotal()">
    <div class="li-total-cell p-total">$0.00</div>
    <div class="li-tax-cell">
      <input type="checkbox" class="p-taxable" id="${id}" ${taxable?'checked':''} onchange="calcTotal()" title="Taxable per CDTFA">
      <label for="${id}" class="${taxable?'taxable':'nontax'}" id="${id}-lbl">${taxable?'TAX':'EXEMPT'}</label>
    </div>
    <button type="button" class="li-remove" onclick="this.closest('.li-part-row').remove();calcTotal()">×</button>`;
  document.getElementById('parts-list').appendChild(row);
  if (unit) updatePartTotal(row.querySelector('.p-unit'));
  // Update label on checkbox change
  row.querySelector('.p-taxable').addEventListener('change', function() {
    const lbl = document.getElementById(id+'-lbl');
    if (lbl) { lbl.textContent = this.checked?'TAX':'EXEMPT'; lbl.className = this.checked?'taxable':'nontax'; }
  });
}

function updatePartTotal(input) {
  const row  = input.closest('.li-part-row');
  const qty  = parseFloat(row.querySelector('.p-qty').value)  || 0;
  const unit = parseFloat(row.querySelector('.p-unit').value) || 0;
  row.querySelector('.p-total').textContent = '$' + (qty * unit).toFixed(2);
}

function getPartRows() {
  return Array.from(document.querySelectorAll('#parts-list .li-part-row')).map(row => ({
    desc:    row.querySelector('.p-desc').value.trim(),
    qty:     parseFloat(row.querySelector('.p-qty').value)  || 1,
    unit:    parseFloat(row.querySelector('.p-unit').value) || 0,
    total:   (parseFloat(row.querySelector('.p-qty').value)||1) * (parseFloat(row.querySelector('.p-unit').value)||0),
    taxable: row.querySelector('.p-taxable')?.checked ?? true
  })).filter(r => r.desc || r.total > 0);
}

// Labor rows: description | hours | rate | total | type | remove
// CDTFA labor types:
//   'repair'  — repair/maintenance, NOT taxable (default)
//   'fab'     — fabrication/modification, TAXABLE
//   'install_new' — installation on new vehicle, TAXABLE
// Hazardous waste rows follow taxability of the associated sale.
const LABOR_TYPES = {
  repair:      { label:'REPAIR',    taxable:false, title:'Repair / maintenance labor — not taxable (CDTFA)' },
  fab:         { label:'FAB',       taxable:true,  title:'Fabrication / modification labor — taxable (CDTFA)' },
  install_new: { label:'INST NEW',  taxable:true,  title:'Installation on new vehicle — taxable (CDTFA)' },
  hazmat:      { label:'HAZ WASTE', taxable:false, title:'Hazardous waste fee — taxability follows associated sale' },
};

function addLaborRow(desc='', hours='', rate='', laborType='repair') {
  const defaultRate = getLaborRate();
  const useRate = rate !== '' && rate !== undefined ? rate : defaultRate;
  const isTax = LABOR_TYPES[laborType]?.taxable ?? false;
  const row = document.createElement('div');
  row.className = 'li-labor-row';
  const typeOpts = Object.entries(LABOR_TYPES).map(([k,v]) =>
    `<option value="${k}" ${k===laborType?'selected':''} title="${v.title}">${v.label}</option>`).join('');
  row.innerHTML = `
    <input type="text"   class="l-desc"        placeholder="Oil change, brake job, diagnosis…" value="${escHtml(desc)}">
    <input type="number" class="l-hrs  li-num"  placeholder="1.0" min="0" step="0.5" value="${hours}"   oninput="updateLaborTotal(this);calcTotal()">
    <input type="number" class="l-rate li-num"  placeholder="${defaultRate}" min="0" step="1" value="${useRate}" oninput="updateLaborTotal(this);calcTotal()">
    <div class="li-total-cell l-total">$0.00</div>
    <select class="li-labor-type ${isTax?'taxable-labor':''}" onchange="onLaborTypeChange(this);calcTotal()" title="Labor type determines taxability">${typeOpts}</select>
    <button type="button" class="li-remove" onclick="this.closest('.li-labor-row').remove();calcTotal()">×</button>`;
  document.getElementById('labor-list').appendChild(row);
  if (hours) updateLaborTotal(row.querySelector('.l-hrs'));
}

function onLaborTypeChange(sel) {
  const isTax = LABOR_TYPES[sel.value]?.taxable ?? false;
  sel.classList.toggle('taxable-labor', isTax);
}

function updateLaborTotal(input) {
  const row  = input.closest('.li-labor-row');
  const hrs  = parseFloat(row.querySelector('.l-hrs').value)  || 0;
  const rate = parseFloat(row.querySelector('.l-rate').value) || getLaborRate();
  row.querySelector('.l-total').textContent = '$' + (hrs * rate).toFixed(2);
}

function getLaborRows() {
  return Array.from(document.querySelectorAll('#labor-list .li-labor-row')).map(row => {
    const ltype = row.querySelector('.li-labor-type')?.value || 'repair';
    return {
      desc:      row.querySelector('.l-desc').value.trim(),
      hours:     parseFloat(row.querySelector('.l-hrs').value)  || 0,
      rate:      parseFloat(row.querySelector('.l-rate').value) || getLaborRate(),
      total:     (parseFloat(row.querySelector('.l-hrs').value)||0) * (parseFloat(row.querySelector('.l-rate').value)||getLaborRate()),
      labor_type: ltype,
      taxable:   LABOR_TYPES[ltype]?.taxable ?? false
    };
  }).filter(r => r.desc || r.total > 0);
}

// Populate the form when editing an existing invoice
function renderLineItems(inv) {
  document.getElementById('parts-list').innerHTML = '';
  document.getElementById('labor-list').innerHTML = '';
  const parts = inv.parts_items || [];
  const labor = inv.labor_items || [];
  if (parts.length) parts.forEach(p => addPartRow(p.desc, p.qty, p.unit, p.taxable !== false));
  else addPartRow();
  if (labor.length) labor.forEach(l => addLaborRow(l.desc, l.hours, l.rate, l.labor_type || 'repair'));
  else addLaborRow();
  calcTotal();
}

function calcTotal() {
  const parts    = getPartRows();
  const labors   = getLaborRows();
  const partsSum = parts.reduce((s, r)  => s + r.total, 0);
  const laborSum = labors.reduce((s, r) => s + r.total, 0);

  // CDTFA: tax applies only to taxable items
  const taxableParts  = parts.filter(r  => r.taxable).reduce((s, r) => s + r.total, 0);
  const taxableLabor  = labors.filter(r => r.taxable).reduce((s, r) => s + r.total, 0);
  const taxableSub    = taxableParts + taxableLabor;

  const taxPct   = parseFloat(document.getElementById('inv-tax').value) || 0;
  const taxAmt   = taxableSub * taxPct / 100;
  const total    = partsSum + laborSum + taxAmt;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('parts-subtotal',  '$' + partsSum.toFixed(2));
  set('labor-subtotal',  '$' + laborSum.toFixed(2));
  set('gt-parts',        '$' + partsSum.toFixed(2));
  set('gt-labor',        '$' + laborSum.toFixed(2));
  set('gt-taxable-sub',  '$' + taxableSub.toFixed(2));
  set('gt-tax-pct',      taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1));
  set('gt-tax-amt',      '$' + taxAmt.toFixed(2));
  set('gt-total',        '$' + total.toFixed(2));
  const totEl = document.getElementById('inv-total');
  if (totEl) totEl.value = '$' + total.toFixed(2);
  updatePaidDisplay();
}

