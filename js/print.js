'use strict';
// ─── PRINT DROPDOWN HELPERS ────────────────────────────────────────────────
function togglePrintDD(id) {
  const dd = document.getElementById(id);
  if (!dd) return;
  const wasOpen = dd.classList.contains('open');
  closePrintDDs();
  if (!wasOpen) {
    dd.classList.add('open');
    const btn = dd.querySelector('.action-btn');
    const menu = dd.querySelector('.print-dd-menu');
    if (btn && menu) {
      const r = btn.getBoundingClientRect();
      const mh = menu.offsetHeight;
      const mw = menu.offsetWidth || 140;
      const fitsBelow = r.bottom + 4 + mh <= window.innerHeight;
      menu.style.top  = fitsBelow ? (r.bottom + 4) + 'px' : (r.top - mh - 4) + 'px';
      menu.style.left = Math.max(4, r.right - mw) + 'px';
    }
  }
}
function closePrintDDs() {
  document.querySelectorAll('.print-dd.open').forEach(d => d.classList.remove('open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.print-dd')) closePrintDDs();
});

// ─── INVOICE HTML BUILDER ──────────────────────────────────────────────────
function buildInvoiceHTML(invoiceId) {
  const inv   = DB.invoices.find(x => x.id === invoiceId); if (!inv) return '';
  const cust  = DB.customers.find(x => x.id === inv.customerId);
  const wo    = DB.workorders.find(x => x.id === inv.workorderId);
  const vehId = (wo?.vehicleId) || inv.vehicleId;
  const veh   = vehId ? DB.vehicles.find(x => x.id === vehId) : null;
  const shop  = DB.settings;
  const sName = shop.name  || 'GEISTWERKS';
  const sInfo = [shop.address, shop.phone, shop.email, shop.website,
                  shop.license ? 'Lic# '+shop.license : ''].filter(Boolean).join('  ·  ');
  const footer = shop.footer || 'All work guaranteed 12 months / 12,000 miles.';

  const pi_saved   = inv.parts_items || [];
  const li_saved   = inv.labor_items || [];
  const taxableSub = pi_saved.filter(p => p.taxable !== false).reduce((s,p) => s+(p.total||0), 0)
                   + li_saved.filter(l => l.taxable === true).reduce((s,l) => s+(l.total||0), 0);
  const taxAmt = taxableSub * ((inv.tax||0) / 100);
  const stamp  = inv.status.toUpperCase();

  const partsRows = pi_saved.filter(p=>p.desc||p.total>0).map(p =>
    `<tr>
      <td>${p.desc}${p.taxable===false?' <span style="font-size:9px;color:#888">[EXEMPT]</span>':''}</td>
      <td style="text-align:center;width:34px">${p.qty}</td>
      <td style="text-align:right;width:60px">$${(p.unit||0).toFixed(2)}</td>
      <td style="text-align:right;width:60px">$${(p.total||0).toFixed(2)}</td>
      <td style="text-align:center;width:20px;font-size:9px;color:#555">${p.taxable!==false?'T':''}</td>
    </tr>`).join('') ||
    `<tr><td colspan="5" style="color:#999;font-style:italic;padding:4px 8px">— none —</td></tr>`;

  const ltypeLabels = {repair:'Repair',fab:'Fabrication',install_new:'Install (New)',hazmat:'Haz Waste'};
  const laborRows = li_saved.filter(l=>l.desc||l.total>0).map(l => `<tr>
      <td>${l.desc}<span style="font-size:9px;color:#888"> [${ltypeLabels[l.labor_type]||'Repair'}]</span></td>
      <td style="text-align:center;width:34px">${l.hours}</td>
      <td style="text-align:right;width:68px">$${(l.rate||0).toFixed(2)}/hr</td>
      <td style="text-align:right;width:60px">$${(l.total||0).toFixed(2)}</td>
      <td style="text-align:center;width:20px;font-size:9px;color:#555">${l.taxable?'T':''}</td>
    </tr>`).join('') ||
    `<tr><td colspan="5" style="color:#999;font-style:italic;padding:4px 8px">— none —</td></tr>`;

  function buildPage(copyLabel, includeSig) {
    const sigHtml = includeSig
      ? `<div class="rp-sig-row" style="grid-template-columns:2fr 1fr 1fr;margin-top:10px">
          <div class="rp-sig-col"><div class="rp-sig-line"></div><div class="rp-sig-label">Customer Signature</div></div>
          <div class="rp-sig-col"><div class="rp-sig-line"></div><div class="rp-sig-label">Date</div></div>
          <div class="rp-sig-col"><div class="rp-sig-line"></div><div class="rp-sig-label">Authorized By</div></div>
        </div>`
      : '<div style="height:6px"></div>';

    return `
  <div class="rp-copy-label">${copyLabel}</div>
  <div class="rp-header">
    <div class="rp-brand">
      <div class="rp-shop-name">${sName}</div>
      ${sInfo ? `<div class="rp-shop-info">${sInfo}</div>` : ''}
    </div>
    <div class="rp-doc-id">
      <div class="rp-doc-type">Invoice</div>
      <div class="rp-doc-num">#${inv.number}</div>
      <div class="rp-doc-meta">${inv.date||''}${wo ? '  ·  WO #'+wo.number : ''}</div>
      <div style="margin-top:6px"><span class="rp-stamp ${inv.status}">${stamp}</span></div>
    </div>
  </div>

  <div class="rp-info-row two-col">
    <div class="rp-info-col">
      <div class="rp-section-label">Bill To</div>
      <div class="rp-name">${cust ? cust.first+' '+cust.last : '—'}</div>
      ${cust?.phone   ? `<div class="rp-sub">${cust.phone}</div>` : ''}
      ${cust?.email   ? `<div class="rp-sub">${cust.email}</div>` : ''}
      ${cust?.address ? `<div class="rp-sub">${cust.address}</div>` : ''}
    </div>
    <div class="rp-info-col">
      <div class="rp-section-label">Vehicle</div>
      ${veh ? `
        <div class="rp-name">${veh.year} ${veh.make} ${veh.model}${veh.trim?' '+veh.trim:''}</div>
        ${veh.color ? `<div class="rp-sub">${veh.color}</div>` : ''}
        ${veh.plate ? `<div class="rp-sub">Plate: ${veh.plate}</div>` : ''}
        ${veh.vin   ? `<div class="rp-sub">VIN: ${veh.vin}</div>` : ''}
        ${wo?.mileageIn ? `<div class="rp-sub">Mileage In: ${parseInt(wo.mileageIn).toLocaleString()} mi</div>` : ''}
      ` : '<div class="rp-sub">—</div>'}
    </div>
  </div>

  ${wo ? `<div class="rp-block-label">Services Performed</div><div class="rp-block">${wo.description||'—'}</div>` : ''}

  <table class="rp-table">
    <thead>
      <tr class="rp-table-section"><td colspan="5">Parts &amp; Materials</td></tr>
      <tr><th style="width:100%">Description</th><th style="text-align:center;width:34px">Qty</th><th style="text-align:right;width:60px">Unit $</th><th style="text-align:right;width:60px">Total</th><th style="text-align:center;width:20px">T</th></tr>
    </thead>
    <tbody>${partsRows}</tbody>
  </table>

  <table class="rp-table" style="margin-top:6px">
    <thead>
      <tr class="rp-table-section"><td colspan="5">Labor</td></tr>
      <tr><th style="width:100%">Description</th><th style="text-align:center;width:34px">Hrs</th><th style="text-align:right;width:68px">Rate</th><th style="text-align:right;width:60px">Total</th><th style="text-align:center;width:20px">T</th></tr>
    </thead>
    <tbody>${laborRows}</tbody>
  </table>

  <div class="rp-clearfix">
    <div class="rp-totals">
      <div class="rp-total-row"><span>Parts</span><span>$${(inv.parts||0).toFixed(2)}</span></div>
      <div class="rp-total-row"><span>Labor</span><span>$${(inv.labor||0).toFixed(2)}</span></div>
      <div class="rp-total-row" style="font-size:9px;color:#666"><span>Taxable subtotal</span><span>$${taxableSub.toFixed(2)}</span></div>
      <div class="rp-total-row"><span>Tax (${inv.tax||0}%)</span><span>$${taxAmt.toFixed(2)}</span></div>
      ${inv.amount_paid > 0 ? `<div class="rp-total-row"><span>Paid</span><span>-$${(inv.amount_paid).toFixed(2)}</span></div>` : ''}
      <div class="rp-total-row grand"><span>TOTAL DUE</span><span>$${Math.max(0,(inv.total||0)-(inv.amount_paid||0)).toFixed(2)}</span></div>
    </div>
  </div>

  ${sigHtml}

  <div class="rp-footer">
    <div class="rp-footer-brand">${sName}</div>
    <div style="text-align:center;flex:1;padding:0 10px">${footer}</div>
    <div>Inv #${inv.number} · ${new Date().toLocaleDateString()}</div>
  </div>`;
  }

  return buildPage('Customer Copy', false) +
    '<div class="rp-page-break"></div>' +
    buildPage('Shop Copy', true);
}

