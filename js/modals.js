'use strict';
// ─── NAVIGATION ────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  const labels={dashboard:'Dashboard',customers:'Customers',workorders:'Work Orders',vehicles:'Vehicles',invoices:'Invoices',settings:'Settings'};
  document.querySelectorAll('nav button').forEach(b=>{ if(b.textContent.trim()===labels[name]) b.classList.add('active'); });
  if(name==='settings') loadSettings();
  renderAll();
}

// ─── MODALS ────────────────────────────────────────────
function openModal(type, id=null) {
  editingId[type]=id;
  populateSelects();
  clearForm(type);
  const titles={customer:'cust-modal-title',vehicle:'veh-modal-title',workorder:'wo-modal-title',invoice:'inv-modal-title'};
  const addLabels={customer:'Add Customer',vehicle:'Add Vehicle',workorder:'New Work Order',invoice:'New Invoice'};
  if(id) {
    const item=DB[type+'s'].find(x=>x.id===id);
    if(item) fillForm(type,item);
    document.getElementById(titles[type]).textContent='Edit '+type.charAt(0).toUpperCase()+type.slice(1);
  } else {
    document.getElementById(titles[type]).textContent=addLabels[type];
    const today=new Date().toISOString().split('T')[0];
    if(type==='workorder') document.getElementById('wo-datein').value=today;
    if(type==='invoice'){
      document.getElementById('inv-date').value=today;
      const s=DB.settings;
      // Always apply tax from settings — it's the authoritative source
      document.getElementById('inv-tax').value = s.tax || '';
      // Don't pre-render blank rows here — newInvoiceFromWO clears and fills them.
      // For a truly blank invoice (not from WO), add initial rows after a tick.
      document.getElementById('parts-list').innerHTML = '';
      document.getElementById('labor-list').innerHTML = '';
      setTimeout(() => {
        // Only add blank rows if a WO hasn't already populated them
        if (!document.querySelectorAll('#parts-list .li-part-row').length) addPartRow();
        if (!document.querySelectorAll('#labor-list .li-labor-row').length) addLaborRow();
        calcTotal();
      }, 80);
      updateInvVehicleSelect();
    }
  }
  document.getElementById('modal-'+type).classList.add('open');
}

function openAddModal() {
  const active=document.querySelector('.view.active').id.replace('view-','');
  const map={dashboard:'workorder',customers:'customer',workorders:'workorder',vehicles:'vehicle',invoices:'invoice',settings:'workorder'};
  openModal(map[active]||'workorder');
}

function closeModal(type) {
  document.getElementById('modal-'+type).classList.remove('open');
  editingId[type]=null;
}

document.querySelectorAll('.modal-overlay').forEach(el=>{
  el.addEventListener('click',e=>{ if(e.target===el) el.classList.remove('open'); });
});

function clearForm(type) {
  const ids={
    customer:['cust-first','cust-last','cust-phone','cust-email','cust-address','cust-notes'],
    vehicle: ['veh-year','veh-make','veh-model','veh-trim','veh-color','veh-plate','veh-vin','veh-mileage','veh-notes'],
    workorder:['wo-description','wo-cost','wo-datein','wo-datepromise','wo-notes','wo-tech','wo-mileage-in','wo-cust-phone'],
    invoice: ['inv-total','inv-notes','inv-amount-paid']
  };
  (ids[type]||[]).forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  if(type==='workorder'){
    const s=document.getElementById('wo-status'); if(s) s.value='open';
    const p=document.getElementById('wo-priority'); if(p) p.value='normal';
    const pl=document.getElementById('wo-parts-list'); if(pl) pl.innerHTML='';
    const ll=document.getElementById('wo-labor-list'); if(ll) ll.innerHTML='';
    addWOPartRow(); addWOLaborRow();
  }
  if(type==='invoice')  { const s=document.getElementById('inv-status'); if(s) s.value='unpaid'; }
}

