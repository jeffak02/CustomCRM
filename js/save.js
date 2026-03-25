'use strict';
// ─── SAVE ──────────────────────────────────────────────
function saveCustomer() {
  const first=document.getElementById('cust-first').value.trim();
  const last =document.getElementById('cust-last').value.trim();
  if(!first||!last){ toast('First and last name required',true); return; }
  const item={id:editingId.customer||uid(),first,last,
    phone:document.getElementById('cust-phone').value,
    email:document.getElementById('cust-email').value,
    address:document.getElementById('cust-address').value,
    notes:document.getElementById('cust-notes').value,
    createdAt:new Date().toISOString()};
  const isEditing=!!editingId.customer;
  upsert('customers',item); closeModal('customer'); renderAll();
  toast(isEditing?'Customer updated':'Customer added');
}

function saveVehicle() {
  const year=document.getElementById('veh-year').value;
  const make=document.getElementById('veh-make').value.trim();
  const model=document.getElementById('veh-model').value.trim();
  if(!year||!make||!model){ toast('Year, make and model required',true); return; }
  const item={id:editingId.vehicle||uid(),year,make,model,
    trim:document.getElementById('veh-trim').value,
    color:document.getElementById('veh-color').value,
    plate:document.getElementById('veh-plate').value.toUpperCase(),
    vin:document.getElementById('veh-vin').value.toUpperCase(),
    mileage:document.getElementById('veh-mileage').value,
    ownerId:document.getElementById('veh-owner').value,
    notes:document.getElementById('veh-notes').value};
  const isEditing=!!editingId.vehicle;
  upsert('vehicles',item); closeModal('vehicle'); renderAll();
  toast(isEditing?'Vehicle updated':'Vehicle added');
}


// ─── WORK ORDER LINE ITEM BUILDER ─────────────────────
function addWOPartRow(desc='', qty=1, unit='', done=false) {
  const row = document.createElement('div');
  row.className = 'wo-part-row' + (done ? ' done' : '');
  row.innerHTML = `
    <input type="checkbox" class="wo-check wo-part-done" ${done?'checked':''} onchange="onWOItemCheck(this)">
    <input type="text"   class="p-desc"       placeholder="Oil filter, brake pads…" value="${escHtml(desc)}">
    <input type="number" class="p-qty  li-num" placeholder="1"    min="0" step="1"    value="${qty}"  oninput="updateWOPartTotal(this)">
    <input type="number" class="p-unit li-num" placeholder="0.00" min="0" step="0.01" value="${unit}" oninput="updateWOPartTotal(this)">
    <div class="li-total-cell p-total">$0.00</div>
    <button type="button" class="li-remove" onclick="this.closest('.wo-part-row').remove();updateWOProgress()">×</button>`;
  document.getElementById('wo-parts-list').appendChild(row);
  if (unit) updateWOPartTotal(row.querySelector('.p-unit'));
}

function addWOLaborRow(desc='', hours='', rate='', laborType='repair', done=false) {
  const defaultRate = getLaborRate();
  const useRate = (rate !== '' && rate !== undefined) ? rate : defaultRate;
  const isTax = LABOR_TYPES[laborType]?.taxable ?? false;
  const typeOpts = Object.entries(LABOR_TYPES).map(([k,v]) =>
    `<option value="${k}" ${k===laborType?'selected':''}>${v.label}</option>`).join('');
  const row = document.createElement('div');
  row.className = 'wo-labor-row' + (done ? ' done' : '');
  row.innerHTML = `
    <input type="checkbox" class="wo-check wo-labor-done" ${done?'checked':''} onchange="onWOItemCheck(this)">
    <input type="text"   class="l-desc"        placeholder="Oil change, brake job…"   value="${escHtml(desc)}">
    <input type="number" class="l-hrs  li-num"  placeholder="1.0" min="0" step="0.5" value="${hours}"  oninput="updateWOLaborTotal(this)">
    <input type="number" class="l-rate li-num"  placeholder="${defaultRate}" min="0" step="1" value="${useRate}" oninput="updateWOLaborTotal(this)">
    <div class="li-total-cell l-total">$0.00</div>
    <select class="li-labor-type ${isTax?'taxable-labor':''}" onchange="onLaborTypeChange(this)">${typeOpts}</select>
    <button type="button" class="li-remove" onclick="this.closest('.wo-labor-row').remove();updateWOProgress()">×</button>`;
  document.getElementById('wo-labor-list').appendChild(row);
  if (hours) updateWOLaborTotal(row.querySelector('.l-hrs'));
}

function updateWOPartTotal(input) {
  const row  = input.closest('.wo-part-row');
  const qty  = parseFloat(row.querySelector('.p-qty').value)  || 0;
  const unit = parseFloat(row.querySelector('.p-unit').value) || 0;
  row.querySelector('.p-total').textContent = '$' + (qty * unit).toFixed(2);
  updateWOProgress();
}

