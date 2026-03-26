'use strict';
// ─── CALENDAR ──────────────────────────────────────────

var calYear  = new Date().getFullYear();
var calMonth = new Date().getMonth();

var CAL_MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
var CAL_DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Event color map by type ───────────────────────────
var EV_TYPE_COLORS = {
  event:       'var(--hud)',
  reminder:    'var(--amber)',
  appointment: '#00b4d8',
  deadline:    'var(--red)'
};

// ── Collect all displayable events for a given month ─
function getCalEventsForMonth(year, month) {
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var prefix = year + '-' + pad(month + 1);

  var custom = (DB.calEvents || []).filter(function(e){ return (e.date||'').startsWith(prefix); });

  var woEvents = [];
  DB.workorders.forEach(function(w){
    if (w.status === 'completed') return;
    var c = DB.customers.find(function(x){ return x.id === w.customerId; });
    var v = DB.vehicles.find(function(x){ return x.id === w.vehicleId; });
    var pColor = w.priority === 'urgent' ? 'var(--red)' : w.priority === 'high' ? 'var(--amber)' : 'var(--hud)';
    var nameStr = (c ? ' — ' + c.last : '') + (v ? ' ' + v.make : '');
    // Intake event
    if (w.dateIn && (w.dateIn).startsWith(prefix)) {
      woEvents.push({
        id: 'wo-in-' + w.id,
        date: w.dateIn,
        title: 'INTAKE: WO #' + w.number + nameStr,
        color: '#00b4d8',
        type: 'workorder',
        woId: w.id
      });
    }
    // Due event
    if (w.datePromise && (w.datePromise).startsWith(prefix)) {
      woEvents.push({
        id: 'wo-' + w.id,
        date: w.datePromise,
        title: 'DUE: WO #' + w.number + nameStr,
        color: pColor,
        type: 'workorder',
        woId: w.id
      });
    }
  });

  return custom.concat(woEvents);
}

// Group by ISO date string
function groupByDate(events) {
  var map = {};
  events.forEach(function(e){
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  });
  return map;
}

// ── Full calendar render ──────────────────────────────
function renderCalendar() {
  var container = document.getElementById('cal-grid');
  if (!container) return;

  var todayStr = new Date().toISOString().split('T')[0];
  var lbl = document.getElementById('cal-month-label');
  if (lbl) lbl.textContent = CAL_MONTHS[calMonth] + ' ' + calYear;

  var allEvents = getCalEventsForMonth(calYear, calMonth);
  var byDate    = groupByDate(allEvents);

  var firstDay    = new Date(calYear, calMonth, 1).getDay();
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  var pad = function(n){ return String(n).padStart(2,'0'); };

  var cells = '';

  // Day-of-week headers
  CAL_DAYS_SHORT.forEach(function(d){
    cells += '<div class="cal-day-header">' + d + '</div>';
  });

  // Leading days from previous month
  for (var i = firstDay - 1; i >= 0; i--) {
    cells += '<div class="cal-cell cal-other-month"><span class="cal-day-num">' + (daysInPrev - i) + '</span></div>';
  }

  // Current month
  for (var d = 1; d <= daysInMonth; d++) {
    var iso     = calYear + '-' + pad(calMonth + 1) + '-' + pad(d);
    var isToday = iso === todayStr;
    var evs     = byDate[iso] || [];

    var bubbles = evs.slice(0, 3).map(function(e){
      return '<div class="cal-event-bubble" style="background:' + (e.color || 'var(--hud)') + '" ' +
        'onclick="event.stopPropagation();calEventClick(\'' + e.id + '\',\'' + iso + '\')" ' +
        'title="' + escHtml(e.title) + '">' + escHtml(e.title) + '</div>';
    }).join('');

    var more = evs.length > 3 ? '<div class="cal-event-more">+' + (evs.length - 3) + ' more</div>' : '';

    cells += '<div class="cal-cell' + (isToday ? ' cal-today' : '') + '" onclick="calDayClick(\'' + iso + '\')">' +
      '<span class="cal-day-num' + (isToday ? ' today' : '') + '">' + d + '</span>' +
      bubbles + more +
      '</div>';
  }

  // Trailing filler
  var totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for (var t = 1; t <= totalCells - firstDay - daysInMonth; t++) {
    cells += '<div class="cal-cell cal-other-month"><span class="cal-day-num">' + t + '</span></div>';
  }

  container.innerHTML = cells;

  // Event count label
  var countEl = document.getElementById('cal-event-count');
  if (countEl) countEl.textContent = (DB.calEvents || []).length + ' event' + ((DB.calEvents||[]).length !== 1 ? 's' : '');

  _loadAppleSyncCheckbox();
}

function calPrevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}
function calNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}
function calToday() {
  var n = new Date();
  calYear = n.getFullYear(); calMonth = n.getMonth();
  renderCalendar();
}
function calGoTo(year, month) {
  calYear = year; calMonth = month;
  renderCalendar();
}

function calDayClick(dateStr) {
  openModal('event');
  setTimeout(function(){
    var el = document.getElementById('ev-date');
    if (el) el.value = dateStr;
  }, 30);
}

function calEventClick(eventId, dateStr) {
  if (eventId.startsWith('wo-in-')) {
    openModal('workorder', eventId.replace('wo-in-', ''));
    return;
  }
  if (eventId.startsWith('wo-')) {
    openModal('workorder', eventId.replace('wo-', ''));
    return;
  }
  openModal('event', eventId);
}

// ── Mini calendar (dashboard widget) ─────────────────
function renderMiniCalendar() {
  var container = document.getElementById('dash-mini-cal');
  if (!container) return;

  var now      = new Date();
  var todayStr = now.toISOString().split('T')[0];
  var year     = now.getFullYear();
  var month    = now.getMonth();
  var pad = function(n){ return String(n).padStart(2,'0'); };

  var lbl = document.getElementById('dash-mini-cal-label');
  if (lbl) lbl.textContent = CAL_MONTHS[month] + ' ' + year;

  var firstDay    = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var allEvents   = getCalEventsForMonth(year, month);

  // Map date → array of event colors (up to 3)
  var dotMap = {};
  allEvents.forEach(function(e){
    if (!dotMap[e.date]) dotMap[e.date] = [];
    if (dotMap[e.date].length < 3) dotMap[e.date].push(e.color || 'var(--hud)');
  });

  var html = '';
  CAL_DAYS_SHORT.forEach(function(d){ html += '<div class="mcal-hdr">' + d[0] + '</div>'; });

  for (var i = 0; i < firstDay; i++) html += '<div class="mcal-cell mcal-empty"></div>';

  for (var d = 1; d <= daysInMonth; d++) {
    var iso     = year + '-' + pad(month + 1) + '-' + pad(d);
    var isToday = iso === todayStr;
    var colors  = dotMap[iso] || [];
    var dotsHtml = colors.length
      ? '<div class="mcal-dots">' + colors.map(function(c){ return '<span class="mcal-dot" style="background:'+c+'"></span>'; }).join('') + '</div>'
      : '';
    html += '<div class="mcal-cell' + (isToday ? ' mcal-today' : '') + '" ' +
      'onclick="showView(\'calendar\');calGoTo(' + year + ',' + month + ')" title="' + iso + '">' +
      '<span class="mcal-day-num">' + d + '</span>' + dotsHtml + '</div>';
  }

  container.innerHTML = html;

  // Upcoming list — next 14 days across all months
  var upcoming = document.getElementById('dash-upcoming');
  if (!upcoming) return;

  var todayDate = new Date(todayStr + 'T00:00:00');
  var cutoff    = new Date(todayDate); cutoff.setDate(cutoff.getDate() + 14);
  var cutoffStr = cutoff.toISOString().split('T')[0];

  // Gather events from this month + next month
  var pool = getCalEventsForMonth(year, month)
    .concat(getCalEventsForMonth(month === 11 ? year + 1 : year, (month + 1) % 12));

  var inRange = pool
    .filter(function(e){ return e.date >= todayStr && e.date <= cutoffStr; })
    .sort(function(a,b){ return a.date.localeCompare(b.date); })
    .slice(0, 6);

  if (!inRange.length) {
    upcoming.innerHTML = '<div style="padding:10px 0;color:var(--text3);font-size:11px;font-family:\'Share Tech Mono\',monospace">No upcoming events</div>';
    return;
  }

  upcoming.innerHTML = inRange.map(function(e){
    var d   = new Date(e.date + 'T00:00:00');
    var lbl = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
    var ey  = d.getFullYear(), em = d.getMonth();
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);cursor:pointer" ' +
      'onclick="showView(\'calendar\');calGoTo(' + ey + ',' + em + ')">' +
      '<span style="width:3px;height:28px;border-radius:2px;background:' + (e.color || 'var(--hud)') + ';flex-shrink:0"></span>' +
      '<div>' +
        '<div style="font-size:10px;color:var(--text3);font-family:\'Share Tech Mono\',monospace">' + lbl + '</div>' +
        '<div style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">' + escHtml(e.title) + '</div>' +
      '</div></div>';
  }).join('');
}