function printInvoice(invoiceId) {
  const html = buildInvoiceHTML(invoiceId);
  if (!html) return;
  document.getElementById('receipt-print-area').innerHTML = html;
  window.print();
}

async function saveInvoicePDF(invoiceId) {
  const inv = DB.invoices.find(x => x.id === invoiceId); if (!inv) return;
  const cust = DB.customers.find(x => x.id === inv.customerId);
  const html = buildInvoiceHTML(invoiceId);
  if (!html) return;
  document.getElementById('receipt-print-area').innerHTML = html;
  const custName = cust ? (cust.last || cust.first) : 'Unknown';
  const filename = `Invoice-${inv.number}-${custName}.pdf`.replace(/\s+/g, '_');
  const result = await window.electronAPI.printToPDF(filename);
  if (!result.ok && result.error) toast('PDF save failed: ' + result.error);
}

// ─── WORK ORDER HTML BUILDER ───────────────────────────────────────────────
function buildWorkorderHTML(woId) {
  const wo   = DB.workorders.find(x => x.id === woId); if (!wo) return '';
  const cust = DB.customers.find(x => x.id === wo.customerId);
  const veh  = DB.vehicles.find(x => x.id === wo.vehicleId);
  const shop = DB.settings;
  const sName  = shop.name || 'GEISTWERKS';
  const sInfo  = [shop.address, shop.phone, shop.email].filter(Boolean).join('  ·  ');
  const footer = shop.footer || 'All work guaranteed 12 months / 12,000 miles.';
  const statusL = { open:'OPEN', inprogress:'IN PROGRESS', waiting:'WAITING — PARTS',
                    completed:'COMPLETED', estimate:'ESTIMATE' };
  const status = statusL[wo.status] || wo.status.toUpperCase();

  return `
  <div class="rp-header">
    <div class="rp-brand">
      <div class="rp-shop-name">${sName}</div>
      ${sInfo ? `<div class="rp-shop-info">${sInfo}</div>` : ''}
    </div>
    <div class="rp-doc-id">
      <div class="rp-doc-type">Work Order</div>
      <div class="rp-doc-num">#${wo.number}</div>
      <div class="rp-doc-meta">In: ${wo.dateIn||'—'}  ·  Due: ${wo.datePromise||'—'}</div>
      <div style="margin-top:6px"><span class="rp-stamp">${status}</span></div>
    </div>
  </div>

  <div class="rp-info-row two-col">
    <div class="rp-info-col">
      <div class="rp-section-label">Customer</div>
      <div class="rp-name">${cust ? cust.first+' '+cust.last : '—'}</div>
      ${cust?.phone ? `<div class="rp-sub">${cust.phone}</div>` : ''}
      ${cust?.email ? `<div class="rp-sub">${cust.email}</div>` : ''}
    </div>
    <div class="rp-info-col">
      <div class="rp-section-label">Vehicle</div>
      ${veh ? `
        <div class="rp-name">${veh.year} ${veh.make} ${veh.model}${veh.trim?' '+veh.trim:''}</div>
        ${veh.color  ? `<div class="rp-sub">${veh.color}</div>` : ''}
        ${veh.plate  ? `<div class="rp-sub">Plate: ${veh.plate}</div>` : ''}
        ${veh.vin    ? `<div class="rp-sub">VIN: ${veh.vin}</div>` : ''}
        ${veh.mileage? `<div class="rp-sub">Mileage In: ${parseInt(veh.mileage).toLocaleString()} mi</div>` : ''}
      ` : '<div class="rp-sub">—</div>'}
    </div>
  </div>

  <div class="rp-block-label">Description of Work</div>
  <div class="rp-block" style="min-height:48px">${wo.description || '—'}</div>

  ${(() => {
    const pi = wo.parts_items || [];
    const li = wo.labor_items || [];
    if (!pi.length && !li.length) return '';
    const piRows = pi.map(p => `<tr>
      <td style="width:16px;text-align:center">${p.done ? '&#x2612;' : '&#x2610;'}</td>
      <td>${p.desc}</td>
      <td style="text-align:center;width:36px">${p.qty}</td>
      <td style="text-align:right;width:64px">$${(p.total||0).toFixed(2)}</td>
    </tr>`).join('');
    const liRows = li.map(l => {
      const lt = {repair:'Repair',fab:'Fab',install_new:'Inst New',hazmat:'Haz'}[l.labor_type]||'Repair';
      return `<tr>
        <td style="width:16px;text-align:center">${l.done ? '&#x2612;' : '&#x2610;'}</td>
        <td>${l.desc} <span style="font-size:9px;color:#888">[${lt}]</span></td>
        <td style="text-align:center;width:36px">${l.hours}h</td>
        <td style="text-align:right;width:64px">$${(l.total||0).toFixed(2)}</td>
      </tr>`;
    }).join('');
    return `
    ${pi.length ? `
    <div class="rp-block-label">Parts &amp; Materials</div>
    <table class="rp-table" style="margin-bottom:8px">
      <thead><tr><th style="width:16px"></th><th>Description</th><th style="text-align:center;width:36px">Qty</th><th style="text-align:right;width:64px">Total</th></tr></thead>
      <tbody>${piRows}</tbody>
    </table>` : ''}
    ${li.length ? `
    <div class="rp-block-label">Labor</div>
    <table class="rp-table" style="margin-bottom:8px">
      <thead><tr><th style="width:16px"></th><th>Description</th><th style="text-align:center;width:36px">Hrs</th><th style="text-align:right;width:64px">Total</th></tr></thead>
      <tbody>${liRows}</tbody>
    </table>` : ''}`;
  })()}

  ${wo.notes ? `<div class="rp-block-label">Tech Notes</div><div class="rp-block" style="min-height:32px;color:#444">${wo.notes}</div>` : ''}

  <div class="rp-fields">
    <div class="rp-fields-row" style="grid-template-columns:1fr 1fr 1fr 1fr">
      <div class="rp-field">
        <div class="rp-field-label">Mileage In</div>
        <div style="font-size:11px;margin-top:4px">${wo.mileageIn ? parseInt(wo.mileageIn).toLocaleString()+' mi' : '—'}</div>
      </div>
      <div class="rp-field"><div class="rp-field-label">Mileage Out</div></div>
      <div class="rp-field">
        <div class="rp-field-label">Est. Cost</div>
        <div style="font-size:11px;margin-top:4px">$${(wo.cost||0).toFixed(2)}</div>
      </div>
      <div class="rp-field">
        <div class="rp-field-label">Technician</div>
        <div style="font-size:11px;margin-top:4px">${wo.tech||'—'}</div>
      </div>
    </div>
  </div>

  <div class="rp-sig-row" style="grid-template-columns:2fr 1fr 1fr;margin-top:10px">
    <div class="rp-sig-col"><div class="rp-sig-line"></div><div class="rp-sig-label">Customer Authorization</div></div>
    <div class="rp-sig-col"><div class="rp-sig-line"></div><div class="rp-sig-label">Date</div></div>
    <div class="rp-sig-col"><div class="rp-sig-line"></div><div class="rp-sig-label">Tech Sign-off</div></div>
  </div>

  <div class="rp-footer">
    <div class="rp-footer-brand">${sName}</div>
    <div style="text-align:center;flex:1;padding:0 10px">${footer}</div>
    <div>WO #${wo.number} · ${new Date().toLocaleDateString()}</div>
  </div>`;
}