function fillForm(type,item) {
  const set=(id,val)=>{ const el=document.getElementById(id); if(el&&val!==undefined) el.value=val; };
  if(type==='customer'){
    set('cust-first',item.first); set('cust-last',item.last);
    set('cust-phone',item.phone); set('cust-email',item.email);
    set('cust-address',item.address); set('cust-notes',item.notes);
  } else if(type==='vehicle'){
    set('veh-year',item.year); set('veh-make',item.make); set('veh-model',item.model);
    set('veh-trim',item.trim); set('veh-color',item.color); set('veh-plate',item.plate);
    set('veh-vin',item.vin); set('veh-mileage',item.mileage); set('veh-notes',item.notes);
    set('veh-owner',item.ownerId);
  } else if(type==='workorder'){
    set('wo-customer',item.customerId); loadCustomerVehicles(); updateWOCustomerInfo(item.customerId);
    setTimeout(()=>{ set('wo-vehicle',item.vehicleId); },50);
    set('wo-description',item.description);
    set('wo-status',item.status);
    set('wo-priority', item.priority||'normal');
    set('wo-tech', item.tech||'');
    set('wo-mileage-in', item.mileageIn||'');
    set('wo-cost',item.cost); set('wo-datein',item.dateIn);
    set('wo-datepromise',item.datePromise); set('wo-notes',item.notes);
    renderWOLineItems(item);
  } else if(type==='invoice'){
    set('inv-customer',item.customerId);
    set('inv-workorder',item.workorderId);
    // Tax always from settings — don't restore old value
    document.getElementById('inv-tax').value = DB.settings.tax || item.tax || '';
    set('inv-status',item.status);
    set('inv-date',item.date); set('inv-notes',item.notes);
    set('inv-amount-paid', item.amount_paid || '');
    // Populate vehicle dropdown for this customer, then restore selection
    updateInvVehicleSelect(item.customerId, item.vehicleId || (item.workorderId ? (DB.workorders.find(w=>w.id===item.workorderId)||{}).vehicleId : null));
    renderLineItems(item);
    calcTotal();
    toggleAmountPaid();
  }
}

function populateSelects() {
  const customers=DB.customers, workorders=DB.workorders;
  const custOpts='<option value="">-- Select --</option>'+customers.map(c=>`<option value="${c.id}">${c.first} ${c.last}</option>`).join('');
  ['veh-owner','wo-customer','inv-customer'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=custOpts; });
  updateInvVehicleSelect();
  const woOpts='<option value="">-- None --</option>'+workorders.map(w=>{
    const c=customers.find(x=>x.id===w.customerId);
    return `<option value="${w.id}">#${w.number} — ${c?c.first+' '+c.last:'Unknown'}</option>`;
  }).join('');
  const invWo=document.getElementById('inv-workorder'); if(invWo) invWo.innerHTML=woOpts;
  loadCustomerVehicles();
}


function updateInvVehicleSelect(custId, selectedVehId) {
  // Get customer — prefer passed id, fallback to dropdown value
  const cid = custId || document.getElementById('inv-customer')?.value;
  const vehSel = document.getElementById('inv-vehicle');
  const woId   = document.getElementById('inv-workorder')?.value;
  if (!vehSel) return;

  // Populate vehicle dropdown with this customer's vehicles
  const vehs = DB.vehicles.filter(v => v.ownerId === cid);
  vehSel.innerHTML = '<option value="">— none —</option>' +
    vehs.map(v => `<option value="${v.id}">${v.year} ${v.make} ${v.model}${v.trim?' '+v.trim:''}</option>`).join('');

  // Auto-select: prefer passed vehicleId, else derive from WO
  let vehId = selectedVehId;
  if (!vehId && woId) {
    const wo = DB.workorders.find(w => w.id === woId);
    if (wo) vehId = wo.vehicleId;
  }
  if (vehId) vehSel.value = vehId;

  // Show/hide vehicle group: hide if WO is selected (vehicle implied by WO)
  const grp = document.getElementById('inv-vehicle-group');
  if (grp) grp.style.display = woId ? 'none' : 'flex';
}

