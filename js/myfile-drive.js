/* ===== My File: multi-account switcher (Mega + Google Drive) =====
   main.js-er PORE load korte hobe. Mega-r moto API dei GDNode class-e,
   tai ager sob feature (preview, upload, rename, move, copy...) Drive-e-o cholbe. */

// Fallback-er jonno (Worker set thakle ei ID lagbe na). Google Cloud-er Web Client ID
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';

/* ---------- Account logos (SVG) ---------- */
const MF_ICON_MEGA = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#d9272e"/><path d="M8.5 22V10.5l7.5 7.5 7.5-7.5V22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const MF_ICON_GD = `<svg viewBox="0 0 87.3 78" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>`;
// Notun account joraar jonno ekhane ekta line add korun (porer comment dekhun)
const MF_ACCOUNTS = [
  { id: 'mega', type: 'mega', label: 'Mega',         letter: 'M', color: '#d9272e', icon: MF_ICON_MEGA },
  { id: 'gd',   type: 'gd',   label: 'Google Drive', letter: 'G', color: '#1a9c5b', icon: MF_ICON_GD }
  // , { id: 'gd2', type: 'gd', label: 'Work Drive', letter: 'W', color: '#2563eb', hint: 'work@gmail.com' }
];

let mfActive = 'mega';
const mfConn = {};                       // id -> { storage, base, cwd }
const GD_FIELDS = 'id,name,mimeType,size,modifiedTime';
const GD_FOLDER = 'application/vnd.google-apps.folder';

function mfRootLabel() {
  const a = MF_ACCOUNTS.find(x => x.id === mfActive);
  return a ? a.label : 'My File';
}

/* ---------- Google Drive: node (Mega node-er moto interface) ---------- */
class GDNode {
  constructor(drv, m, parent) {
    this.drv = drv; this.nodeId = m.id; this.parent = parent || null;
    this.set(m);
    this.children = this.directory ? null : undefined;   // null = ekhono load hoyni
    drv.files[this.nodeId] = this;
  }
  set(m) {
    this.directory = m.mimeType === GD_FOLDER;
    this.native = !this.directory && String(m.mimeType).startsWith('application/vnd.google-apps.');
    this.name = m.name + (this.native ? '.pdf' : '');     // Google Docs/Sheets PDF hishebe nambe
    this.size = +m.size || 0;
    this.timestamp = m.modifiedTime ? Math.floor(Date.parse(m.modifiedTime) / 1000) : 0;
  }
  async load(force) {
    if (!this.directory || (this.children && !force)) return;
    const out = []; let tok = '';
    do {
      const q = encodeURIComponent(`'${this.nodeId}' in parents and trashed=false`);
      const d = await this.drv.api(`files?q=${q}&pageSize=1000&fields=nextPageToken,files(${GD_FIELDS})${tok ? '&pageToken=' + tok : ''}`);
      d.files.forEach(f => out.push(new GDNode(this.drv, f, this)));
      tok = d.nextPageToken || '';
    } while (tok);
    this.children = out;
  }
  async downloadBuffer() {
    const u = this.native ? `files/${this.nodeId}/export?mimeType=application%2Fpdf` : `files/${this.nodeId}?alt=media`;
    return await (await this.drv.raw(u)).arrayBuffer();
  }
  async mkdir(name) {
    await this.load();
    const m = await this.drv.api('files?fields=' + GD_FIELDS, { method: 'POST', json: { name, mimeType: GD_FOLDER, parents: [this.nodeId] } });
    const n = new GDNode(this.drv, m, this); n.children = [];
    this.children.push(n); return n;
  }
  upload(opts) {
    const dest = this; let prog = () => {}; let res, rej;
    const complete = new Promise((a, b) => { res = a; rej = b; });
    complete.catch(() => {});
    const up = {
      complete,
      on(ev, cb) { if (ev === 'progress') prog = cb; return up; },
      end(data) { dest.drv.send(dest, opts, data, prog).then(res, rej); return up; }
    };
    return up;
  }
  async rename(nn) {
    if (this.native) nn = nn.replace(/\.pdf$/i, '');
    this.set(await this.drv.api(`files/${this.nodeId}?fields=${GD_FIELDS}`, { method: 'PATCH', json: { name: nn } }));
  }
  async delete(permanent) {
    if (permanent) await this.drv.api(`files/${this.nodeId}`, { method: 'DELETE' });
    else await this.drv.api(`files/${this.nodeId}`, { method: 'PATCH', json: { trashed: true } });
    if (this.parent && this.parent.children) this.parent.children = this.parent.children.filter(c => c !== this);
    delete this.drv.files[this.nodeId];
  }
  async moveTo(t) {
    await t.load();
    await this.drv.api(`files/${this.nodeId}?addParents=${t.nodeId}&removeParents=${this.parent.nodeId}`, { method: 'PATCH', json: {} });
    this.parent.children = this.parent.children.filter(c => c !== this);
    this.parent = t; t.children.push(this);
  }
  async link() {
    await this.drv.api(`files/${this.nodeId}/permissions`, { method: 'POST', json: { role: 'reader', type: 'anyone' } });
    return (await this.drv.api(`files/${this.nodeId}?fields=webViewLink`)).webViewLink;
  }
  async unshare() { await this.drv.api(`files/${this.nodeId}/permissions/anyoneWithLink`, { method: 'DELETE' }); }
}