// ── Apple Calendar sync ───────────────────────────────
async function syncEventToApple(eventId) {
  if (!window.electronAPI || !window.electronAPI.appleCalSync) {
    toast('Apple Calendar sync not available', true); return;
  }
  var ev = (DB.calEvents || []).find(function(e){ return e.id === eventId; });
  if (!ev) { toast('Event not found', true); return; }

  toast('Syncing to Apple Calendar…');
  var result = await window.electronAPI.appleCalSync(ev);
  if (result.ok && result.uid) {
    ev.appleUid = result.uid;
    upsert('calEvents', ev);
    toast('Synced to Apple Calendar ✓');
  } else {
    toast('Sync failed: ' + (result.error || 'check Calendar permissions'), true);
  }
}

async function syncAllToApple() {
  if (!window.electronAPI || !window.electronAPI.appleCalSync) {
    toast('Apple Calendar sync not available', true); return;
  }
  var count = 0;

  // Step 1: Remove Apple Calendar events for completed/deleted WOs
  var wos = DB.workorders || [];
  for (var k = 0; k < wos.length; k++) {
    var wk = wos[k];
    if (wk.status !== 'completed') continue;
    var woChanged = false;
    if (wk.appleUidIn) {
      await window.electronAPI.appleCalRemove(wk.appleUidIn);
      wk.appleUidIn = null; woChanged = true;
    }
    if (wk.appleUidDue) {
      await window.electronAPI.appleCalRemove(wk.appleUidDue);
      wk.appleUidDue = null; woChanged = true;
    }
    if (woChanged) upsert('workorders', wk);
  }

  // Step 2: Sync custom cal events
  var events = DB.calEvents || [];
  for (var i = 0; i < events.length; i++) {
    var result = await window.electronAPI.appleCalSync(events[i]);
    if (result.ok && result.uid) {
      events[i].appleUid = result.uid;
      upsert('calEvents', events[i]);
      count++;
    }
  }

  // Step 3: Sync active WO intake + due events
  for (var j = 0; j < wos.length; j++) {
    var w = wos[j];
    if (w.status === 'completed') continue;
    var c = DB.customers.find(function(x){ return x.id === w.customerId; });
    var v = DB.vehicles.find(function(x){ return x.id === w.vehicleId; });
    var nameStr = (c ? c.first + ' ' + c.last : 'Customer') + (v ? ' — ' + v.year + ' ' + v.make : '');
    var changed = false;

    if (w.dateIn) {
      var inEv = { title: 'Intake: WO #' + w.number + ' ' + nameStr,
                   date: w.dateIn, notes: w.description || '', type: 'deadline',
                   appleUid: w.appleUidIn || null };
      var r1 = await window.electronAPI.appleCalSync(inEv);
      if (r1.ok && r1.uid) { w.appleUidIn = r1.uid; changed = true; count++; }
    }
    if (w.datePromise) {
      var dueEv = { title: 'Due: WO #' + w.number + ' ' + nameStr,
                    date: w.datePromise, notes: w.description || '', type: 'deadline',
                    appleUid: w.appleUidDue || null };
      var r2 = await window.electronAPI.appleCalSync(dueEv);
      if (r2.ok && r2.uid) { w.appleUidDue = r2.uid; changed = true; count++; }
    }
    if (changed) upsert('workorders', w);
  }

  toast('Synced ' + count + ' event' + (count !== 1 ? 's' : '') + ' to Apple Calendar');
  renderCalendar();
}

// ── Apple sync checkbox toggle ────────────────────────
function onAppleSyncToggle(checked) {
  var s = DB.settings;
  s.appleCalSync = checked;
  DB.settings = s;
  if (checked) {
    toast('Apple Calendar sync enabled — syncing…');
    syncAllToApple();
  } else {
    toast('Apple Calendar sync disabled');
  }
}

function _loadAppleSyncCheckbox() {
  var cb = document.getElementById('apple-sync-cb');
  if (cb) cb.checked = !!(DB.settings.appleCalSync);
}

// ── Dashboard drag-and-drop widget layout ─────────────
var _DEFAULT_LAYOUT = [
  {id:'w-stat-open-wo'}, {id:'w-stat-completed'}, {id:'w-stat-customers'},
  {id:'w-stat-revenue'}, {id:'w-stat-expenses'},
  {id:'calendar'}, {id:'jobs'}, {id:'chart'}
];
var _dragWidget = null;
var _dashEditMode = false;

function initDashboard() {
  restoreDashboardLayout();
  initDragDrop();
}