function onInvCustomerChange() {
  // When customer changes, reset WO dropdown and refresh vehicle list
  const woSel = document.getElementById('inv-workorder');
  if (woSel) woSel.value = '';
  updateInvVehicleSelect();
}


function newInvoiceFromWO(woId) {
  // Open a blank invoice modal, then populate from the work order.
  // We must clear line items BEFORE setting the WO dropdown so
  // autoFillFromWorkOrder always sees empty lists and fills them.
  openModal('invoice');
  setTimeout(() => {
    // Explicitly clear both line item lists to guarantee autofill runs
    document.getElementById('parts-list').innerHTML = '';
    document.getElementById('labor-list').innerHTML = '';
    const woSel = document.getElementById('inv-workorder');
    if (woSel) {
      woSel.value = woId;
      autoFillFromWorkOrder();
    }
  }, 50);
}

function autoFillFromWorkOrder() {
  const woId = document.getElementById('inv-workorder')?.value;
  if (!woId) return;
  const wo = DB.workorders.find(w => w.id === woId);
  if (!wo) return;

  // ── Customer + vehicle ─────────────────────────────
  const custSel = document.getElementById('inv-customer');
  if (custSel && wo.customerId) custSel.value = wo.customerId;
  updateInvVehicleSelect(wo.customerId, wo.vehicleId);

  // ── Date → today if blank ─────────────────────────
  const dateEl = document.getElementById('inv-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];

  // ── Tax always from settings ──────────────────────
  document.getElementById('inv-tax').value = DB.settings.tax || '';

  // ── Only fill line items if both lists are empty ──
  const partsHasContent = [...document.querySelectorAll('#parts-list .p-desc')].some(el => el.value.trim());
  const laborHasContent = [...document.querySelectorAll('#labor-list .l-desc')].some(el => el.value.trim());

  if (!partsHasContent && !laborHasContent) {
    document.getElementById('parts-list').innerHTML = '';
    document.getElementById('labor-list').innerHTML = '';

    const woParts = wo.parts_items || [];
    const woLabor = wo.labor_items || [];
    const rate    = getLaborRate();

    // Parts — direct from WO; taxable by default per CDTFA
    if (woParts.length) {
      woParts.forEach(p => addPartRow(p.desc, p.qty||1, p.unit||0, p.taxable !== false));
    } else {
      addPartRow();
    }

    // Labor — direct from WO items with type/hours/rate preserved
    if (woLabor.length) {
      woLabor.forEach(l => addLaborRow(l.desc, l.hours||'', l.rate||rate, l.labor_type||'repair'));
    } else {
      // Fallback: build from description text
      const lines = (wo.description||'').split('\n').map(s=>s.trim()).filter(Boolean);
      if (lines.length > 1) {
        lines.forEach(line => addLaborRow(line, '', rate, 'repair'));
      } else if (lines.length === 1) {
        const hrs = wo.cost > 0 ? (wo.cost / rate).toFixed(1) : '';
        addLaborRow(lines[0], hrs, rate, 'repair');
      } else {
        addLaborRow('', '', rate, 'repair');
      }
    }

    calcTotal();
    toast('Work order loaded — review line items before saving');
  } else {
    toast('Customer and vehicle updated from work order');
  }
}


function updateWOCustomerInfo(custId) {
  const cid = custId || document.getElementById('wo-customer')?.value;
  const c = DB.customers.find(x => x.id === cid);
  const el = document.getElementById('wo-cust-phone');
  if (el) el.value = c?.phone || '—';
}

function updateWOVehicleInfo() {
  // Reserved for future: could auto-populate mileage from last service
}

function loadCustomerVehicles() {
  const custId=document.getElementById('wo-customer')?.value;
  const vehicles=DB.vehicles.filter(v=>v.ownerId===custId);
  const el=document.getElementById('wo-vehicle');
  if(el) el.innerHTML='<option value="">-- Select --</option>'+vehicles.map(v=>`<option value="${v.id}">${v.year} ${v.make} ${v.model}</option>`).join('');
}