function updateWOLaborTotal(input) {
  const row  = input.closest('.wo-labor-row');
  const hrs  = parseFloat(row.querySelector('.l-hrs').value)  || 0;
  const rate = parseFloat(row.querySelector('.l-rate').value) || getLaborRate();
  row.querySelector('.l-total').textContent = '$' + (hrs * rate).toFixed(2);
  updateWOProgress();
}

function onWOItemCheck(cb) {
  const row = cb.closest('.wo-part-row, .wo-labor-row');
  if (row) row.classList.toggle('done', cb.checked);
  updateWOProgress();
}

function updateWOProgress() {
  // Parts progress
  const pRows  = document.querySelectorAll('#wo-parts-list .wo-part-row');
  const pDone  = document.querySelectorAll('#wo-parts-list .wo-part-done:checked').length;
  const pTotal = pRows.length;
  const pWrap  = document.getElementById('wo-parts-progress');
  const pFill  = document.getElementById('wo-parts-fill');
  const pLbl   = document.getElementById('wo-parts-fill-label');
  if (pWrap) pWrap.style.display = pTotal > 0 ? 'flex' : 'none';
  if (pFill) {
    const pct = pTotal ? (pDone/pTotal*100) : 0;
    pFill.style.width = pct + '%';
    pFill.classList.toggle('complete', pDone === pTotal && pTotal > 0);
  }
  if (pLbl) pLbl.textContent = pDone + '/' + pTotal + ' done';

  // Labor progress
  const lRows  = document.querySelectorAll('#wo-labor-list .wo-labor-row');
  const lDone  = document.querySelectorAll('#wo-labor-list .wo-labor-done:checked').length;
  const lTotal = lRows.length;
  const lWrap  = document.getElementById('wo-labor-progress');
  const lFill  = document.getElementById('wo-labor-fill');
  const lLbl   = document.getElementById('wo-labor-fill-label');
  if (lWrap) lWrap.style.display = lTotal > 0 ? 'flex' : 'none';
  if (lFill) {
    const pct = lTotal ? (lDone/lTotal*100) : 0;
    lFill.style.width = pct + '%';
    lFill.classList.toggle('complete', lDone === lTotal && lTotal > 0);
  }
  if (lLbl) lLbl.textContent = lDone + '/' + lTotal + ' done';
}

function getWOPartRows() {
  return Array.from(document.querySelectorAll('#wo-parts-list .wo-part-row')).map(row => ({
    desc:  row.querySelector('.p-desc').value.trim(),
    qty:   parseFloat(row.querySelector('.p-qty').value)  || 1,
    unit:  parseFloat(row.querySelector('.p-unit').value) || 0,
    total: (parseFloat(row.querySelector('.p-qty').value)||1) * (parseFloat(row.querySelector('.p-unit').value)||0),
    done:  row.querySelector('.wo-part-done')?.checked ?? false
  })).filter(r => r.desc || r.total > 0);
}

function getWOLaborRows() {
  return Array.from(document.querySelectorAll('#wo-labor-list .wo-labor-row')).map(row => {
    const ltype = row.querySelector('.li-labor-type')?.value || 'repair';
    return {
      desc:       row.querySelector('.l-desc').value.trim(),
      hours:      parseFloat(row.querySelector('.l-hrs').value)  || 0,
      rate:       parseFloat(row.querySelector('.l-rate').value) || getLaborRate(),
      total:      (parseFloat(row.querySelector('.l-hrs').value)||0) * (parseFloat(row.querySelector('.l-rate').value)||getLaborRate()),
      labor_type: ltype,
      done:       row.querySelector('.wo-labor-done')?.checked ?? false
    };
  }).filter(r => r.desc || r.total > 0);
}

function renderWOLineItems(wo) {
  document.getElementById('wo-parts-list').innerHTML = '';
  document.getElementById('wo-labor-list').innerHTML = '';
  const parts = wo.parts_items || [];
  const labor = wo.labor_items || [];
  if (parts.length) parts.forEach(p => addWOPartRow(p.desc, p.qty, p.unit, p.done||false));
  else addWOPartRow();
  if (labor.length) labor.forEach(l => addWOLaborRow(l.desc, l.hours, l.rate, l.labor_type||'repair', l.done||false));
  else addWOLaborRow();
  updateWOProgress();
}

