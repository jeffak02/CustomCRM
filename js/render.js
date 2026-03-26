'use strict';
// ─── RENDER ────────────────────────────────────────────
function renderAll() {
  renderCustomers(); renderVehicles(); renderWorkorders();
  renderInvoices(); renderExpenses(); renderDashboard();
  renderCalendar(); renderMiniCalendar();
}

function statusBadge(s) {
  const m={open:['badge-open','Open'],inprogress:['badge-inprogress','In Progress'],completed:['badge-completed','Completed'],waiting:['badge-waiting','Waiting Parts'],estimate:['badge-estimate','Estimate']};
  const [c,l]=m[s]||['',''];
  return `<span class="badge ${c}">${l||s}</span>`;
}

function invStatusBadge(s) {
  const m={paid:['badge-completed','Paid'],unpaid:['badge-waiting','Unpaid'],partial:['badge-inprogress','Partial']};
  const [c,l]=m[s]||['',''];
  return `<span class="badge ${c}">${l||s}</span>`;
}

let custFilter='',woFilter='',woSF='',vehFilter='',invFilter='',invSF='',expFilter='',expCF='',expYF='';
function filterTable(type,val) {
  if(type==='customers'){custFilter=val.toLowerCase();renderCustomers();}
  if(type==='workorders'){woFilter=val.toLowerCase();renderWorkorders();}
  if(type==='vehicles'){vehFilter=val.toLowerCase();renderVehicles();}
  if(type==='invoices'){invFilter=val.toLowerCase();renderInvoices();}
  if(type==='expenses'){expFilter=val.toLowerCase();renderExpenses();}
}
function filterWOStatus(v){woSF=v;renderWorkorders();}
function filterInvStatus(v){invSF=v;renderInvoices();}
function filterExpCategory(v){expCF=v;renderExpenses();}
function filterExpYear(v){expYF=v;renderExpenses();}

