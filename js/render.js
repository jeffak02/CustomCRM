'use strict';
// ─── RENDER ────────────────────────────────────────────
function renderAll() {
  renderCustomers(); renderVehicles(); renderWorkorders();
  renderInvoices(); renderDashboard();
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

let custFilter='',woFilter='',woSF='',vehFilter='',invFilter='',invSF='';
function filterTable(type,val) {
  if(type==='customers'){custFilter=val.toLowerCase();renderCustomers();}
  if(type==='workorders'){woFilter=val.toLowerCase();renderWorkorders();}
  if(type==='vehicles'){vehFilter=val.toLowerCase();renderVehicles();}
  if(type==='invoices'){invFilter=val.toLowerCase();renderInvoices();}
}
function filterWOStatus(v){woSF=v;renderWorkorders();}
function filterInvStatus(v){invSF=v;renderInvoices();}

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
        <button class="action-btn prnt" onclick="printInvoice('${i.id}')">Receipt</button>
        <button class="action-btn del"  onclick="deleteItem('invoice','${i.id}')">Del</button>
      </div></td>
    </tr>`;
  }).join('');
}