/* ---------- Google Drive: connection (Mega Storage object-er moto) ---------- */
class MfDrive {
  constructor(cfg) { this.cfg = cfg; this.tok = null; this.exp = 0; this.files = {}; this.root = null; }
  async token() {
    if (this.tok && Date.now() < this.exp) return this.tok;
    if (this.cfg.server !== false) {                       // Worker theke token (Mega-r moto, login lagbe na)
      try {
        const r = await fetch(`${API_BASE}/gdrive-auth?token=${encodeURIComponent(myfileToken)}&account=${encodeURIComponent(this.cfg.id)}`);
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.access_token) { this.tok = d.access_token; this.exp = Date.now() + (d.expires_in - 60) * 1000; return this.tok; }
        if (r.status === 401) throw new Error('Session expire, Lock kore abar login korun');
      } catch (e) { if (/^Session/.test(e.message)) throw e; }
    }
    return this.popup();                                   // fallback: Google sign-in popup
  }
  async popup() {
    if (GOOGLE_CLIENT_ID.startsWith('YOUR_')) throw new Error('Server-e Google Drive set kora nei');
    await mfLoadGis();
    return new Promise((ok, no) => {
      google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive',
        login_hint: this.cfg.hint || '',
        callback: r => {
          if (r.error) return no(new Error(r.error));
          this.tok = r.access_token; this.exp = Date.now() + (r.expires_in - 60) * 1000; ok(this.tok);
        },
        error_callback: e => no(new Error((e && e.type) || 'Google login cancelled'))
      }).requestAccessToken({ prompt: 'select_account' });
    });
  }
  async raw(path, o = {}, retry = true) {
    const t = await this.token();
    const h = { Authorization: 'Bearer ' + t }; let body;
    if (o.json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(o.json); }
    const r = await fetch(path.startsWith('http') ? path : 'https://www.googleapis.com/drive/v3/' + path, { method: o.method || 'GET', headers: h, body });
    if (r.status === 401 && retry) { this.tok = null; return this.raw(path, o, false); }
    if (!r.ok) {
      let m = 'Drive error ' + r.status;
      try { m = (await r.json()).error.message || m; } catch (_e) {}
      throw new Error(m);
    }
    return r;
  }
  async api(path, o) { const t = await (await this.raw(path, o)).text(); return t ? JSON.parse(t) : {}; }
  async send(dest, opts, data, prog) {            // resumable upload (progress shoho)
    await dest.load();
    const t = await this.token();
    const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=' + GD_FIELDS, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name: opts.name, parents: [dest.nodeId] })
    });
    if (!init.ok) throw new Error('Drive upload start failed (' + init.status + ')');
    const loc = init.headers.get('Location');
    const m = await new Promise((ok, no) => {
      const x = new XMLHttpRequest();
      x.open('PUT', loc);
      x.upload.onprogress = e => prog({ bytesUploaded: e.loaded, bytesTotal: e.total });
      x.onload = () => x.status < 300 ? ok(JSON.parse(x.responseText)) : no(new Error('Upload failed (' + x.status + ')'));
      x.onerror = () => no(new Error('Network error'));
      x.send(data);
    });
    const n = new GDNode(this, m, dest); dest.children.push(n); return n;
  }
  async getAccountInfo() {
    const q = (await this.api('about?fields=storageQuota')).storageQuota || {};
    return { spaceUsed: +q.usage || 0, spaceTotal: +q.limit || 0 };
  }
  on() {}
  close() { this.tok = null; this.files = {}; }
}

function mfLoadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = res; s.onerror = () => rej(new Error('Google script load hoyni'));
    document.head.appendChild(s);
  });
}

async function mfConnectDrive(cfg) {
  const d = new MfDrive(cfg);
  await d.token();
  const r = await d.api('files/root?fields=' + GD_FIELDS);
  d.root = new GDNode(d, { id: r.id, name: cfg.label, mimeType: GD_FOLDER }, null);
  await d.root.load();
  return { storage: d, base: d.root, cwd: d.root };
}

