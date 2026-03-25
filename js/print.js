'use strict';
// ─── PRINTING ──────────────────────────────────────────
function printInvoice(invoiceId) {
  const inv   = DB.invoices.find(x => x.id === invoiceId); if (!inv) return;
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

  // Build a self-contained page block used for both copies
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

  document.getElementById('receipt-print-area').innerHTML =
    buildPage('Customer Copy', false) +
    '<div class="rp-page-break"></div>' +
    buildPage('Shop Copy', true);

  window.print();
}

function printWorkorder(woId) {
  const wo   = DB.workorders.find(x => x.id === woId); if (!wo) return;
  const cust = DB.customers.find(x => x.id === wo.customerId);
  const veh  = DB.vehicles.find(x => x.id === wo.vehicleId);
  const shop = DB.settings;
  const sName  = shop.name || 'GEISTWERKS';
  const sInfo  = [shop.address, shop.phone, shop.email].filter(Boolean).join('  ·  ');
  const footer = shop.footer || 'All work guaranteed 12 months / 12,000 miles.';
  const statusL = { open:'OPEN', inprogress:'IN PROGRESS', waiting:'WAITING — PARTS',
                    completed:'COMPLETED', estimate:'ESTIMATE' };
  const status = statusL[wo.status] || wo.status.toUpperCase();

  document.getElementById('receipt-print-area').innerHTML = `
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

  window.print();
}

