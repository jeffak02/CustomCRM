'use strict';
// ─── DASHBOARD CHARTS — interactive line graphs ────────
let activeChartTab  = 'revenue';
let activeChartRange = 180; // days

// ── Slider: log-scale 0–100 → 7–730 days ─────────────
// Snaps to natural stops: 7 14 30 60 90 180 365 730
const SNAP_DAYS = [7, 14, 30, 60, 90, 180, 365, 730];
const LOG_MIN   = Math.log(7), LOG_MAX = Math.log(730);

function sliderToDays(pos) {
  const raw = Math.exp(LOG_MIN + (pos / 100) * (LOG_MAX - LOG_MIN));
  // Snap to nearest preset within 12% of raw value
  let best = Math.round(raw), bestDist = Infinity;
  for (const s of SNAP_DAYS) {
    const dist = Math.abs(raw - s);
    if (dist < bestDist) { bestDist = dist; best = s; }
  }
  return bestDist < raw * 0.12 ? best : Math.round(raw);
}

function daysToSlider(days) {
  return Math.round(((Math.log(days) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100);
}

function daysLabel(d) {
  if (d < 14)        return d + 'd';
  else if (d <= 14)  return '2 weeks';
  else if (d <= 31)  return '1 month';
  else if (d <= 62)  return '2 months';
  else if (d <= 91)  return '3 months';
  else if (d <= 182) return '6 months';
  else if (d <= 366) return '1 year';
  else               return '2 years';
}

function setChartTab(tab) {
  activeChartTab = tab;
  document.querySelectorAll('.chart-tab[id^="tab-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  renderChart();
}

function onRangeSlider(sliderPos) {
  activeChartRange = sliderToDays(parseInt(sliderPos));
  updateSliderLabel();
  renderChart();
}

function updateSliderLabel() {
  const el = document.getElementById('range-label-current');
  if (el) el.textContent = daysLabel(activeChartRange);
}

// Day buckets for ≤90 days, month buckets for longer
function getBuckets(totalDays) {
  const now    = new Date();
  const useDay = totalDays <= 90;
  const out    = [];

  if (useDay) {
    // Daily granularity with smart label density
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      // Label every day (≤14), every 7 days, first, last
      const showLabel = totalDays <= 14 || i === totalDays - 1 || i === 0 || i % 7 === 0;
      const label = showLabel
        ? d.toLocaleString('default', { month: 'short', day: 'numeric' })
        : '';
      out.push({ type: 'day', iso, label });
    }
  } else {
    const months = Math.round(totalDays / 30.5);
    for (let i = months - 1; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const lbl = months <= 13
        ? d.toLocaleString('default', { month: 'short' })
        : d.toLocaleString('default', { month: 'short' }) + '\'' + String(d.getFullYear()).slice(2);
      out.push({ type: 'month', month: d.getMonth(), year: d.getFullYear(), label: lbl });
    }
  }
  return out;
}

function matchBucket(dateStr, bucket) {
  if (!dateStr) return false;
  if (bucket.type === 'day') return dateStr.slice(0,10) === bucket.iso;
  const d = new Date(dateStr);
  return d.getMonth() === bucket.month && d.getFullYear() === bucket.year;
}

function renderChart() {
  const invoices   = DB.invoices;
  const workorders = DB.workorders;
  const n          = activeChartRange;
  const buckets    = getBuckets(n);
  let data, stroke, fill, fmtVal, label;

  if (activeChartTab === 'revenue') {
    data = buckets.map(b => ({
      label: b.label,
      value: invoices.filter(i => {
        const d = new Date(i.date || '');
        return i.status === 'paid' && matchBucket(i.date || '', b);
      }).reduce((s, i) => s + (i.total || 0), 0)
    }));
    stroke = '#cc1e1e'; fill = 'rgba(204,30,30,0.12)';
    fmtVal = v => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0));
    label  = 'Revenue';

  } else if (activeChartTab === 'jobs') {
    data = buckets.map(b => ({
      label: b.label,
      value: workorders.filter(w => {
        const d = new Date(w.dateIn || w.createdAt || '');
        return matchBucket((w.dateIn || w.createdAt || '').split('T')[0], b);
      }).length
    }));
    stroke = '#00b4d8'; fill = 'rgba(0,180,216,0.1)';
    fmtVal = v => v + (v === 1 ? ' job' : ' jobs');
    label  = 'Jobs';

  } else {
    data = buckets.map(b => ({
      label: b.label,
      value: invoices.filter(i => {
        const d = new Date(i.date || '');
        return (i.status === 'unpaid' || i.status === 'partial')
          && matchBucket(i.date || '', b);
      }).reduce((s, i) => s + Math.max(0, (i.total||0) - (i.amount_paid||0)), 0)
    }));
    stroke = '#e8a020'; fill = 'rgba(232,160,32,0.1)';
    fmtVal = v => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0));
    label  = 'Outstanding';
  }

  const area = document.getElementById('chart-area');
  if (!area) return;

  const W   = area.clientWidth || 640;
  const H   = 190;
  const pad = { top: 20, right: 24, bottom: 36, left: 56 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);

  // Pixel coords for each point
  const pts = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * cW,
    y: pad.top  + cH - (d.value / maxVal) * cH,
    value: d.value,
    label: d.label,
    fmt:   fmtVal(d.value)
  }));

  // Y grid lines + labels
  const yTicks = 4;
  let grid = '', yLabels = '';
  for (let i = 0; i <= yTicks; i++) {
    const y   = pad.top + cH - (i / yTicks) * cH;
    const v   = (i / yTicks) * maxVal;
    const lbl = activeChartTab === 'jobs' ? Math.round(v)
              : (v >= 1000 ? '$'+(v/1000).toFixed(1)+'k' : '$'+Math.round(v));
    grid    += `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${pad.left+cW}" y2="${y.toFixed(1)}"
                  stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`;
    yLabels += `<text x="${pad.left-8}" y="${(y+4).toFixed(1)}" text-anchor="end"
                  fill="#444" font-size="9" font-family="monospace">${lbl}</text>`;
  }

  // X axis labels — only show non-empty labels (daily mode uses sparse labels)
  let xLabels = '';
  pts.forEach((p, i) => {
    if (data[i].label) {
      xLabels += `<text x="${p.x.toFixed(1)}" y="${(pad.top+cH+18).toFixed(1)}"
        text-anchor="middle" fill="#444" font-size="9" font-family="monospace">${data[i].label}</text>`;
    }
  });

  // Smooth bezier path
  function bezierPath(points) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i], p1 = points[i+1];
      const cpx = (p0.x + p1.x) / 2;
      d += ` C ${cpx.toFixed(2)} ${p0.y.toFixed(2)}, ${cpx.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    }
    return d;
  }

  const linePath = bezierPath(pts);

  // Area fill path (close at bottom)
  const last  = pts[pts.length - 1];
  const first = pts[0];
  const areaPath = linePath
    + ` L ${last.x.toFixed(2)} ${(pad.top+cH).toFixed(2)}`
    + ` L ${first.x.toFixed(2)} ${(pad.top+cH).toFixed(2)} Z`;

  // Dots + invisible hit targets
  let dots = '', hits = '';
  pts.forEach((p, i) => {
    const hasDot = data[i].value > 0;
    if (hasDot) {
      dots += `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3.5"
        fill="${stroke}" stroke="var(--bg)" stroke-width="2"/>`;
    }
    hits += `<rect x="${(p.x-16).toFixed(2)}" y="${pad.top}" width="32" height="${cH}"
      fill="transparent" style="cursor:crosshair"
      onmouseenter="showChartTip(event,'${data[i].label}: ${p.fmt}')"
      onmouseleave="hideChartTip()"/>`;
    // Vertical hover line stored as data attr — drawn via CSS :hover trick
  });

  const svgId = 'chart-svg-' + Date.now();
  area.innerHTML = `
    <div class="chart-tooltip" id="chart-tooltip"></div>
    <svg id="${svgId}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
         style="width:100%;height:${H}px;display:block">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top+cH}"
        stroke="#1a2a1a" stroke-width="1"/>
      <line x1="${pad.left}" y1="${pad.top+cH}" x2="${pad.left+cW}" y2="${pad.top+cH}"
        stroke="#1a2a1a" stroke-width="1"/>
      ${yLabels}${xLabels}
      <path d="${areaPath}" fill="url(#lg)" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${hits}
    </svg>`;
}

function showChartTip(e, text) {
  const tip = document.getElementById('chart-tooltip');
  if (!tip) return;
  tip.textContent = text;
  tip.style.display = 'block';
  const area = document.getElementById('chart-area');
  const r = area.getBoundingClientRect();
  let lx = e.clientX - r.left + 14;
  if (lx + 160 > r.width) lx = e.clientX - r.left - 154;
  tip.style.left = lx + 'px';
  tip.style.top  = (e.clientY - r.top - 36) + 'px';
}

function hideChartTip() {
  const tip = document.getElementById('chart-tooltip');
  if (tip) tip.style.display = 'none';
}

// ─── DASHBOARD JOB BOARD ──────────────────────────────
let activeJobFilter = 'active';

function setJobFilter(f) {
  activeJobFilter = f;
  document.querySelectorAll('#dash-job-filters .chart-tab').forEach(b => b.classList.remove('active'));
  const idx = ['active','all','waiting','urgent'].indexOf(f);
  const btns = document.querySelectorAll('#dash-job-filters .chart-tab');
  if (btns[idx]) btns[idx].classList.add('active');
  renderJobBoard();
}

function renderJobBoard() {
  const customers  = DB.customers;
  const workorders = DB.workorders;
  const vehicles   = DB.vehicles;
  const invoices   = DB.invoices;
  const now = new Date();

  // Filter by tab
  let jobs = workorders.filter(w => {
    if (activeJobFilter === 'active')  return ['open','inprogress'].includes(w.status);
    if (activeJobFilter === 'waiting') return w.status === 'waiting';
    if (activeJobFilter === 'urgent')  return ['urgent','high'].includes(w.priority||'normal') && w.status !== 'completed';
    // 'all' = everything not completed
    return w.status !== 'completed';
  });

  // Sort: urgent first, then high, then by number desc
  const pOrder = {urgent:0, high:1, normal:2, low:3};
  jobs = jobs.sort((a,b) => {
    const pd = (pOrder[a.priority||'normal']||2) - (pOrder[b.priority||'normal']||2);
    return pd !== 0 ? pd : b.number - a.number;
  });

  const board = document.getElementById('dash-jobs-board');
  if (!board) return;
  if (!jobs.length) {
    board.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-icon">—</div><p>No jobs match this filter</p></div>';
    return;
  }

  board.innerHTML = jobs.map(w => {
    const c   = customers.find(x => x.id === w.customerId);
    const v   = vehicles.find(x => x.id === w.vehicleId);
    const pri = w.priority || 'normal';

    // Due date formatting
    let dueDisplay = '—', dueClass = '';
    if (w.datePromise) {
      const due = new Date(w.datePromise + 'T00:00:00');
      const diffDays = Math.ceil((due - now) / 86400000);
      if (diffDays < 0)       { dueDisplay = `${Math.abs(diffDays)}d OVERDUE`; dueClass = 'overdue'; }
      else if (diffDays === 0){ dueDisplay = 'TODAY';  dueClass = 'overdue'; }
      else if (diffDays <= 2) { dueDisplay = `${diffDays}d`;  dueClass = 'due-soon'; }
      else                    { dueDisplay = w.datePromise.slice(5); }
    }

    // Outstanding invoice amount
    const inv = invoices.find(i => i.workorderId === w.id);
    const invBadge = inv
      ? (inv.status === 'paid'
          ? `<span style="font-size:9px;color:var(--hud);letter-spacing:1px">INVOICED</span>`
          : `<span style="font-size:9px;color:var(--amber);letter-spacing:1px">$${(inv.total||0).toFixed(0)} OWED</span>`)
      : '';

    const partsBadge = ''; // parts shown inline via labor items

    return `<div class="job-card" onclick="openWOPreview('${w.id}')">
      <div class="job-priority-bar ${pri}"></div>
      <div class="job-body">
        <div>
          <div class="job-vehicle">${v ? v.year+' '+v.make+' '+v.model : 'No vehicle'}</div>
          <div class="job-vehicle-sub">${c ? c.first.toUpperCase()+' '+c.last.toUpperCase() : '—'} &nbsp;|&nbsp; WO #${w.number}</div>
          ${c?.phone ? `<div class="job-vehicle-sub">${c.phone}</div>` : ''}
        </div>
        <div>
          <div class="job-desc">${w.description}</div>
          ${(() => {
            const li = w.labor_items || [];
            if (!li.length) return '';
            const done = li.filter(l=>l.done).length;
            const pct  = Math.round(done/li.length*100);
            const items = li.slice(0,3).map(l =>
              `<div style="display:flex;align-items:center;gap:5px;padding:2px 0">
                <span style="font-size:10px;color:${l.done?'var(--hud-dim)':'var(--hud)'};opacity:${l.done?0.4:1};${l.done?'text-decoration:line-through':''};font-family:Share Tech Mono,monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:180px">${l.done?'✓ ':'○ '}${l.desc}</span>
              </div>`).join('');
            const more = li.length > 3 ? `<div style="font-size:9px;color:var(--text3);margin-top:2px">+${li.length-3} more</div>` : '';
            return `<div style="margin-top:5px;border-top:1px solid rgba(57,255,20,0.1);padding-top:5px">
              ${items}${more}
              ${li.length>1?`<div style="margin-top:4px;height:2px;background:var(--surface3);border-radius:1px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${pct===100?'var(--hud)':'var(--hud-dim)'};border-radius:1px"></div></div>`:''}
            </div>`;
          })()}
        </div>
        <div class="job-meta-col">
          <span class="job-meta-label">Status</span>
          ${statusBadge(w.status)}
        </div>
        <div class="job-meta-col">
          <span class="job-meta-label">Due</span>
          <span class="job-meta-val ${dueClass}">${dueDisplay}</span>
          ${w.tech ? `<span class="job-meta-val tech">${w.tech}</span>` : ''}
        </div>
        <div class="job-meta-col">
          <span class="job-meta-label">Est. Cost</span>
          <span class="job-meta-val">$${(w.cost||0).toFixed(0)}</span>
          ${invBadge}
        </div>
        <div class="job-actions" onclick="event.stopPropagation()">
          <button class="action-btn prnt" onclick="printWorkorder('${w.id}')">Print</button>
          <button class="action-btn" onclick="newInvoiceFromWO('${w.id}')" style="border-color:#28c76f;color:#28c76f">Invoice</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderDashboard() {
  const customers=DB.customers, workorders=DB.workorders, invoices=DB.invoices, expenses=DB.expenses;
  const now=new Date(), mm=now.getMonth(), yy=now.getFullYear();
  const openWO  = workorders.filter(w => ['open','inprogress','waiting'].includes(w.status)).length;
  const estimates = workorders.filter(w => w.status === 'estimate').length;
  const done    = workorders.filter(w => {
    if (w.status !== 'completed') return false;
    const d = new Date(w.dateIn || w.createdAt);
    return d.getMonth() === mm && d.getFullYear() === yy;
  }).length;
  const rev = invoices.filter(i => {
    if (i.status !== 'paid') return false;
    const d = new Date(i.date || '');
    return d.getMonth() === mm && d.getFullYear() === yy;
  }).reduce((s, i) => s + (i.total || 0), 0);
  const exp = expenses.filter(e => {
    const d = new Date(e.date || '');
    return d.getMonth() === mm && d.getFullYear() === yy;
  }).reduce((s, e) => s + (e.amount || 0), 0);

  document.getElementById('stat-open-wo').textContent   = openWO;
  document.getElementById('stat-completed').textContent = done;
  document.getElementById('stat-customers').textContent = customers.length;
  document.getElementById('stat-revenue').textContent   = '$' + rev.toFixed(0);
  document.getElementById('stat-expenses').textContent  = '$' + exp.toFixed(0);

  // Update sub-text on stat cards with more context
  const subOpen = document.querySelector('#stat-open-wo')?.closest('.stat-card')?.querySelector('.stat-sub');
  if (subOpen) subOpen.textContent = estimates > 0 ? `+ ${estimates} estimate${estimates>1?'s':''}` : 'Active jobs';

  renderJobBoard();
  renderChart();
  renderMiniCalendar();
}