/* ---------- Switcher ---------- */
function mfRenderAccts() {
  const el = document.getElementById('mfAccts');
  if (!el) return;
  const act = MF_ACCOUNTS.find(a => a.id === mfActive);
  el.innerHTML = MF_ACCOUNTS.map(a =>
    `<button type="button" class="mf-acct${a.icon ? ' has-logo' : ''}${a.type === 'mega' ? ' mega' : ''}${a.id === mfActive ? ' on' : ''}${mfConn[a.id] ? ' ok' : ''}" style="--c:${a.color}" title="${mfEsc(a.label)}" onclick="mfSwitch('${a.id}')">${a.icon || mfEsc(a.letter)}<i></i></button>`
  ).join('') + `<span class="mf-acct-name">${mfEsc(act ? act.label : '')}</span>`;
}

async function mfSwitch(id) {
  if (id === mfActive && mfConn[id]) return;
  mfSelExit();
  const cfg = MF_ACCOUNTS.find(a => a.id === id);
  if (!cfg) return;
  if (mfConn[mfActive]) mfConn[mfActive].cwd = mfCwd;          // ager account-er folder mone rakho
  if (!mfConn[id]) {
    if (cfg.type !== 'gd') { mfToast('Mega connect nei, abar login korun'); return; }
    mfToast(cfg.label + ' connect hocche...');
    try { mfConn[id] = await mfConnectDrive(cfg); }
    catch (e) { mfToast('Connect hoyni: ' + (e.message || e)); return; }
  }
  const c = mfConn[id];
  mfActive = id; mfStorage = c.storage; mfBase = c.base; mfCwd = c.cwd;
  mfQuery = ''; document.getElementById('mfSearch').value = '';
  document.getElementById('mfUploads').innerHTML = '';
  mfRenderAccts(); mfRender(); mfLoadSpace();
}

async function mfGo(n) {
  mfSelClear();                                       // folder-e dhoukar age Drive children load
  if (n.load && !n.children) {
    document.getElementById('mfList').innerHTML = '<div class="mf-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    try { await n.load(); } catch (e) { mfToast(e.message || e); mfRender(); return; }
  }
  mfCwd = n; mfRender();
}
async function mfDeepLoad(n) {
  if (!n.directory || !n.load) return;
  await n.load();
  for (const c of n.children) await mfDeepLoad(c);
}
async function mfRefresh() {
  try { if (mfCwd.load) await mfCwd.load(true); } catch (e) { mfToast(e.message || e); }
  mfRender(); mfLoadSpace();
}

/* ---------- main.js-er function gulo wrap kora (main.js edit korte hobe na) ---------- */
const _mfConnect = mfConnect;
mfConnect = async function () {
  await _mfConnect();
  mfConn.mega = { storage: mfStorage, base: mfBase, cwd: mfCwd };
  mfActive = 'mega';
  mfRenderAccts();
};
const _myfileLogout = myfileLogout;
myfileLogout = function () {
  mfSelExit();
  Object.keys(mfConn).forEach(k => { try { mfConn[k].storage.close(); } catch (_e) {} delete mfConn[k]; });
  mfActive = 'mega';
  _myfileLogout();
};


/* ---------- Select mode: ek sathe onek file select kore Download / Move / Copy / Delete ---------- */
let mfSelMode = false;
const mfSel = new Set();

function mfSelUpdate() {
  const n = mfSel.size;
  const c = document.getElementById('mfSelCount');
  if (c) c.textContent = n + ' selected';
  document.querySelectorAll('#mfSelBar [data-need]').forEach(b => { b.disabled = !n; });
  document.querySelectorAll('#mfList .mf-item').forEach(it => {
    const o = it.querySelector('.mf-open');
    it.classList.toggle('sel', !!(o && mfSel.has(o.dataset.id)));
  });
}
function mfToggleSelect() { mfSelMode ? mfSelExit() : mfSelEnter(); }
function mfSelEnter() {
  mfSelMode = true;
  const z = document.getElementById('mfDrop'); if (z) z.classList.add('selmode');
  const b = document.getElementById('mfSelBtn'); if (b) b.classList.add('on');
  mfSelUpdate();
}
function mfSelClear() { mfSel.clear(); mfSelUpdate(); }
function mfSelExit() {
  mfSelMode = false; mfSel.clear();
  const z = document.getElementById('mfDrop'); if (z) z.classList.remove('selmode');
  const b = document.getElementById('mfSelBtn'); if (b) b.classList.remove('on');
  mfSelUpdate();
}
function mfSelAll() {
  const ids = [...document.querySelectorAll('#mfList .mf-open')].map(o => o.dataset.id);
  const all = ids.length && ids.every(i => mfSel.has(i));
  ids.forEach(i => all ? mfSel.delete(i) : mfSel.add(i));
  mfSelUpdate();
}
function mfSelNodes() { return [...mfSel].map(id => mfStorage && mfStorage.files[id]).filter(Boolean); }