function printWorkorder(woId) {
  const html = buildWorkorderHTML(woId);
  if (!html) return;
  document.getElementById('receipt-print-area').innerHTML = html;
  window.print();
}

async function saveWorkorderPDF(woId) {
  const wo = DB.workorders.find(x => x.id === woId); if (!wo) return;
  const html = buildWorkorderHTML(woId);
  if (!html) return;
  document.getElementById('receipt-print-area').innerHTML = html;
  const filename = `WorkOrder-${wo.number}.pdf`;
  const result = await window.electronAPI.printToPDF(filename);
  if (!result.ok && result.error) toast('PDF save failed: ' + result.error);
}

// ─── EXPENSES REPORT ────────────────────────────────────────────────────────
function buildExpensesReportHTML() {
  const shop   = DB.settings;
  const sName  = shop.name || 'GEISTWERKS';
  const sInfo  = [shop.address, shop.phone, shop.email].filter(Boolean).join('  ·  ');
  const expenses = DB.expenses;

  // Apply same filters as current view
  const f = expenses.filter(e => {
    const s = ((e.date||'')+' '+(e.vendor||'')+' '+(e.description||'')).toLowerCase();
    return (!expFilter || s.includes(expFilter))
        && (!expCF    || e.category === expCF)
        && (!expYF    || (e.date||'').startsWith(expYF));
  }).sort((a,b) => (a.date||'').localeCompare(b.date||''));

  const total = f.reduce((s,e) => s+(e.amount||0), 0);
  const filterNote = expYF ? ` — ${expYF}` : ' — All Time';

  // Monthly totals
  const byMonth = {};
  f.forEach(e => {
    const m = (e.date||'').slice(0,7);
    if (m) byMonth[m] = (byMonth[m]||0)+(e.amount||0);
  });
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyRows = Object.entries(byMonth).sort().map(([ym, amt]) => {
    const [y,mo] = ym.split('-');
    const label = `${monthNames[(parseInt(mo)||1)-1]} ${y}`;
    return `<tr><td>${label}</td><td style="text-align:right">$${amt.toFixed(2)}</td></tr>`;
  }).join('');

  // Category totals
  const byCat = {};
  f.forEach(e => { byCat[e.category||'other'] = (byCat[e.category||'other']||0)+(e.amount||0); });
  const CAT_LABELS = {supplies:'Supplies',tools:'Tools & Equip.',utilities:'Utilities',
    insurance:'Insurance',rent:'Rent / Lease',other:'Other'};
  const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt]) =>
    `<tr><td>${CAT_LABELS[cat]||cat}</td><td style="text-align:right">$${amt.toFixed(2)}</td></tr>`
  ).join('');

  // Line items
  const lineRows = f.map(e => `<tr>
    <td class="mono">${e.date||'—'}</td>
    <td>${escHtml(e.vendor||'—')}</td>
    <td>${escHtml(e.description||'—')}</td>
    <td style="font-size:9px">${(CAT_LABELS[e.category]||e.category||'—').toUpperCase()}</td>
    <td style="text-align:right">$${(e.amount||0).toFixed(2)}</td>
  </tr>`).join('');

  return `
  <div class="rp-header">
    <div class="rp-brand">
      <div class="rp-shop-name">${sName}</div>
      ${sInfo ? `<div class="rp-shop-info">${sInfo}</div>` : ''}
    </div>
    <div class="rp-doc-id">
      <div class="rp-doc-type">Expenses Report</div>
      <div class="rp-doc-meta">${filterNote.trim()}</div>
      <div class="rp-doc-meta">Generated ${new Date().toLocaleDateString()}</div>
    </div>
  </div>

  <div class="rp-info-row two-col" style="margin-bottom:10px">
    <div class="rp-info-col">
      <div class="rp-section-label">By Month</div>
      <table class="rp-table">
        <thead><tr><th>Month</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${monthlyRows || '<tr><td colspan="2" style="color:#999;font-style:italic">No data</td></tr>'}</tbody>
      </table>
    </div>
    <div class="rp-info-col">
      <div class="rp-section-label">By Category</div>
      <table class="rp-table">
        <thead><tr><th>Category</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${catRows || '<tr><td colspan="2" style="color:#999;font-style:italic">No data</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <div class="rp-block-label">Expense Detail</div>
  <table class="rp-table">
    <thead><tr><th>Date</th><th>Vendor</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${lineRows || '<tr><td colspan="5" style="color:#999;font-style:italic;padding:4px 8px">No expenses.</td></tr>'}
      <tr style="font-weight:600;border-top:2px solid #333">
        <td colspan="4" style="font-family:\'Share Tech Mono\',monospace;font-size:10px;letter-spacing:1px">TOTAL${filterNote}</td>
        <td style="text-align:right">$${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="rp-footer">
    <div class="rp-footer-brand">${sName}</div>
    <div style="text-align:center;flex:1;padding:0 10px">Expenses Report${filterNote}</div>
    <div>${new Date().toLocaleDateString()}</div>
  </div>`;
}

