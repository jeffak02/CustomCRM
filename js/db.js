'use strict';
// All data lives in GeistWerks.app/Contents/Resources/data/geistwerks.json
const DB = {
  _data: { schemaVersion:0, customers:[], vehicles:[], workorders:[], invoices:[], settings:{} },
  _dirty: false, _saveTimer: null,

  get customers() { return this._data.customers; },
  get vehicles()  { return this._data.vehicles; },
  get workorders(){ return this._data.workorders; },
  get invoices()  { return this._data.invoices; },
  get settings()  { return this._data.settings; },

  set customers(v) { this._data.customers  = v; this._scheduleSave(); },
  set vehicles(v)  { this._data.vehicles   = v; this._scheduleSave(); },
  set workorders(v){ this._data.workorders  = v; this._scheduleSave(); },
  set invoices(v)  { this._data.invoices    = v; this._scheduleSave(); },
  set settings(v)  { this._data.settings    = v; this._scheduleSave(); },

  _scheduleSave() {
    this._dirty = true;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._flush(), 300);
  },

  async _flush() {
    if (!this._dirty) return;
    this._dirty = false;
    try {
      await window.electronAPI.saveData(this._data);
    } catch(e) { console.warn('Save failed:', e); }
  },

  async load() {
    try {
      const d = await window.electronAPI.loadData();
      if (d) {
        this._data.schemaVersion = d.schemaVersion || 0;
        this._data.customers  = d.customers  || [];
        this._data.vehicles   = d.vehicles   || [];
        this._data.workorders = d.workorders || [];
        this._data.invoices   = d.invoices   || [];
        this._data.settings   = d.settings   || {};
      }
    } catch(e) { console.warn('Load failed:', e); }
  }
};

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

const editingId = { customer:null, vehicle:null, workorder:null, invoice:null };