// select mode-e item-e click korle open na hoye select/unselect hobe (main.js-er click handler-er age dhore)
document.addEventListener('click', e => {
  if (!mfSelMode) return;
  const it = e.target.closest('#mfList .mf-item');
  if (!it) return;
  e.stopPropagation(); e.preventDefault();
  const o = it.querySelector('.mf-open'); if (!o) return;
  const id = o.dataset.id;
  mfSel.has(id) ? mfSel.delete(id) : mfSel.add(id);
  mfSelUpdate();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && mfSelMode && !document.querySelector('.mf-modal.show')) mfSelExit(); });

// har render-er por checkbox boshano
const _mfRender = mfRender;
mfRender = function () {
  _mfRender();
  document.querySelectorAll('#mfList .mf-open').forEach(o => {
    if (!o.querySelector('.mf-chk')) o.insertAdjacentHTML('afterbegin', '<span class="mf-chk"><i class="fas fa-check"></i></span>');
  });
  mfSelUpdate();
};

function mfInside(t, n) { for (let x = t; x; x = x.parent) if (x === n) return true; return false; }

async function mfBulk(kind) {
  const nodes = mfSelNodes();
  if (!nodes.length) return;
  const n = nodes.length;
  try {
    if (kind === 'dl') {
      const files = nodes.filter(x => !x.directory);
      if (!files.length) { mfToast('Folder download kora jabe na, file select korun'); return; }
      if (files.length < n) mfToast('Folder bad diye ' + files.length + 'ta file download hocche...');
      for (const f of files) await mfDownload(f);
    }
    else if (kind === 'del') {
      if (!confirm('Delete ' + n + ' selected item' + (n > 1 ? 's' : '') + '? They will be moved to the trash.')) return;
      let ok = 0, bad = 0;
      for (const x of nodes) { try { await x.delete(false); ok++; } catch (_e) { bad++; } }
      mfToast(ok + ' deleted' + (bad ? ', ' + bad + ' failed' : ''));
      mfSelClear(); mfRender(); mfLoadSpace(); return;
    }
    else if (kind === 'move') {
      const target = await mfPickFolder('Move ' + n + ' item' + (n > 1 ? 's' : '') + ' to...', null);
      if (!target) return;
      let ok = 0, skip = 0, bad = 0;
      for (const x of nodes) {
        if (x.parent === target || mfInside(target, x)) { skip++; continue; }
        try { await x.moveTo(target); ok++; } catch (_e) { bad++; }
      }
      mfToast(ok + ' moved' + (skip ? ', ' + skip + ' skipped' : '') + (bad ? ', ' + bad + ' failed' : ''));
      mfSelClear(); mfRender(); return;
    }
    else if (kind === 'copy') {
      const target = await mfPickFolder('Copy ' + n + ' item' + (n > 1 ? 's' : '') + ' to...', null);
      if (!target) return;
      for (const x of nodes) await mfDeepLoad(x);
      const total = nodes.reduce((a, x) => { let t = 0; (function w(y) { if (y.directory) (y.children || []).forEach(w); else t += y.size || 0; })(x); return a + t; }, 0);
      if (total > 100 * 1024 * 1024 && !confirm('This copy is ' + mfSize(total) + '. Files are copied by downloading and uploading again. Continue?')) return;
      const box = document.getElementById('mfUploads');
      const row = document.createElement('div');
      row.className = 'mf-up';
      row.innerHTML = '<div class="mf-up-top"><span class="mf-up-name"></span><span class="mf-up-pct">0%</span></div><div class="mf-bar-bg"><div class="mf-bar-fill"></div></div>';
      row.querySelector('.mf-up-name').textContent = 'Copying ' + n + ' item' + (n > 1 ? 's' : '');
      box.appendChild(row);
      try {
        for (const x of nodes) {
          if (mfInside(target, x) && x.directory) continue;       // folder-ke nijer bhetor copy kora jay na
          if (x.directory) await mfCopyFolderTo(x, target, row); else await mfCopyFileTo(x, target, row);
        }
        row.querySelector('.mf-up-pct').textContent = 'Done'; row.querySelector('.mf-bar-fill').style.width = '100%'; row.classList.add('done');
        setTimeout(() => row.remove(), 2500);
      } catch (err) {
        row.querySelector('.mf-up-pct').textContent = 'Failed'; row.classList.add('fail'); row.title = (err && err.message) || 'Copy failed';
      }
      mfSelClear(); mfRender(); mfLoadSpace(); return;
    }
  } catch (e) { alert('Failed: ' + (e.message || e)); }
}