function restoreDashboardLayout() {
  var saved = DB.settings.dashboardLayout;
  // Normalize: old format was array of strings, new format is [{id, size}]
  var layout = saved
    ? saved.map(function(item){ return typeof item === 'string' ? {id:item} : item; })
    : _DEFAULT_LAYOUT;

  var container = document.getElementById('dash-widgets');
  if (!container) return;
  var widgets = {};
  container.querySelectorAll('.dash-widget').forEach(function(w){
    widgets[w.dataset.widget] = w;
  });
  layout.forEach(function(item){
    var w = widgets[item.id];
    if (!w) return;
    if (item.size) w.dataset.size = item.size;
    container.appendChild(w);
  });
  // Append any new widgets not in saved layout
  Object.keys(widgets).forEach(function(id){
    var found = layout.some(function(item){ return item.id === id; });
    if (!found) container.appendChild(widgets[id]);
  });
}

function saveDashboardLayout() {
  var container = document.getElementById('dash-widgets');
  if (!container) return;
  var layout = [];
  container.querySelectorAll('.dash-widget').forEach(function(w){
    var item = {id: w.dataset.widget};
    if (w.dataset.size) item.size = w.dataset.size;
    layout.push(item);
  });
  var s = DB.settings;
  s.dashboardLayout = layout;
  DB.settings = s;
}

function toggleDashEditMode() {
  var container = document.getElementById('dash-widgets');
  var btn = document.getElementById('dash-edit-btn');
  if (!container) return;
  _dashEditMode = !_dashEditMode;
  container.classList.toggle('dash-edit-mode', _dashEditMode);
  if (btn) btn.classList.toggle('active', _dashEditMode);
  // Enable/disable draggable on all widgets
  container.querySelectorAll('.dash-widget').forEach(function(w){
    w.draggable = _dashEditMode;
  });
  if (!_dashEditMode) saveDashboardLayout();
}

function cycleWidgetSize(widget) {
  if (!widget) return;
  var sizes = ['', 'half', 'third'];
  var current = widget.dataset.size || '';
  var idx = sizes.indexOf(current);
  var next = sizes[(idx + 1) % sizes.length];
  if (next) widget.dataset.size = next;
  else delete widget.dataset.size;
  // Update the resize button label
  var btn = widget.querySelector('.widget-resize-btn');
  if (btn) {
    var labels = {'':'FULL', 'half':'HALF', 'third':'THIRD'};
    btn.textContent = '⊡ ' + (labels[next] || 'FULL');
  }
  saveDashboardLayout();
}

function initDragDrop() {
  var container = document.getElementById('dash-widgets');
  if (!container) return;

  container.addEventListener('dragstart', function(e){
    if (!_dashEditMode) { e.preventDefault(); return; }
    var w = e.target.closest('.dash-widget');
    if (!w) return;
    _dragWidget = w;
    w.classList.add('widget-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', w.dataset.widget);
  });

  container.addEventListener('dragend', function(e){
    var w = e.target.closest('.dash-widget');
    if (w) w.classList.remove('widget-dragging');
    container.querySelectorAll('.dash-widget').forEach(function(x){
      x.classList.remove('widget-drag-over-top', 'widget-drag-over-bot');
    });
    _dragWidget = null;
    if (_dashEditMode) saveDashboardLayout();
  });

  container.addEventListener('dragover', function(e){
    if (!_dashEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var target = e.target.closest('.dash-widget');
    if (!target || target === _dragWidget) return;
    container.querySelectorAll('.dash-widget').forEach(function(x){
      x.classList.remove('widget-drag-over-top', 'widget-drag-over-bot');
    });
    var rect = target.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      target.classList.add('widget-drag-over-top');
    } else {
      target.classList.add('widget-drag-over-bot');
    }
  });

  container.addEventListener('dragleave', function(e){
    var related = e.relatedTarget;
    if (!container.contains(related)) {
      container.querySelectorAll('.dash-widget').forEach(function(x){
        x.classList.remove('widget-drag-over-top', 'widget-drag-over-bot');
      });
    }
  });

  container.addEventListener('drop', function(e){
    if (!_dashEditMode) return;
    e.preventDefault();
    var target = e.target.closest('.dash-widget');
    if (!target || !_dragWidget || target === _dragWidget) return;
    var rect = target.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      container.insertBefore(_dragWidget, target);
    } else {
      container.insertBefore(_dragWidget, target.nextSibling);
    }
    container.querySelectorAll('.dash-widget').forEach(function(x){
      x.classList.remove('widget-drag-over-top', 'widget-drag-over-bot');
    });
  });
}
