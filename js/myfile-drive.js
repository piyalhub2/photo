/* ===== My File: multi-account switcher (Mega + Google Drive) =====
   main.js-er PORE load korte hobe. Mega-r moto API dei GDNode class-e,
   tai ager sob feature (preview, upload, rename, move, copy...) Drive-e-o cholbe. */

// Google Cloud Console theke paoa Web Client ID (public hole shomossha nei)
const GOOGLE_CLIENT_ID = '582508472830-2gnv54j3jhkklcplro2a6l0k3c5u84qf.apps.googleusercontent.com';

// Notun account joraar jonno ekhane ekta line add korun (porer comment dekhun)
const MF_ACCOUNTS = [
  { id: 'mega', type: 'mega', label: 'Mega',         letter: 'M', color: '#d9272e' },
  { id: 'gd',   type: 'gd',   label: 'Google Drive', letter: 'G', color: '#1a9c5b' }
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
  token() {
    return new Promise((ok, no) => {
      if (this.tok && Date.now() < this.exp) return ok(this.tok);
      google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive',
        login_hint: this.cfg.hint || '',
        callback: r => {
          if (r.error) return no(new Error(r.error));
          this.tok = r.access_token; this.exp = Date.now() + (r.expires_in - 60) * 1000; ok(this.tok);
        },
        error_callback: e => no(new Error((e && e.type) || 'Google login cancelled'))
      }).requestAccessToken({ prompt: this.tok ? '' : 'select_account' });
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
  if (GOOGLE_CLIENT_ID.startsWith('YOUR_')) throw new Error('GOOGLE_CLIENT_ID set kora hoyni');
  await mfLoadGis();
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
    `<button type="button" class="mf-acct${a.id === mfActive ? ' on' : ''}${mfConn[a.id] ? ' ok' : ''}" style="--c:${a.color}" title="${mfEsc(a.label)}" onclick="mfSwitch('${a.id}')">${mfEsc(a.letter)}<i></i></button>`
  ).join('') + `<span class="mf-acct-name">${mfEsc(act ? act.label : '')}</span>`;
}

async function mfSwitch(id) {
  if (id === mfActive && mfConn[id]) return;
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

async function mfGo(n) {                                       // folder-e dhoukar age Drive children load
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
  Object.keys(mfConn).forEach(k => { try { mfConn[k].storage.close(); } catch (_e) {} delete mfConn[k]; });
  mfActive = 'mega';
  _myfileLogout();
};