function printExpenses() {
  document.getElementById('receipt-print-area').innerHTML = buildExpensesReportHTML();
  window.print();
}

async function saveExpensesPDF() {
  document.getElementById('receipt-print-area').innerHTML = buildExpensesReportHTML();
  const label = expYF ? expYF : new Date().getFullYear().toString();
  const filename = `Expenses-${label}.pdf`;
  const result = await window.electronAPI.printToPDF(filename);
  if (!result.ok && result.error) toast('PDF save failed: ' + result.error);
}

// ─── PER-MONTH EXPENSES REPORT ─────────────────────────────────────────────
function buildMonthExpensesHTML(yearMonth) {
  const shop  = DB.settings;
  const sName = shop.name || 'GEISTWERKS';
  const sInfo = [shop.address, shop.phone, shop.email].filter(Boolean).join('  ·  ');

  const [y, mo] = yearMonth.split('-');
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const monthLabel = `${MONTH_NAMES[(parseInt(mo)||1)-1]} ${y}`;

  const f = DB.expenses
    .filter(e => (e.date||'').startsWith(yearMonth))
    .sort((a,b) => (a.date||'').localeCompare(b.date||''));

  const total = f.reduce((s,e) => s+(e.amount||0), 0);

  const CAT_LABELS = {supplies:'Supplies',tools:'Tools & Equip.',utilities:'Utilities',
    insurance:'Insurance',rent:'Rent / Lease',other:'Other'};

  const byCat = {};
  f.forEach(e => { byCat[e.category||'other'] = (byCat[e.category||'other']||0)+(e.amount||0); });
  const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt]) =>
    `<tr><td>${CAT_LABELS[cat]||cat}</td><td style="text-align:right">$${amt.toFixed(2)}</td></tr>`
  ).join('');

  const lineRows = f.map(e => `<tr>
    <td class="mono">${e.date||'—'}</td>
    <td>${escHtml(e.vendor||'—')}</td>
    <td>${escHtml(e.description||'—')}</td>
    <td style="font-size:9px">${(CAT_LABELS[e.category]||e.category||'—').toUpperCase()}</td>
    <td style="text-align:right">$${(e.amount||0).toFixed(2)}</td>
  </tr>`).join('');

  return `
  <div class="rp-header">
    <div class="rp-brand">
      <div class="rp-shop-name">${sName}</div>
      ${sInfo ? `<div class="rp-shop-info">${sInfo}</div>` : ''}
    </div>
    <div class="rp-doc-id">
      <div class="rp-doc-type">Expenses Report</div>
      <div class="rp-doc-meta">${monthLabel}</div>
      <div class="rp-doc-meta">Generated ${new Date().toLocaleDateString()}</div>
    </div>
  </div>

  <div class="rp-info-col" style="margin-bottom:10px">
    <div class="rp-section-label">By Category — ${monthLabel}</div>
    <table class="rp-table">
      <thead><tr><th>Category</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${catRows || '<tr><td colspan="2" style="color:#999;font-style:italic">No data</td></tr>'}</tbody>
    </table>
  </div>

  <div class="rp-block-label">Expense Detail — ${monthLabel}</div>
  <table class="rp-table">
    <thead><tr><th>Date</th><th>Vendor</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${lineRows || '<tr><td colspan="5" style="color:#999;font-style:italic;padding:4px 8px">No expenses.</td></tr>'}
      <tr style="font-weight:600;border-top:2px solid #333">
        <td colspan="4" style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1px">TOTAL — ${monthLabel}</td>
        <td style="text-align:right">$${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="rp-footer">
    <div class="rp-footer-brand">${sName}</div>
    <div style="text-align:center;flex:1;padding:0 10px">Expenses — ${monthLabel}</div>
    <div>${new Date().toLocaleDateString()}</div>
  </div>`;
}

function printMonthExpenses(yearMonth) {
  document.getElementById('receipt-print-area').innerHTML = buildMonthExpensesHTML(yearMonth);
  window.print();
}

async function saveMonthExpensesPDF(yearMonth) {
  document.getElementById('receipt-print-area').innerHTML = buildMonthExpensesHTML(yearMonth);
  const [y, mo] = yearMonth.split('-');
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = `${MONTH_NAMES[(parseInt(mo)||1)-1]}-${y}`;
  const filename = `Expenses-${label}.pdf`;
  const result = await window.electronAPI.printToPDF(filename);
  if (!result.ok && result.error) toast('PDF save failed: ' + result.error);
}