function saveWorkorder() {
  const custId = document.getElementById('wo-customer').value;
  const desc   = document.getElementById('wo-description').value.trim();
  if (!custId || !desc) { toast('Customer and description required', true); return; }
  const wos    = DB.workorders;
  const nextNum = wos.length ? Math.max(...wos.map(w=>w.number||0))+1 : 1001;
  const parts_items = getWOPartRows();
  const labor_items = getWOLaborRows();
  const partsSum = parts_items.reduce((s,r) => s+r.total, 0);
  const laborSum = labor_items.reduce((s,r) => s+r.total, 0);
  const item = {
    id: editingId.workorder || uid(),
    number: editingId.workorder ? (wos.find(x=>x.id===editingId.workorder)?.number||nextNum) : nextNum,
    customerId:  custId,
    vehicleId:   document.getElementById('wo-vehicle').value,
    description: desc,
    parts_items, labor_items,
    parts: partsSum, labor: laborSum,
    status:      document.getElementById('wo-status').value,
    priority:    document.getElementById('wo-priority').value || 'normal',
    tech:        document.getElementById('wo-tech').value.trim(),
    mileageIn:   document.getElementById('wo-mileage-in').value,
    cost:        parseFloat(document.getElementById('wo-cost').value) || 0,
    dateIn:      document.getElementById('wo-datein').value,
    datePromise: document.getElementById('wo-datepromise').value,
    notes:       document.getElementById('wo-notes').value,
    createdAt:   editingId.workorder
      ? (wos.find(x=>x.id===editingId.workorder)?.createdAt || new Date().toISOString())
      : new Date().toISOString()
  };
  const isEditing=!!editingId.workorder;
  upsert('workorders', item); closeModal('workorder'); renderAll();
  toast(isEditing ? 'Work order updated' : 'Work order #'+item.number+' created');
}

function saveInvoice() {
  const custId = document.getElementById('inv-customer').value;
  if (!custId) { toast('Customer required', true); return; }
  const parts_items = getPartRows();
  const labor_items = getLaborRows();
  const partsSum    = parts_items.reduce((s, r) => s + r.total, 0);
  const laborSum    = labor_items.reduce((s, r) => s + r.total, 0);
  const taxableSub  = parts_items.filter(r => r.taxable).reduce((s,r) => s+r.total, 0)
                    + labor_items.filter(r => r.taxable).reduce((s,r) => s+r.total, 0);
  const taxPct = parseFloat(document.getElementById('inv-tax').value) || 0;
  const total  = partsSum + laborSum + taxableSub * taxPct / 100;
  const invs = DB.invoices;
  const nextNum = invs.length ? Math.max(...invs.map(i => i.number||0)) + 1 : 2001;
  const item = {
    id: editingId.invoice || uid(),
    number: editingId.invoice ? (invs.find(x => x.id===editingId.invoice)?.number || nextNum) : nextNum,
    customerId: custId,
    workorderId: document.getElementById('inv-workorder').value,
    vehicleId: document.getElementById('inv-vehicle')?.value || '',
    parts_items, labor_items,
    parts: partsSum, labor: laborSum,
    tax: taxPct, total,
    status: document.getElementById('inv-status').value,
    amount_paid: parseFloat(document.getElementById('inv-amount-paid').value)||0,
    date:   document.getElementById('inv-date').value,
    notes:  document.getElementById('inv-notes').value
  };
  const isEditing=!!editingId.invoice;
  upsert('invoices', item); closeModal('invoice'); renderAll();
  toast(isEditing ? 'Invoice updated' : 'Invoice #' + item.number + ' created');
}


function toggleAmountPaid() {
  const status = document.getElementById('inv-status')?.value;
  const grp    = document.getElementById('amount-paid-group');
  if (grp) grp.style.display = status === 'partial' ? 'flex' : 'none';
  updatePaidDisplay();
}

function updatePaidDisplay() {
  const total   = parseFloat((document.getElementById('inv-total')?.value || '').replace('$','')) || 0;
  const paid    = parseFloat(document.getElementById('inv-amount-paid')?.value) || 0;
  const preview = document.getElementById('paid-preview');
  const bar     = document.getElementById('paid-bar');
  const paidLbl = document.getElementById('paid-label');
  const owedLbl = document.getElementById('owed-label');
  const status  = document.getElementById('inv-status')?.value;
  if (!preview) return;
  if (status === 'partial' && total > 0) {
    preview.style.display = 'block';
    const pct = Math.min(100, (paid / total) * 100);
    bar.style.width = pct.toFixed(1) + '%';
    bar.classList.toggle('full', pct >= 100);
    paidLbl.textContent = '$' + paid.toFixed(2) + ' paid';
    owedLbl.textContent = '$' + Math.max(0, total - paid).toFixed(2) + ' remaining';
  } else {
    preview.style.display = 'none';
  }
}

function upsert(col,item) {
  let list=DB[col]; const idx=list.findIndex(x=>x.id===item.id);
  if(idx>=0) list[idx]=item; else list.push(item);
  DB[col]=list;
}

function deleteItem(type,id) {
  if(!confirm('Delete this '+type+'? This cannot be undone.')) return;
  DB[type+'s']=DB[type+'s'].filter(x=>x.id!==id);
  renderAll();
  toast(type.charAt(0).toUpperCase()+type.slice(1)+' deleted');
}