function renderCustomers() {
  const customers=DB.customers,vehicles=DB.vehicles,invoices=DB.invoices;
  document.getElementById('cust-count-label').textContent=customers.length+' customer'+(customers.length!==1?'s':'');
  const f=customers.filter(c=>!custFilter||(c.first+' '+c.last+' '+c.phone+' '+c.email).toLowerCase().includes(custFilter));
  const tbody=document.getElementById('customers-tbody');
  if(!f.length){tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">—</div><p>No customers found.</p></div></td></tr>';return;}
  tbody.innerHTML=f.map(c=>{
    const vehs=vehicles.filter(v=>v.ownerId===c.id).length;
    const spent=invoices.filter(i=>i.customerId===c.id&&i.status==='paid').reduce((s,i)=>s+(i.total||0),0);
    return `<tr>
      <td class="name-cell">${c.first} ${c.last}</td>
      <td class="mono">${c.phone||'—'}</td>
      <td>${c.email||'—'}</td>
      <td class="mono">${vehs}</td>
      <td class="money">$${spent.toFixed(2)}</td>
      <td><div class="action-btns">
        <button class="action-btn edit" onclick="openModal('customer','${c.id}')">Edit</button>
        <button class="action-btn del"  onclick="deleteItem('customer','${c.id}')">Del</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderVehicles() {
  const vehicles = DB.vehicles, customers = DB.customers;
  document.getElementById('veh-count-label').textContent =
    vehicles.length + ' vehicle' + (vehicles.length !== 1 ? 's' : '');

  const f = vehicles.filter(v =>
    !vehFilter || (v.year+' '+v.make+' '+v.model+' '+v.vin+' '+v.plate+' '+
      (customers.find(c=>c.id===v.ownerId)||{first:'',last:''}).first+' '+
      (customers.find(c=>c.id===v.ownerId)||{first:'',last:''}).last
    ).toLowerCase().includes(vehFilter)
  );

  const container = document.getElementById('vehicles-grouped');
  if (!container) return;

  if (!f.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">—</div><p>No vehicles found.</p></div>`;
    return;
  }

  // Group by owner
  const groups = new Map(); // ownerId → {customer, vehicles[]}
  f.forEach(v => {
    const owner = customers.find(c => c.id === v.ownerId);
    const key   = v.ownerId || '__unassigned__';
    if (!groups.has(key)) groups.set(key, { owner, vehicles: [] });
    groups.get(key).vehicles.push(v);
  });

  // Sort groups: named owners alphabetically, unassigned last
  const sortedGroups = [...groups.entries()].sort(([ka, a], [kb, b]) => {
    if (ka === '__unassigned__') return 1;
    if (kb === '__unassigned__') return -1;
    const na = a.owner ? a.owner.last + a.owner.first : '';
    const nb = b.owner ? b.owner.last + b.owner.first : '';
    return na.localeCompare(nb);
  });

  container.innerHTML = sortedGroups.map(([key, { owner, vehicles: vList }]) => {
    const ownerName   = owner ? owner.first + ' ' + owner.last : 'UNASSIGNED';
    const ownerPhone  = owner?.phone || '';
    const vCount      = vList.length;

    const rows = vList.map(v => `<tr>
      <td class="veh-main">${v.year} ${v.make} ${v.model}${v.trim?' '+v.trim:''}</td>
      <td>${v.color||'—'}</td>
      <td>${v.plate||'—'}</td>
      <td>${v.vin||'—'}</td>
      <td>${v.mileage ? parseInt(v.mileage).toLocaleString()+' mi' : '—'}</td>
      <td><div class="action-btns">
        <button class="action-btn edit" onclick="openModal('vehicle','${v.id}')">Edit</button>
        <button class="action-btn prnt" onclick="newInvoiceFromVehicle('${v.id}')">WO</button>
        <button class="action-btn del"  onclick="deleteItem('vehicle','${v.id}')">Del</button>
      </div></td>
    </tr>`).join('');

    return `<div class="owner-group">
      <div class="owner-group-header">
        <span>${ownerName}</span>
        ${ownerPhone ? `<span class="owner-phone">${ownerPhone}</span>` : ''}
        <span class="owner-count">${vCount} vehicle${vCount!==1?'s':''}</span>
      </div>
      <div class="owner-vehicles-table">
        <table>
          <thead><tr><th>Vehicle</th><th>Color</th><th>Plate</th><th>VIN</th><th>Mileage</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

function newInvoiceFromVehicle(vehId) {
  // Always create a NEW work order for this vehicle (per spec)
  const veh = DB.vehicles.find(v => v.id === vehId);
  if (!veh) return;
  openModal('workorder');
  setTimeout(() => {
    const custSel = document.getElementById('wo-customer');
    if (custSel && veh.ownerId) {
      custSel.value = veh.ownerId;
      loadCustomerVehicles();
      updateWOCustomerInfo(veh.ownerId);
      setTimeout(() => {
        const vehSel = document.getElementById('wo-vehicle');
        if (vehSel) vehSel.value = vehId;
      }, 40);
    }
  }, 40);
}

function renderWorkorders() {
  const workorders=DB.workorders,customers=DB.customers,vehicles=DB.vehicles;
  document.getElementById('wo-count-label').textContent=workorders.length+' order'+(workorders.length!==1?'s':'');
  const f=workorders.filter(w=>{
    const c=customers.find(x=>x.id===w.customerId),v=vehicles.find(x=>x.id===w.vehicleId);
    const s=(String(w.number)+' '+(c?c.first+' '+c.last:'')+' '+w.description+' '+(v?v.make+' '+v.model:'')).toLowerCase();
    return (!woFilter||s.includes(woFilter))&&(!woSF||w.status===woSF);
  });
  const tbody=document.getElementById('workorders-tbody');
  if(!f.length){tbody.innerHTML='<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">—</div><p>No work orders found.</p></div></td></tr>';return;}
  tbody.innerHTML=f.sort((a,b)=>b.number-a.number).map(w=>{
    const c=customers.find(x=>x.id===w.customerId),v=vehicles.find(x=>x.id===w.vehicleId);
    const pColors={urgent:'var(--red)',high:'var(--amber)',normal:'var(--hud-dim)',low:'var(--text3)'};
    const pColor=pColors[w.priority||'normal']||'var(--hud-dim)';
    return `<tr>
      <td class="mono" style="color:var(--accent)">#${w.number}</td>
      <td class="name-cell">${c?c.first+' '+c.last:'—'}</td>
      <td>${v?v.year+' '+v.make+' '+v.model:'—'}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${w.description}">${w.description}</td>
      <td>${statusBadge(w.status)}</td>
      <td><span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:${pColor};letter-spacing:1px;text-transform:uppercase">${(w.priority||'normal').toUpperCase()}</span></td>
      <td class="mono" style="font-size:10px;color:var(--hud-dim)">${w.tech||'—'}</td>
      <td class="money">$${(w.cost||0).toFixed(2)}</td>
      <td class="mono" style="font-size:10px">${w.datePromise||'—'}</td>
      <td><div class="action-btns">
        <button class="action-btn edit" onclick="openModal('workorder','${w.id}')">Edit</button>
        <button class="action-btn prnt" onclick="printWorkorder('${w.id}')">Print</button>
        <button class="action-btn" onclick="newInvoiceFromWO('${w.id}')" style="border-color:#28c76f;color:#28c76f" title="Create invoice">Invoice</button>
        <button class="action-btn del"  onclick="deleteItem('workorder','${w.id}')">Del</button>
      </div></td>
    </tr>`;
  }).join('');
}

const EXP_CAT_LABELS = {
  supplies:'Supplies', tools:'Tools & Equip.', utilities:'Utilities',
  insurance:'Insurance', rent:'Rent / Lease', other:'Other'
};

function renderExpenses() {
  const expenses = DB.expenses;

  // Keep year filter in sync with available data
  const years = [...new Set(expenses.map(e => (e.date||'').slice(0,4)).filter(Boolean))].sort().reverse();
  const yearSel = document.getElementById('exp-year-filter');
  if (yearSel) {
    const cur = yearSel.value;
    yearSel.innerHTML = '<option value="">All Years</option>' +
      years.map(y => `<option value="${y}"${y===cur?' selected':''}>${y}</option>`).join('');
  }

  const f = expenses.filter(e => {
    const s = ((e.date||'')+' '+(e.vendor||'')+' '+(e.description||'')).toLowerCase();
    return (!expFilter || s.includes(expFilter))
        && (!expCF    || e.category === expCF)
        && (!expYF    || (e.date||'').startsWith(expYF));
  }).sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const countEl = document.getElementById('exp-count-label');
  if (countEl) countEl.textContent = expenses.length + ' expense' + (expenses.length!==1?'s':'');

  const total   = f.reduce((s,e) => s+(e.amount||0), 0);
  const totalEl = document.getElementById('exp-total-label');
  if (totalEl) totalEl.textContent = '$' + total.toFixed(2);

  const filterLbl = document.getElementById('exp-filter-label');
  if (filterLbl) {
    const parts = [];
    if (expYF) parts.push(expYF);
    if (expCF) parts.push(EXP_CAT_LABELS[expCF]||expCF);
    filterLbl.textContent = parts.length ? f.length+' result'+(f.length!==1?'s':'') : '';
  }

  const tbody = document.getElementById('expenses-tbody');
  if (!tbody) return;
  if (!f.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">—</div><p>No expenses found.</p></div></td></tr>';
  } else {
    tbody.innerHTML = f.map(e => `<tr>
      <td class="mono">${e.date||'—'}</td>
      <td>${escHtml(e.vendor||'—')}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(e.description||'')}">${escHtml(e.description||'—')}</td>
      <td style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--text2)">${(EXP_CAT_LABELS[e.category]||e.category||'—').toUpperCase()}</td>
      <td class="money">$${(e.amount||0).toFixed(2)}</td>
      <td><div class="action-btns">
        <button class="action-btn edit" onclick="openModal('expense','${e.id}')">Edit</button>
        <button class="action-btn del"  onclick="deleteItem('expense','${e.id}')">Del</button>
      </div></td>
    </tr>`).join('');
  }

  // Monthly totals
  const monthly = document.getElementById('exp-monthly-summary');
  if (monthly) {
    if (!f.length) {
      monthly.innerHTML = '<div style="padding:14px 16px;color:var(--text3);font-size:12px">No expenses match current filter.</div>';
    } else {
      const byMonth = {};
      f.forEach(e => {
        const m = (e.date||'').slice(0,7);
        if (m) byMonth[m] = (byMonth[m]||0)+(e.amount||0);
      });
      const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mRows = Object.entries(byMonth).sort().map(([ym,amt]) => {
        const [y,mo] = ym.split('-');
        const label = `${MONTH_NAMES[(parseInt(mo)||1)-1]} ${y}`;
        const ddId = `exp-mo-dd-${ym}`;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 16px;border-bottom:1px solid var(--border)">
          <span style="color:var(--text2)">${label}</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="money">$${amt.toFixed(2)}</span>
            <div class="print-dd" id="${ddId}">
              <button class="action-btn prnt" style="padding:2px 7px;font-size:10px" onclick="togglePrintDD('${ddId}')">Export ▾</button>
              <div class="print-dd-menu">
                <button onclick="closePrintDDs();printMonthExpenses('${ym}')">🖨 Print</button>
                <button onclick="closePrintDDs();saveMonthExpensesPDF('${ym}')">💾 Save PDF</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
      const filterNote = expYF ? ` — ${expYF}` : ' — All Time';
      monthly.innerHTML = mRows +
        `<div style="display:flex;justify-content:space-between;padding:10px 16px;font-weight:600">
          <span style="color:var(--text);font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:1px">TOTAL${filterNote}</span>
          <span class="money" style="color:var(--hud)">$${total.toFixed(2)}</span>
        </div>`;
    }
  }

  // Tax summary — totals by category for the current filter set
  const summary = document.getElementById('exp-tax-summary');
  if (!summary) return;
  if (!f.length) {
    summary.innerHTML = '<div style="padding:14px 16px;color:var(--text3);font-size:12px">No expenses match current filter.</div>';
    return;
  }
  const byCat = {};
  f.forEach(e => { byCat[e.category||'other'] = (byCat[e.category||'other']||0)+(e.amount||0); });
  const rows = Object.entries(byCat)
    .sort((a,b) => b[1]-a[1])
    .map(([cat,amt]) => `
      <div style="display:flex;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border)">
        <span style="color:var(--text2)">${EXP_CAT_LABELS[cat]||cat}</span>
        <span class="money">$${amt.toFixed(2)}</span>
      </div>`).join('');
  const filterNote = expYF ? ` — ${expYF}` : ' — All Time';
  summary.innerHTML = rows +
    `<div style="display:flex;justify-content:space-between;padding:10px 16px;font-weight:600">
      <span style="color:var(--text);font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:1px">TOTAL${filterNote}</span>
      <span class="money" style="color:var(--hud)">$${total.toFixed(2)}</span>
    </div>`;
}

function renderInvoices() {
  const invoices=DB.invoices,customers=DB.customers,workorders=DB.workorders;
  document.getElementById('inv-count-label').textContent=invoices.length+' invoice'+(invoices.length!==1?'s':'');
  const f=invoices.filter(i=>{
    const c=customers.find(x=>x.id===i.customerId),w=workorders.find(x=>x.id===i.workorderId);
    const s=(String(i.number)+' '+(c?c.first+' '+c.last:'')+' '+(w?'#'+w.number:'')).toLowerCase();
    return (!invFilter||s.includes(invFilter))&&(!invSF||i.status===invSF);
  });
  const tbody=document.getElementById('invoices-tbody');
  if(!f.length){tbody.innerHTML='<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">—</div><p>No invoices found.</p></div></td></tr>';return;}
  tbody.innerHTML=f.sort((a,b)=>b.number-a.number).map(i=>{
    const c=customers.find(x=>x.id===i.customerId),w=workorders.find(x=>x.id===i.workorderId);
    return `<tr>
      <td class="mono" style="color:var(--accent)">#${i.number}</td>
      <td class="name-cell">${c?c.first+' '+c.last:'—'}</td>
      <td class="mono">${w?'#'+w.number:'—'}</td>
      <td class="money">$${(i.labor||0).toFixed(2)}</td>
      <td class="money">$${(i.parts||0).toFixed(2)}</td>
      <td class="money" style="font-weight:600">
        $${(i.total||0).toFixed(2)}
        ${i.status==='partial'?`<div class="payment-progress" style="margin-top:4px">
          <div class="payment-bar-track"><div class="payment-bar-fill" style="width:${Math.min(100,((i.amount_paid||0)/(i.total||1))*100).toFixed(1)}%"></div></div>
          <div class="payment-meta"><span>$${(i.amount_paid||0).toFixed(2)} paid</span><span>$${Math.max(0,(i.total||0)-(i.amount_paid||0)).toFixed(2)} owed</span></div>
        </div>`:''}
      </td>
      <td>${invStatusBadge(i.status)}</td>
      <td class="mono">${i.date||'—'}</td>
      <td><div class="action-btns">
        <button class="action-btn edit" onclick="openModal('invoice','${i.id}')">Edit</button>
        <div class="print-dd" id="inv-dd-${i.id}">
          <button class="action-btn prnt" onclick="togglePrintDD('inv-dd-${i.id}')">Receipt ▾</button>
          <div class="print-dd-menu">
            <button onclick="closePrintDDs();printInvoice('${i.id}')">🖨 Print</button>
            <button onclick="closePrintDDs();saveInvoicePDF('${i.id}')">💾 Save PDF</button>
          </div>
        </div>
        <button class="action-btn del"  onclick="deleteItem('invoice','${i.id}')">Del</button>
      </div></td>
    </tr>`;
  }).join('');
}

