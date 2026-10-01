const API_BASE = "https://tonir-vault-api.tonirshaik.workers.dev";

const body = document.body;
const menuToggle = document.getElementById('menuToggle');
const overlay = document.getElementById('overlay');
const sidebar = document.getElementById('sidebar');

function setOpen(open){
  body.classList.toggle('sidebar-open', open);
  menuToggle.setAttribute('aria-expanded', open);
}

menuToggle.addEventListener('click', () => {
  setOpen(!body.classList.contains('sidebar-open'));
});
overlay.addEventListener('click', () => setOpen(false));

sidebar.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', () => setOpen(false));
});

const views = document.querySelectorAll('.view');

function startTypingEffect(){
  const el = document.getElementById('typingText');
  if(!el) return;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion){
    el.textContent = 'reliable digital experiences';
    return;
  }
  const phrases = ['reliable digital experiences', 'secure workflows', 'modern web solutions', 'thoughtful IT support'];
  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;
  const tick = () => {
    const current = phrases[phraseIndex];
    if(!deleting){
      el.textContent = current.slice(0, charIndex + 1);
      charIndex += 1;
      if(charIndex === current.length){
        deleting = true;
        setTimeout(tick, 1400);
        return;
      }
    } else {
      el.textContent = current.slice(0, charIndex - 1);
      charIndex -= 1;
      if(charIndex === 0){
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
      }
    }
    setTimeout(tick, deleting ? 45 : 75);
  };
  setTimeout(tick, 500);
}

function showView(name){
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  sidebar.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === name && el.tagName === 'A');
  });
}
const viewPasswordField = {
  security: 'secPasswordField',
  private: 'privPasswordField',
  card: 'cardPasswordField',
  cv: 'cvPasswordField',
  diploma: 'diplomaPasswordField',
  school: 'schoolPasswordField',
  citizen: 'citizenPasswordField',
  passport: 'passportPasswordField',
  nid: 'nidPasswordField',
  myfile: 'myfilePasswordField'
};

startTypingEffect();

document.querySelectorAll('[data-view]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if(el.dataset.view === 'security'){ secLogout(); }
    if(el.dataset.view === 'private'){ privLogout(); }
    if(el.dataset.view === 'authenticator'){
      const authFrame = document.getElementById('authenticatorFrame');
      if(authFrame) authFrame.src = 'authenticator.html';
    }
    if(el.dataset.view === 'card'){ cardLogout(); }
    if(el.dataset.view === 'cv'){ cvResetLock(); }
    if(el.dataset.view === 'diploma'){ diplomaResetLock(); }
    if(el.dataset.view === 'school'){ schoolResetLock(); }
    if(el.dataset.view === 'citizen'){ citizenResetLock(); }
    if(el.dataset.view === 'passport'){ passportResetLock(); }
    if(el.dataset.view === 'nid'){ nidResetLock(); }
    if(el.dataset.view === 'myfile'){ myfileLogout(); }
    showView(el.dataset.view);
    setOpen(false);

    const fieldId = viewPasswordField[el.dataset.view];
    if(fieldId){
      requestAnimationFrame(() => {
        const field = document.getElementById(fieldId);
        if(field) field.focus();
      });
    }
  });
});


async function apiLogin(category, password){
  let res;
  try{
    res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, password })
    });
  }catch(networkErr){
    const e = new Error('Network error');
    e.isNetworkError = true;
    throw e;
  }
  const data = await res.json();
  if(!res.ok){
    const e = new Error(data.error || 'Login failed');
    e.status = res.status;
    e.serverMessage = data.error;
    throw e;
  }
  return data.token;
}

async function apiGetDocument(category, token){
  let res;
  try{
    res = await fetch(`${API_BASE}/document?category=${encodeURIComponent(category)}&token=${encodeURIComponent(token)}`);
  }catch(networkErr){
    const e = new Error('Network error');
    e.isNetworkError = true;
    throw e;
  }
  const data = await res.json();
  if(!res.ok){
    const e = new Error(data.error || 'Link not found');
    e.status = res.status;
    e.serverMessage = data.error;
    throw e;
  }
  return data.link;
}


function describeAuthError(err, stage){
  if(err.isNetworkError){
    return 'Network error — could not reach the server (check WiFi/DNS)';
  }
  if(err.status === 429){
    return err.serverMessage || 'Too many attempts, please try again in a moment.';
  }
  if(stage === 'document'){
    return (err.serverMessage || 'Link not found') + ' — check whether the LINK variable for this document is set in the Worker.';
  }
  return 'Incorrect password';
}


function makeDocModule(prefix, category){
  const passId = prefix + 'PasswordField';
  const eyeId  = prefix + 'EyeIcon';
  const btnId  = prefix + 'DownloadBtn';
  const errId  = prefix + 'Error';

  let inFlight = false;
  let debounceTimer = null;

  async function attempt(val){
    const passInput = document.getElementById(passId);
    const downloadBtn = document.getElementById(btnId);
    const err = document.getElementById(errId);
    if(!val || inFlight) return;
    inFlight = true;
    try{
      const token = await apiLogin(category, val);
      const link = await apiGetDocument(category, token);
      if(passInput.value.trim() !== val){ inFlight = false; return; }
      downloadBtn.href = link;
      downloadBtn.classList.add('show');
      passInput.closest('.cv-input-wrap')?.classList.add('hide-el');
      if(err) err.textContent = '';
    }catch(_err){
      if(_err.isNetworkError || _err.status === 429){
        if(err) err.textContent = describeAuthError(_err, 'login');
      }
    }finally{
      inFlight = false;
    }
  }

  function onInput(){
    const err = document.getElementById(errId);
    if(err) err.textContent = '';
    const downloadBtn = document.getElementById(btnId);
    if(downloadBtn.classList.contains('show')) return;
    if(debounceTimer) clearTimeout(debounceTimer);
    const val = document.getElementById(passId).value.trim();
    if(!val) return;
    debounceTimer = setTimeout(() => attempt(val), 450);
  }

  function submit(e){
    if(e) e.preventDefault();
    if(debounceTimer) clearTimeout(debounceTimer);
    const val = document.getElementById(passId).value.trim();
    attempt(val);
  }

  function toggleVisibility(){
    const pf = document.getElementById(passId);
    const icon = document.getElementById(eyeId);
    if(pf.type === "password"){
      pf.type = "text";
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      pf.type = "password";
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  }

  function resetLock(){
    const pf = document.getElementById(passId);
    const icon = document.getElementById(eyeId);
    const downloadBtn = document.getElementById(btnId);
    const err = document.getElementById(errId);
    if(debounceTimer) clearTimeout(debounceTimer);
    inFlight = false;
    if(pf){ pf.value = ''; pf.type = 'password'; }
    if(icon){ icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
    if(downloadBtn){ downloadBtn.classList.remove('show'); downloadBtn.removeAttribute('href'); }
    pf?.closest('.cv-input-wrap')?.classList.remove('hide-el');
    if(err){ err.textContent = ''; }
  }

  return { onInput, submit, toggleVisibility, resetLock };
}

const cvModule       = makeDocModule('cv', 'cv');
const diplomaModule  = makeDocModule('diploma', 'diploma');
const schoolModule   = makeDocModule('school', 'school');
const citizenModule  = makeDocModule('citizen', 'citizen');
const passportModule = makeDocModule('passport', 'passport');
const nidModule      = makeDocModule('nid', 'nid');


let privToken = null;
let privLinksCache = null;

function privToggleVisibility(){
  const pf = document.getElementById('privPasswordField');
  const icon = document.getElementById('privEyeIcon');
  if(pf.type === "password"){
    pf.type = "text";
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    pf.type = "password";
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function privClearError(){
  document.getElementById('privLockError').textContent = '';
}

let privInFlight = false;
async function privTryLogin(){
  const val = document.getElementById('privPasswordField').value.trim();
  const errorEl = document.getElementById('privLockError');
  const btn = document.getElementById('privSubmitBtn');
  if(!val || privInFlight) return;
  privInFlight = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Checking...';
  btn.disabled = true;
  try{
    privToken = await apiLogin('private', val);
    errorEl.textContent = '';
    document.getElementById('privAuthScreen').classList.remove('active');
    document.getElementById('privMainMenu').classList.add('active');
  }catch(err){
    errorEl.textContent = describeAuthError(err, 'login');
  }finally{
    btn.textContent = originalLabel;
    btn.disabled = false;
    privInFlight = false;
  }
}

async function privOpenLink(key){
  try{
    if(!privLinksCache){
      const res = await fetch(`${API_BASE}/private-links?token=${encodeURIComponent(privToken)}`);
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      privLinksCache = data.links;
    }
    const link = privLinksCache[key];
    if(link) window.open(link, '_blank');
  }catch(e){
    alert('Your session has expired, please log in again.');
    privLogout();
  }
}

function privLogout(){
  privToken = null;
  privLinksCache = null;
  document.getElementById('privPasswordField').value = "";
  document.getElementById('privPasswordField').type = "password";
  document.getElementById('privEyeIcon').classList.replace('fa-eye-slash', 'fa-eye');
  document.getElementById('privMainMenu').classList.remove('active');
  document.getElementById('privAuthScreen').classList.add('active');
  document.getElementById('privLockError').textContent = '';
}

// ---------- My File (real MEGA storage: upload / browse / preview / edit / download) ----------
const MF_BASE_ID = 'K3xT3LTQ';      // your MEGA folder handle (from mega.nz/fm/K3xT3LTQ)
const MF_BASE_NAME = 'My File';     // fallback folder that is auto-created if the handle is not found
const MF_MAX_PREVIEW = 200 * 1024 * 1024;
let myfileToken = null, mfStorage = null, mfBase = null, mfCwd = null, mfQuery = '', mfBlobUrl = null, mfRenderTimer = null;

function mfEsc(t){
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function mfExt(name){ return (String(name || '').split('.').pop() || '').toLowerCase(); }
function mfIcon(node){
  if(node.directory) return 'fa-folder';
  const ext = mfExt(node.name);
  if(['jpg','jpeg','png','gif','webp','heic','bmp','svg'].includes(ext)) return 'fa-image';
  if(['mp4','mkv','mov','avi','webm'].includes(ext)) return 'fa-film';
  if(['mp3','wav','m4a','ogg'].includes(ext)) return 'fa-music';
  if(ext === 'pdf') return 'fa-file-pdf';
  if(['doc','docx','txt','rtf'].includes(ext)) return 'fa-file-lines';
  if(['xls','xlsx','csv'].includes(ext)) return 'fa-file-excel';
  if(['ppt','pptx'].includes(ext)) return 'fa-file-powerpoint';
  if(['zip','rar','7z','tar','gz'].includes(ext)) return 'fa-file-zipper';
  return 'fa-file';
}
function mfMime(name){
  const m = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',svg:'image/svg+xml',
    mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg',
    pdf:'application/pdf',txt:'text/plain',csv:'text/plain'};
  return m[mfExt(name)] || 'application/octet-stream';
}
const MF_TEXT_EXT = ['txt','md','markdown','json','csv','tsv','log','xml','html','htm','css','js','mjs','ts','jsx','tsx',
  'py','java','c','cpp','h','cs','php','rb','go','rs','sh','bat','ps1','sql','yml','yaml','toml','ini','cfg','conf','env',
  'gs','srt','vtt','tex','gitignore'];
const MF_MAX_TEXT = 5 * 1024 * 1024;
function mfIsText(name){ return MF_TEXT_EXT.includes(mfExt(name)); }
let mfEditNode = null, mfEditText = '';
function mfSize(n){
  if(n == null) return '';
  const u = ['B','KB','MB','GB']; let i = 0; n = Number(n);
  while(n >= 1024 && i < u.length - 1){ n /= 1024; i++; }
  return (i ? n.toFixed(1) : n) + ' ' + u[i];
}

function myfileToggleVisibility(){
  const pf = document.getElementById('myfilePasswordField');
  const icon = document.getElementById('myfileEyeIcon');
  if(pf.type === 'password'){ pf.type = 'text'; icon.classList.replace('fa-eye','fa-eye-slash'); }
  else { pf.type = 'password'; icon.classList.replace('fa-eye-slash','fa-eye'); }
}
function myfileClearError(){ document.getElementById('myfileLockError').textContent = ''; }

function mfLoadLib(){
  if(window.mega && window.mega.Storage) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/megajs@1.3.10/dist/main.browser-umd.js';
    sc.onload = () => (window.mega && window.mega.Storage) ? resolve() : reject(new Error('MEGA library failed to load'));
    sc.onerror = () => reject(new Error('Could not load the MEGA library. Check your internet connection.'));
    document.head.appendChild(sc);
  });
}

async function mfConnect(){
  const res = await fetch(`${API_BASE}/mega-auth?token=${encodeURIComponent(myfileToken)}`);
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || 'Could not get MEGA login from the server');
  await mfLoadLib();
  const storage = new window.mega.Storage({ email: data.email, password: data.password });
  await storage.ready;
  mfStorage = storage;
  mfBase = storage.root; mfCwd = storage.root;

  ['add','move','delete','update'].forEach(ev => { try{ storage.on(ev, mfRenderSoon); }catch(_e){} });
  mfMarkLayout();
  mfRender();
  mfLoadSpace();
}

let myfileInFlight = false;
async function myfileTryLogin(){
  const val = document.getElementById('myfilePasswordField').value.trim();
  const errorEl = document.getElementById('myfileLockError');
  const btn = document.getElementById('myfileSubmitBtn');
  if(!val || myfileInFlight) return;
  myfileInFlight = true;
  const label = btn.textContent;
  btn.textContent = 'Checking...'; btn.disabled = true;
  try{
    try{
      myfileToken = await apiLogin('myfile', val);
    }catch(err){
      errorEl.textContent = describeAuthError(err, 'login');
      return;
    }
    btn.textContent = 'Connecting to MEGA...';
    try{
      await mfConnect();
    }catch(err){
      errorEl.textContent = 'MEGA error: ' + (err && err.message ? err.message : err);
      return;
    }
    errorEl.textContent = '';
    document.getElementById('myfileAuthScreen').classList.remove('active');
    document.getElementById('myfileMain').classList.add('active');
    document.getElementById('mfWrap').classList.add('mf-wide');
  }finally{
    btn.textContent = label; btn.disabled = false; myfileInFlight = false;
  }
}

async function mfLoadSpace(){
  try{
    const info = await mfStorage.getAccountInfo();
    document.getElementById('mfSpace').textContent = 'Storage used: ' + mfSize(info.spaceUsed) + ' of ' + mfSize(info.spaceTotal);
  }catch(_e){}
}

// ---- layout switcher (Compact list / List / Grid / Gallery) ----
let mfLayout = 'compact';
try{ const sv = localStorage.getItem('mfLayout'); if(['compact','list','grid','gallery'].includes(sv)) mfLayout = sv; }catch(_e){}
const mfThumbCache = new Map();
const mfThumbPending = new Set();
let mfThumbQueue = [], mfThumbActive = 0;

function mfMarkLayout(){
  document.querySelectorAll('#mfLayoutMenu button').forEach(b => b.classList.toggle('active', b.dataset.layout === mfLayout));
  const ic = {compact:'fa-list-ul', list:'fa-bars', grid:'fa-table-cells-large', gallery:'fa-image'}[mfLayout];
  const btn = document.getElementById('mfLayoutBtn');
  if(btn) btn.innerHTML = '<i class="fas ' + ic + '"></i>';
}
function mfToggleLayoutMenu(e){
  if(e) e.stopPropagation();
  const um = document.getElementById('mfUploadMenu'); if(um) um.classList.remove('show');
  document.getElementById('mfLayoutMenu').classList.toggle('show');
  mfMarkLayout();
}
function mfSetLayout(name){
  mfLayout = name;
  try{ localStorage.setItem('mfLayout', name); }catch(_e){}
  document.getElementById('mfLayoutMenu').classList.remove('show');
  mfMarkLayout();
  mfRender();
}
document.addEventListener('click', () => {
  const m = document.getElementById('mfLayoutMenu');
  if(m) m.classList.remove('show');
  const u = document.getElementById('mfUploadMenu');
  if(u) u.classList.remove('show');
});

const mfThumbObserver = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
  entries.forEach(en => {
    if(!en.isIntersecting) return;
    mfThumbObserver.unobserve(en.target);
    const id = en.target.dataset.th;
    if(id && !mfThumbPending.has(id) && !mfThumbCache.has(id)){ mfThumbPending.add(id); mfThumbQueue.push(id); }
  });
  mfThumbPump();
}, { rootMargin: '200px' }) : null;

function mfPutThumb(el, url){ el.innerHTML = '<img src="' + url + '" alt="">'; }
function mfLoadThumbs(){
  if(!mfThumbObserver) return;
  document.querySelectorAll('#mfList .mf-ico[data-th]').forEach(el => {
    const id = el.dataset.th;
    const node = mfStorage && mfStorage.files[id];
    if(!node || node.directory) return;
    if(mfMime(node.name).split('/')[0] !== 'image') return;
    if(!node.size) return;
    if(mfThumbCache.has(id)){ mfPutThumb(el, mfThumbCache.get(id)); return; }
    mfThumbObserver.observe(el);
  });
}
// ---- persistent thumbnail cache (IndexedDB) ----
const MF_THUMB_MAX = 20 * 1024 * 1024;    // auto-download limit for making a thumbnail from MEGA
const MF_THUMB_CONCURRENCY = 6;
const MF_PERSIST_THUMBS = true;           // false = thumbnails are wiped from this device on logout
let mfDbPromise = null;
function mfDb(){
  if(!mfDbPromise) mfDbPromise = new Promise((resolve, reject) => {
    try{
      const rq = indexedDB.open('mfThumbs', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('t');
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    }catch(e){ reject(e); }
  });
  return mfDbPromise;
}
function mfThumbKey(node){ return node.nodeId + '_' + (node.size || 0); }
async function mfDbGet(key){
  try{
    const db = await mfDb();
    return await new Promise(res => {
      const rq = db.transaction('t').objectStore('t').get(key);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  }catch(_e){ return null; }
}
async function mfDbPut(key, blob){
  try{
    const db = await mfDb();
    db.transaction('t', 'readwrite').objectStore('t').put(blob, key);
  }catch(_e){}
}
async function mfDbClear(){
  try{ const db = await mfDb(); db.transaction('t', 'readwrite').objectStore('t').clear(); }catch(_e){}
}
// Build a small JPEG blob (max 360px) from any image blob
async function mfMakeThumbBlob(blob){
  try{
    const bmp = await createImageBitmap(blob);
    const r = Math.min(1, 360 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * r));
    c.height = Math.max(1, Math.round(bmp.height * r));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if(bmp.close) bmp.close();
    return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
  }catch(_e){ return null; }
}
// Called right after an upload: make the thumbnail from the local file, no MEGA download needed
async function mfThumbFromLocal(node, file){
  try{
    if(!node || !node.nodeId || !file || !/^image\//.test(file.type || '')) return;
    const tb = await mfMakeThumbBlob(file);
    if(!tb) return;
    const key = node.nodeId + '_' + file.size;
    mfThumbCache.set(node.nodeId, URL.createObjectURL(tb));
    mfDbPut(key, tb);
  }catch(_e){}
}
async function mfMakeThumb(blob){
  try{
    const bmp = await createImageBitmap(blob);
    const r = Math.min(1, 360 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * r));
    c.height = Math.max(1, Math.round(bmp.height * r));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if(bmp.close) bmp.close();
    const out = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
    if(out) return URL.createObjectURL(out);
  }catch(_e){}
  try{ return URL.createObjectURL(blob); }catch(_e){ return null; }
}
function mfThumbPump(){
  while(mfThumbActive < MF_THUMB_CONCURRENCY && mfThumbQueue.length){
    const id = mfThumbQueue.shift();
    mfThumbActive++;
    (async () => {
      try{
        const node = mfStorage && mfStorage.files[id];
        if(node){
          let url = null;
          const key = mfThumbKey(node);
          const saved = await mfDbGet(key);
          if(saved){
            url = URL.createObjectURL(saved);
          }else{
            if(node.size > MF_THUMB_MAX) throw new Error('too large for auto thumbnail');
            const blob = await mfFetchBlob(node);
            const tb = await mfMakeThumbBlob(blob);
            if(tb){ url = URL.createObjectURL(tb); mfDbPut(key, tb); }
            else url = URL.createObjectURL(blob);
          }
          if(!url) throw new Error('no thumb');
          mfThumbCache.set(id, url);
          document.querySelectorAll('#mfList .mf-ico[data-th="' + id + '"]').forEach(el => mfPutThumb(el, url));
        }
      }catch(_e){}
      finally{ mfThumbPending.delete(id); mfThumbActive--; mfThumbPump(); }
    })();
  }
}

function mfFitPop(pop){
  const list = document.getElementById('mfList');
  list.style.paddingBottom = '';
  const w = document.getElementById('mfWrap').getBoundingClientRect();
  const p = pop.getBoundingClientRect();
  const over = p.bottom - (w.bottom - 16);
  if(over > 0) list.style.paddingBottom = Math.ceil(over) + 'px';
}

function mfRenderSoon(){ clearTimeout(mfRenderTimer); mfRenderTimer = setTimeout(mfRender, 250); }
function mfSetQuery(v){ mfQuery = v.trim().toLowerCase(); mfRender(); }

function mfRender(){
  if(!mfCwd) return;
  const chain = []; let n = mfCwd;
  while(n){ chain.unshift(n); if(n === mfBase) break; n = n.parent; }
  document.getElementById('mfCrumbs').innerHTML = chain.map((c, idx) =>
    `<button class="mf-crumb${idx === chain.length - 1 ? ' active' : ''}" data-act="crumb" data-id="${mfEsc(c.nodeId)}">${idx === 0 ? '<i class="fas fa-house"></i> ' : ''}${mfEsc(idx === 0 ? mfRootLabel() : c.name)}</button>`
  ).join('<span class="mf-sep">/</span>');

  const items = (mfCwd.children || [])
    .filter(c => !mfQuery || String(c.name || '').toLowerCase().includes(mfQuery))
    .sort((x, y) => (y.directory - x.directory) || String(x.name || '').localeCompare(String(y.name || '')));
  const el = document.getElementById('mfList');
  el.className = 'mf-list mf-l-' + mfLayout;
  if(!items.length){
    el.innerHTML = '<div class="mf-empty">' + (mfQuery ? 'No matching files.' : 'This folder is empty. Tap Upload or drop files / folders here.') + '</div>';
    return;
  }
  el.innerHTML = items.map(f => {
    const id = mfEsc(f.nodeId);
    const sub = f.directory ? 'Folder' : (mfSize(f.size) + (f.timestamp ? ' · ' + new Date(f.timestamp * 1000).toLocaleDateString() : ''));
    return `<div class="mf-item">
      <div class="mf-open" data-act="open" data-id="${id}">
        <span class="mf-ico" data-th="${id}"><i class="fas ${mfIcon(f)}"></i></span>
        <span class="mf-meta"><span class="mf-name">${mfEsc(f.name || 'Unnamed')}</span><span class="mf-sub">${mfEsc(sub)}</span></span>
      </div>
      <div class="mf-more-wrap">
        <button class="mf-mini mf-more" data-act="more" data-id="${id}" title="Options"><i class="fas fa-ellipsis-vertical"></i></button>
        <div class="mf-pop">
          ${f.directory ? '' : `<button data-act="dl" data-id="${id}"><i class="fas fa-download"></i> Download</button>`}
          ${f.directory ? '' : `<button data-act="link" data-id="${id}"><i class="fas fa-link"></i> Copy link</button>
          <button data-act="share" data-id="${id}"><i class="fas fa-share-nodes"></i> Share</button>
          <button data-act="unlink" data-id="${id}"><i class="fas fa-link-slash"></i> Remove link</button>`}
          <button data-act="move" data-id="${id}"><i class="fas fa-arrows-up-down-left-right"></i> Move to...</button>
          <button data-act="copy" data-id="${id}"><i class="fas fa-copy"></i> Copy to...</button>
          <button data-act="ren" data-id="${id}"><i class="fas fa-pen"></i> Rename</button>
          <button class="mf-del-opt" data-act="del" data-id="${id}"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
  mfLoadThumbs();
}

async function mfNewFolder(){
  const name = (prompt('New folder name:') || '').trim();
  if(!name || !mfCwd) return;
  try{ await mfCwd.mkdir(name); mfRender(); }
  catch(e){ alert('Could not create folder: ' + (e.message || e)); }
}

// ----- Upload menu (Files / Folder) -----
function mfToggleUploadMenu(e){
  if(e) e.stopPropagation();
  const lm = document.getElementById('mfLayoutMenu'); if(lm) lm.classList.remove('show');
  document.getElementById('mfUploadMenu').classList.toggle('show');
}
function mfPickFiles(){ document.getElementById('mfFileInput').click(); }
function mfPickUploadFolder(){ document.getElementById('mfFolderInput').click(); }

// folder path ("a/b/c") banao, age thakle reuse koro
async function mfEnsureDir(root, parts, cache){
  let cur = root, key = '';
  for(const p of parts){
    key += '/' + p;
    if(!cache.has(key)){
      const parent = cur;
      cache.set(key, (async () => {
        const ex = (parent.children || []).find(c => c.directory && c.name === p);
        return ex || await parent.mkdir(p);
      })());
    }
    cur = await cache.get(key);
  }
  return cur;
}

// files = FileList / array (webkitRelativePath ba _rel thakle folder structure ta rakha hobe)
// emptyDirs = drag & drop-er khali folder gulor path
async function mfUploadFiles(files, emptyDirs){
  const list = [...files];
  const dirs = emptyDirs || [];
  if((!list.length && !dirs.length) || !mfCwd) return;
  const target = mfCwd;
  const box = document.getElementById('mfUploads');
  const cache = new Map();
  for(const d of dirs){
    try{ await mfEnsureDir(target, d.split('/').filter(Boolean), cache); }catch(_e){}
  }
  for(const f of list){
    const rel = f._rel || f.webkitRelativePath || f.name;
    const parts = rel.split('/').filter(Boolean);
    const fileName = parts.pop() || f.name;
    const row = document.createElement('div');
    row.className = 'mf-up';
    row.innerHTML = '<div class="mf-up-top"><span class="mf-up-name"></span><span class="mf-up-pct">0%</span></div><div class="mf-bar-bg"><div class="mf-bar-fill"></div></div>';
    row.querySelector('.mf-up-name').textContent = rel;
    box.appendChild(row);
    const pct = row.querySelector('.mf-up-pct'), fill = row.querySelector('.mf-bar-fill');
    try{
      const dest = parts.length ? await mfEnsureDir(target, parts, cache) : target;
      const data = new Uint8Array(await f.arrayBuffer());
      const up = dest.upload({ name: fileName, size: f.size });
      up.on('progress', info => {
        const total = info.bytesTotal || f.size || 1;
        const p = Math.min(100, Math.round(((info.bytesUploaded != null ? info.bytesUploaded : info.bytesLoaded) || 0) / total * 100));
        pct.textContent = p + '%'; fill.style.width = p + '%';
      });
      up.end(data);
      const newNode = await up.complete;
      await mfThumbFromLocal(newNode, f);
      pct.textContent = 'Done'; fill.style.width = '100%'; row.classList.add('done');
      setTimeout(() => row.remove(), 2500);
    }catch(e){
      pct.textContent = 'Failed'; row.classList.add('fail'); row.title = (e && e.message) || 'Upload failed';
    }
  }
  mfRender(); mfLoadSpace();
}

// Drag & drop: file ar folder dutoi (folder-er bhetorer sob kichu shoho)
async function mfReadDropped(dt){
  const entries = [];
  for(const it of (dt.items || [])){
    const en = it.webkitGetAsEntry && it.webkitGetAsEntry();
    if(en) entries.push(en);
  }
  if(!entries.length) return { files: [...(dt.files || [])], dirs: [] };
  const files = [], dirs = [];
  const walk = async (en, base) => {
    if(en.isFile){
      const f = await new Promise((res, rej) => en.file(res, rej));
      f._rel = base + f.name; files.push(f);
    }else if(en.isDirectory){
      dirs.push(base + en.name);
      const rd = en.createReader();
      let batch;
      do{
        batch = await new Promise((res, rej) => rd.readEntries(res, rej));
        for(const c of batch) await walk(c, base + en.name + '/');
      }while(batch.length);
    }
  };
  for(const en of entries) await walk(en, '');
  return { files, dirs };
}

async function mfFetchBlob(node){
  const buf = await node.downloadBuffer();
  return new Blob([buf], { type: mfMime(node.name) });
}
async function mfDownload(node){
  try{
    const blob = await mfFetchBlob(node);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = node.name || 'file';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }catch(e){ alert('Download failed: ' + (e.message || e)); }
}

function mfModalEl(){
  let m = document.getElementById('mfModal');
  if(!m){
    m = document.createElement('div');
    m.id = 'mfModal'; m.className = 'mf-modal';
    m.innerHTML = '<div class="mf-modal-box"><div class="mf-modal-head"><span class="mf-modal-title" id="mfModalTitle"></span><span class="mf-modal-actions" id="mfModalActions"></span><button class="mf-mini" data-act="close" title="Close"><i class="fas fa-xmark"></i></button></div><div class="mf-modal-body" id="mfModalBody"></div></div>';
    m.addEventListener('click', e => { if(e.target === m) mfClosePreview(); });
    document.body.appendChild(m);
  }
  return m;
}

function mfClosePreview(force){
  if(!force && document.getElementById('mfEditor') && !confirm('Discard unsaved changes?')) return;
  mfEditNode = null; mfEditText = '';
  const m = document.getElementById('mfModal');
  if(m) m.classList.remove('show');
  const body = document.getElementById('mfModalBody');
  if(body) body.innerHTML = '';
  if(mfBlobUrl){ URL.revokeObjectURL(mfBlobUrl); mfBlobUrl = null; }
}

function mfShowText(node, text){
  mfEditNode = node; mfEditText = text;
  document.getElementById('mfModalTitle').textContent = node.name || 'File';
  document.getElementById('mfModalActions').innerHTML =
    `<button class="mf-mini" data-act="edit" title="Edit"><i class="fas fa-pen-to-square"></i></button>` +
    `<button class="mf-mini" data-act="dl" data-id="${mfEsc(node.nodeId)}" title="Download"><i class="fas fa-download"></i></button>`;
  const body = document.getElementById('mfModalBody');
  const wrap = document.createElement('div'); wrap.className = 'mf-code';
  const gutter = document.createElement('pre'); gutter.className = 'mf-gutter'; gutter.setAttribute('aria-hidden','true');
  gutter.textContent = mfLineNums(text);
  const pre = document.createElement('pre'); pre.className = 'mf-text';
  pre.textContent = text;
  wrap.appendChild(gutter); wrap.appendChild(pre);
  body.innerHTML = ''; body.appendChild(wrap);
}

// line number gutter text: "1\n2\n3..." (text-er line count onujayi)
function mfLineNums(text){
  const n = text.split('\n').length;
  let s = '';
  for(let i = 1; i <= n; i++) s += i + (i < n ? '\n' : '');
  return s;
}

function mfStartEdit(){
  if(!mfEditNode) return;
  document.getElementById('mfModalActions').innerHTML =
    `<button class="mf-btn mf-primary" data-act="save"><i class="fas fa-floppy-disk"></i> Save</button>` +
    `<button class="mf-btn" data-act="cancel-edit">Cancel</button>`;
  const body = document.getElementById('mfModalBody');
  body.innerHTML = '<div class="mf-edit-wrap"><pre class="mf-gutter mf-gutter-edit" id="mfEditGutter" aria-hidden="true"></pre><textarea class="mf-editor" id="mfEditor" spellcheck="false" wrap="off"></textarea></div>';
  const ta = document.getElementById('mfEditor');
  const gt = document.getElementById('mfEditGutter');
  ta.value = mfEditText;
  gt.textContent = mfLineNums(ta.value);
  ta.addEventListener('input', () => { gt.textContent = mfLineNums(ta.value); gt.scrollTop = ta.scrollTop; });
  ta.addEventListener('scroll', () => { gt.scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', e => {
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){
      e.preventDefault();
      const b = document.querySelector('#mfModalActions [data-act="save"]');
      if(b) mfSaveEdit(b);
    }
  });
  ta.focus();
}

async function mfSaveEdit(btn){
  const ta = document.getElementById('mfEditor');
  if(!ta || !mfEditNode) return;
  const old = mfEditNode, parent = old.parent, name = old.name, text = ta.value;
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Saving...';
  try{
    const data = new TextEncoder().encode(text);
    const up = parent.upload({ name, size: data.length });
    up.end(data);
    const newNode = await up.complete;
    try{ await old.delete(true); }catch(_e){}   // purano version muche felo
    mfShowText(newNode || old, text);
    mfRender(); mfLoadSpace();
  }catch(e){
    alert('Save failed: ' + (e.message || e));
    btn.disabled = false; btn.innerHTML = label;
  }
}

async function mfOpenAsText(node){
  const body = document.getElementById('mfModalBody');
  body.innerHTML = '<div class="mf-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  try{
    const blob = await mfFetchBlob(node);
    mfShowText(node, await blob.text());
  }catch(e){
    body.innerHTML = '<div class="mf-empty">Could not load the file: ' + mfEsc(e.message || e) + '</div>';
  }
}

async function mfPreview(node){
  const m = mfModalEl();
  const body = document.getElementById('mfModalBody');
  mfEditNode = null; mfEditText = '';
  document.getElementById('mfModalTitle').textContent = node.name || 'File';
  document.getElementById('mfModalActions').innerHTML = `<button class="mf-mini" data-act="dl" data-id="${mfEsc(node.nodeId)}" title="Download"><i class="fas fa-download"></i></button>`;
  m.classList.add('show');
  const mime = mfMime(node.name);
  const kind = mime.split('/')[0];
  const isText = mfIsText(node.name);
  const previewable = isText || ['image','video','audio'].includes(kind) || mime === 'application/pdf';
  if(!previewable){
    body.innerHTML = '<div class="mf-empty">No preview for this file type. Use the download button.' +
      (node.size <= MF_MAX_TEXT ? `<br><br><button class="mf-btn" data-act="astext" data-id="${mfEsc(node.nodeId)}">Open as text</button>` : '') + '</div>';
    return;
  }
  if(isText ? node.size > MF_MAX_TEXT : node.size > MF_MAX_PREVIEW){ body.innerHTML = '<div class="mf-empty">File is too large to preview. Use the download button.</div>'; return; }
  body.innerHTML = '<div class="mf-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  try{
    const blob = await mfFetchBlob(node);
    if(!m.classList.contains('show')) return;
    if(isText){ mfShowText(node, await blob.text()); return; }
    mfBlobUrl = URL.createObjectURL(blob);
    if(kind === 'image') body.innerHTML = `<img class="mf-view" src="${mfBlobUrl}" alt="">`;
    else if(kind === 'video') body.innerHTML = `<video class="mf-view" src="${mfBlobUrl}" controls playsinline></video>`;
    else if(kind === 'audio') body.innerHTML = `<audio src="${mfBlobUrl}" controls style="width:100%"></audio>`;
    else body.innerHTML = `<iframe class="mf-view mf-pdf" src="${mfBlobUrl}"></iframe><a class="mf-btn" href="${mfBlobUrl}" target="_blank" rel="noopener noreferrer" style="margin-top:10px;display:inline-block">Open PDF in new tab</a>`;
  }catch(e){
    body.innerHTML = '<div class="mf-empty">Could not load the file: ' + mfEsc(e.message || e) + '</div>';
  }
}


// ---------- Copy link / Share / Move / Copy ----------
function mfToast(msg){
  let t = document.getElementById('mfToast');
  if(!t){ t = document.createElement('div'); t.id = 'mfToast'; t.className = 'mf-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(mfToast._t); mfToast._t = setTimeout(() => { t.style.display = 'none'; }, 3200);
}
async function mfClip(text){
  try{ await navigator.clipboard.writeText(text); return true; }catch(_e){}
  try{
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  }catch(_e){ return false; }
}
async function mfGetLink(node){
  const url = await node.link();
  return url;
}
async function mfCopyLink(node){
  try{
    mfToast('Creating link...');
    const url = await mfGetLink(node);
    if(await mfClip(url)) mfToast('Link copied. Anyone with this link can open it.');
    else prompt('Copy this link:', url);
  }catch(err){ alert('Could not create link: ' + (err.message || err)); }
}
async function mfShare(node){
  try{
    mfToast('Creating link...');
    const url = await mfGetLink(node);
    if(navigator.share){
      try{ await navigator.share({ title: node.name || 'File', url }); return; }
      catch(e){ if(e && e.name === 'AbortError') return; }
    }
    if(await mfClip(url)) mfToast('Link copied. Paste it wherever you want to share.');
    else prompt('Copy this link:', url);
  }catch(err){ alert('Could not share: ' + (err.message || err)); }
}
async function mfRemoveLink(node){
  if(!confirm('Remove the public link of "' + (node.name || 'this item') + '"? Old links will stop working.')) return;
  try{ await node.unshare(); mfToast('Link removed.'); }
  catch(err){ alert('Could not remove link: ' + (err.message || err)); }
}

// Folder picker: resolves to a folder node or null
function mfPickFolder(title, blockNode){
  return new Promise(resolve => {
    let cur = mfBase || mfStorage.root;
    const m = document.createElement('div');
    m.className = 'mf-modal show'; m.style.zIndex = 10000;
    m.innerHTML = '<div class="mf-modal-box mf-pick-box"><div class="mf-modal-head"><span class="mf-modal-title"></span><button class="mf-mini" data-pk="x"><i class="fas fa-xmark"></i></button></div><div class="mf-pick-crumbs"></div><div class="mf-pick-list"></div><div class="mf-pick-foot"><button class="mf-btn" data-pk="x">Cancel</button><button class="mf-btn mf-primary" data-pk="ok"></button></div></div>';
    m.querySelector('.mf-modal-title').textContent = title;
    document.body.appendChild(m);
    const done = v => { m.remove(); resolve(v); };
    const isBlocked = n => { for(let x = n; x; x = x.parent){ if(blockNode && x === blockNode) return true; } return false; };
    function draw(){
      const chain = []; for(let x = cur; x; x = x.parent){ chain.unshift(x); if(x === (mfBase || mfStorage.root)) break; }
      const cr = m.querySelector('.mf-pick-crumbs');
      cr.innerHTML = '';
      chain.forEach((c, i) => {
        const b = document.createElement('button'); b.className = 'mf-crumb' + (i === chain.length - 1 ? ' active' : '');
        b.textContent = i === 0 ? 'My File' : (c.name || '');
        b.onclick = () => { cur = c; draw(); };
        cr.appendChild(b);
        if(i < chain.length - 1){ const sp = document.createElement('span'); sp.className = 'mf-sep'; sp.textContent = '/'; cr.appendChild(sp); }
      });
      const list = m.querySelector('.mf-pick-list'); list.innerHTML = '';
      const folders = (cur.children || []).filter(c => c.directory && !isBlocked(c))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      if(!folders.length){ const e = document.createElement('div'); e.className = 'mf-empty'; e.textContent = 'No sub-folders here.'; list.appendChild(e); }
      folders.forEach(f => {
        const b = document.createElement('button'); b.className = 'mf-pick-row';
        b.innerHTML = '<i class="fas fa-folder"></i><span></span>';
        b.lastChild.textContent = f.name || 'Folder';
        b.onclick = async () => { try{ if(f.load) await f.load(); }catch(_e){ return; } cur = f; draw(); };
        list.appendChild(b);
      });
      const ok = m.querySelector('[data-pk="ok"]');
      ok.textContent = 'Select this folder';
      ok.disabled = isBlocked(cur);
    }
    m.addEventListener('click', e => {
      const k = e.target.closest('[data-pk]');
      if(k){ e.stopPropagation(); if(k.dataset.pk === 'x') done(null); else if(!k.disabled) done(cur); }
      else if(e.target === m) done(null);
    });
    draw();
  });
}

async function mfMoveNode(node){
  const target = await mfPickFolder('Move "' + (node.name || 'item') + '" to...', node.directory ? node : null);
  if(!target) return;
  if(target === node.parent){ mfToast('Already in that folder.'); return; }
  try{ await node.moveTo(target); mfToast('Moved.'); mfRender(); }
  catch(err){ alert('Move failed: ' + (err.message || err)); }
}

function mfUniqueName(folder, name){
  const names = new Set((folder.children || []).map(c => c.name));
  if(!names.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
  let i = 1, cand;
  do{ cand = base + ' (copy' + (i > 1 ? ' ' + i : '') + ')' + ext; i++; }while(names.has(cand));
  return cand;
}
// Files are copied by download + re-upload (encrypted end to end, no public link needed)
async function mfCopyFileTo(node, folder, row){
  const pct = row.querySelector('.mf-up-pct'), fill = row.querySelector('.mf-bar-fill');
  pct.textContent = 'Reading...';
  const buf = new Uint8Array(await node.downloadBuffer());
  const name = mfUniqueName(folder, node.name || 'file');
  const up = folder.upload({ name, size: buf.length });
  up.on('progress', info => {
    const total = info.bytesTotal || buf.length || 1;
    const pp = Math.min(100, Math.round(((info.bytesUploaded != null ? info.bytesUploaded : info.bytesLoaded) || 0) / total * 100));
    pct.textContent = pp + '%'; fill.style.width = pp + '%';
  });
  up.end(buf);
  return await up.complete;
}
async function mfCopyFolderTo(node, folder, boxRow){
  const nf = await folder.mkdir(mfUniqueName(folder, node.name || 'Folder'));
  for(const c of (node.children || [])){
    if(c.directory) await mfCopyFolderTo(c, nf, boxRow);
    else await mfCopyFileTo(c, nf, boxRow);
  }
  return nf;
}
async function mfCopyNode(node){
  const target = await mfPickFolder('Copy "' + (node.name || 'item') + '" to...', node.directory ? node : null);
  if(!target) return;
  await mfDeepLoad(node);
  const files = [];
  (function walk(n){ if(n.directory) (n.children || []).forEach(walk); else files.push(n); })(node);
  const total = files.reduce((a, f) => a + (f.size || 0), 0);
  if(total > 100 * 1024 * 1024 && !confirm('This copy is ' + mfSize(total) + '. Files are copied by downloading and uploading again, which uses your MEGA bandwidth and can take a while. Continue?')) return;
  const box = document.getElementById('mfUploads');
  const row = document.createElement('div');
  row.className = 'mf-up';
  row.innerHTML = '<div class="mf-up-top"><span class="mf-up-name"></span><span class="mf-up-pct">0%</span></div><div class="mf-bar-bg"><div class="mf-bar-fill"></div></div>';
  row.querySelector('.mf-up-name').textContent = 'Copying: ' + (node.name || '');
  box.appendChild(row);
  try{
    if(node.directory) await mfCopyFolderTo(node, target, row);
    else await mfCopyFileTo(node, target, row);
    row.querySelector('.mf-up-pct').textContent = 'Done'; row.querySelector('.mf-bar-fill').style.width = '100%'; row.classList.add('done');
    setTimeout(() => row.remove(), 2500);
  }catch(err){
    row.querySelector('.mf-up-pct').textContent = 'Failed'; row.classList.add('fail'); row.title = (err && err.message) || 'Copy failed';
  }
  mfRender(); mfLoadSpace();
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  document.querySelectorAll('.mf-pop.show').forEach(p => {
    if(!(el && el.dataset.act === 'more' && p.parentElement.contains(el))) p.classList.remove('show');
  });
  if(!document.querySelector('.mf-pop.show')){ const l = document.getElementById('mfList'); if(l) l.style.paddingBottom = ''; }
  if(!el || !mfStorage) return;
  const act = el.dataset.act;
  if(act === 'more'){
    const pop = el.nextElementSibling;
    const willShow = !pop.classList.contains('show');
    pop.classList.toggle('show', willShow);
    if(willShow) mfFitPop(pop);
    else { const l = document.getElementById('mfList'); if(l) l.style.paddingBottom = ''; }
    return;
  }
  if(act === 'close'){ mfClosePreview(); return; }
  if(act === 'edit'){ mfStartEdit(); return; }
  if(act === 'save'){ mfSaveEdit(el); return; }
  if(act === 'cancel-edit'){ if(mfEditNode) mfShowText(mfEditNode, mfEditText); return; }
  const node = mfStorage.files[el.dataset.id];
  if(!node) return;
  if(act === 'crumb'){ mfGo(node); }
  else if(act === 'open'){
    if(node.directory){ mfQuery = ''; document.getElementById('mfSearch').value = ''; mfGo(node); }
    else mfPreview(node);
  }
  else if(act === 'astext'){ mfOpenAsText(node); }
  else if(act === 'dl'){ mfDownload(node); }
  else if(act === 'link'){ mfCopyLink(node); }
  else if(act === 'share'){ mfShare(node); }
  else if(act === 'unlink'){ mfRemoveLink(node); }
  else if(act === 'move'){ mfMoveNode(node); }
  else if(act === 'copy'){ mfCopyNode(node); }
  else if(act === 'pick-go'){ /* handled inside picker */ }
  else if(act === 'ren'){
    const nn = (prompt('Rename to:', node.name || '') || '').trim();
    if(!nn || nn === node.name) return;
    try{ await node.rename(nn); mfRender(); } catch(err){ alert('Rename failed: ' + (err.message || err)); }
  }
  else if(act === 'del'){
    if(!confirm('Delete "' + (node.name || 'this item') + '"? It will be moved to the MEGA Rubbish bin.')) return;
    try{ await node.delete(false); mfRender(); mfLoadSpace(); } catch(err){ alert('Delete failed: ' + (err.message || err)); }
  }
});

(function(){
  const zone = document.getElementById('mfDrop');
  if(!zone) return;
  ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', async e => {
    if(!e.dataTransfer) return;
    const r = await mfReadDropped(e.dataTransfer);
    mfUploadFiles(r.files, r.dirs);
  });
})();

function myfileLogout(){
  mfThumbCache.forEach(u => URL.revokeObjectURL(u)); mfThumbCache.clear(); mfThumbQueue = []; mfThumbPending.clear();
  if(!MF_PERSIST_THUMBS) mfDbClear();
  try{ if(mfStorage) mfStorage.close(); }catch(_e){}
  mfClosePreview(true);
  myfileToken = null; mfStorage = null; mfBase = null; mfCwd = null; mfQuery = '';
  document.getElementById('myfilePasswordField').value = '';
  document.getElementById('myfilePasswordField').type = 'password';
  document.getElementById('myfileEyeIcon').classList.replace('fa-eye-slash','fa-eye');
  document.getElementById('mfSearch').value = '';
  document.getElementById('mfList').innerHTML = '';
  document.getElementById('mfUploads').innerHTML = '';
  document.getElementById('myfileMain').classList.remove('active');
  document.getElementById('myfileAuthScreen').classList.add('active');
  document.getElementById('mfWrap').classList.remove('mf-wide');
  document.getElementById('myfileLockError').textContent = '';
}

// ---------- Card vault (password + list / copy card numbers) ----------
let cardToken = null;
let cardCache = [];

function cardToggleVisibility(){
  const pf = document.getElementById('cardPasswordField');
  const icon = document.getElementById('cardEyeIcon');
  if(pf.type === "password"){
    pf.type = "text";
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    pf.type = "password";
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function cardClearError(){
  const el = document.getElementById('cardLockError');
  if(el) el.textContent = '';
}

let cardInFlight = false;
async function cardTryLogin(){
  const val = document.getElementById('cardPasswordField').value.trim();
  const errorEl = document.getElementById('cardLockError');
  const btn = document.getElementById('cardSubmitBtn');
  if(!val || cardInFlight) return;
  cardInFlight = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Checking...';
  btn.disabled = true;
  try{
    cardToken = await apiLogin('card', val);
    errorEl.textContent = '';
    document.getElementById('cardAuthScreen').classList.remove('active');
    document.getElementById('cardMainMenu').classList.add('active');
    await loadCardList();
  }catch(err){
    errorEl.textContent = describeAuthError(err, 'login');
  }finally{
    btn.textContent = originalLabel;
    btn.disabled = false;
    cardInFlight = false;
  }
}

async function loadCardList(){
  const listEl = document.getElementById('cardList');
  const emptyEl = document.getElementById('cardEmptyHint');
  try{
    const res = await fetch(`${API_BASE}/cards?token=${encodeURIComponent(cardToken)}`);
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Failed');
    cardCache = data.cards || [];
    if(!cardCache.length){
      listEl.innerHTML = '';
      if(emptyEl) emptyEl.style.display = '';
      return;
    }
    if(emptyEl) emptyEl.style.display = 'none';
    listEl.innerHTML = cardCache.map(c => {
      const brand = detectCardBrand(c.number);
      const grouped = formatCardGroups(c.number);
      const fullGrouped = formatFullCardNumber(c.number);
      const exp = (c.note || '').trim() || '••/••';
      const cvvShow = (c.cvv || '').trim() || '•••';
      const brandLabel = brandLabelText(brand);
      const logoUrl = (c.logo || '').trim();
      const companyName = (c.company || '').trim();
      const logoHtml = logoUrl
        ? `<img class="pc-logo" src="${escapeHtml(logoUrl)}" alt="logo" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex');"><div class="pc-logo-fallback" style="display:none;"><i class="fas fa-building"></i></div>`
        : `<div class="pc-logo-fallback"><i class="fas fa-building"></i></div>`;
      const companyHtml = companyName
        ? `<div class="pc-company-name">${escapeHtml(companyName)}</div>`
        : '';
      return `<div class="pc-swipe-wrap" data-id="${c.id}">
        <button type="button" class="pc-swipe-edit" title="Edit" onclick="cardEdit(${c.id})">
          <i class="fas fa-pencil"></i>
        </button>
        <button type="button" class="pc-swipe-delete" title="Delete" onclick="cardDelete(${c.id})">
          <i class="fas fa-trash"></i>
        </button>
        <div class="plastic-card brand-${brand}" data-id="${c.id}">
          <div class="pc-top">
            <div class="pc-company-wrap">
              ${logoHtml}
              ${companyHtml}
            </div>
            <div class="pc-brand">${brandLabel}</div>
          </div>
          <div class="pc-number-row">
            <div class="pc-number" data-masked="${grouped}" data-full="${fullGrouped}">${grouped}</div>
            <div class="pc-num-actions">
              <button type="button" class="pc-num-btn" title="Show / hide number" onclick="event.stopPropagation(); cardToggleNumber(${c.id}, this)">
                <i class="fas fa-eye"></i>
              </button>
              <button type="button" class="pc-num-btn" title="Copy number" onclick="event.stopPropagation(); cardCopyNumber(${c.id})">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
          <div class="pc-bottom">
            <div>
              <div class="pc-label">Card Holder</div>
              <div class="pc-name">${escapeHtml(c.name || 'CARD')}</div>
            </div>
            <div style="text-align:right;">
              <div class="pc-label">Valid Thru</div>
              <div class="pc-exp">${escapeHtml(exp)}</div>
            </div>
            <div class="pc-cvv-wrap">
              <div class="pc-label">CVV</div>
              <div class="pc-cvv">${escapeHtml(cvvShow)}</div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
    initCardSwipeRows();
  }catch(e){
    alert('Your session has expired, please log in again.');
    cardLogout();
  }
}

function detectCardBrand(num){
  const d = String(num || '').replace(/\D/g, '');
  if(/^4/.test(d)) return 'visa';
  if(/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  if(/^3[47]/.test(d)) return 'amex';
  if(/^(6011|65|64[4-9])/.test(d)) return 'discover';
  return 'default';
}

function brandLabelText(brand){
  return ({ visa:'VISA', mastercard:'Mastercard', amex:'AMEX', discover:'Discover', default:'CARD' })[brand] || 'CARD';
}

function formatCardGroups(num){
  const d = String(num || '').replace(/\D/g, '');
  if(d.length <= 4) return d || '••••';
  const last4 = d.slice(-4);
  if(/^3[47]/.test(d)){
    return `•••• •••••• ${last4}`;
  }
  return `•••• •••• •••• ${last4}`;
}

function formatFullCardNumber(num){
  const d = String(num || '').replace(/\D/g, '');
  if(!d) return '••••';
  if(/^3[47]/.test(d)){
    // Amex: 4-6-5
    return [d.slice(0,4), d.slice(4,10), d.slice(10,15)].filter(Boolean).join(' ');
  }
  // standard 4-4-4-4
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function maskCardNumber(num){
  return formatCardGroups(num);
}

function cardToggleNumber(id, btn){
  const card = document.querySelector(`#cardList .plastic-card[data-id="${id}"]`);
  if(!card) return;
  const numEl = card.querySelector('.pc-number');
  if(!numEl) return;
  const icon = btn.querySelector('i');
  const showing = btn.classList.contains('is-on');
  if(showing){
    numEl.textContent = numEl.dataset.masked || formatCardGroups('');
    btn.classList.remove('is-on');
    if(icon){ icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
    btn.title = 'Show number';
  } else {
    numEl.textContent = numEl.dataset.full || numEl.textContent;
    btn.classList.add('is-on');
    if(icon){ icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
    btn.title = 'Hide number';
  }
}

async function cardCopyNumber(id){
  const item = cardCache.find(c => c.id === id);
  if(!item) return;
  const raw = String(item.number).replace(/\s/g, '');
  try{
    await navigator.clipboard.writeText(raw);
    const el = document.querySelector(`#cardList .plastic-card[data-id="${id}"]`);
    if(el){
      const toast = document.createElement('div');
      toast.className = 'pc-copied';
      toast.innerHTML = '<i class="fas fa-check"></i>&nbsp; COPIED';
      el.appendChild(toast);
      setTimeout(() => toast.remove(), 1200);
    }
  }catch{
    prompt('Copy this number:', raw);
  }
}

const CARD_DELETE_PIN = '889900';

let cardEditId = null;
let cardPinResolver = null;

function cardPinToggleEye(){
  const pf = document.getElementById('cardPinField');
  const icon = document.getElementById('cardPinEye');
  if(!pf || !icon) return;
  if(pf.type === 'password'){
    pf.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    pf.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function cardAskPin(title){
  return new Promise((resolve) => {
    cardPinResolver = resolve;
    document.getElementById('cardPinTitle').textContent = title || 'Enter Password';
    const field = document.getElementById('cardPinField');
    field.value = '';
    field.type = 'password';
    const icon = document.getElementById('cardPinEye');
    if(icon){ icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
    document.getElementById('cardPinError').textContent = '';
    document.getElementById('cardPinModal').classList.add('active');
    requestAnimationFrame(() => field.focus());
  });
}

function cardPinCancel(){
  document.getElementById('cardPinModal').classList.remove('active');
  if(cardPinResolver){
    const r = cardPinResolver;
    cardPinResolver = null;
    r(false);
  }
}

function cardPinConfirm(){
  const val = document.getElementById('cardPinField').value.trim();
  const err = document.getElementById('cardPinError');
  if(val !== CARD_DELETE_PIN){
    err.textContent = 'Incorrect password';
    return;
  }
  document.getElementById('cardPinModal').classList.remove('active');
  if(cardPinResolver){
    const r = cardPinResolver;
    cardPinResolver = null;
    r(true);
  }
}

function cardOpenAddModal(){
  cardEditId = null;
  document.getElementById('cardModalTitle').textContent = 'Add Card';
  document.getElementById('cardAddSaveBtn').textContent = 'Add';
  document.getElementById('cardNewName').value = '';
  document.getElementById('cardNewNumber').value = '';
  document.getElementById('cardNewNote').value = '';
  const cvvEl = document.getElementById('cardNewCvv');
  if(cvvEl) cvvEl.value = '';
  const logoEl = document.getElementById('cardNewLogo');
  if(logoEl) logoEl.value = '';
  const companyEl = document.getElementById('cardNewCompany');
  if(companyEl) companyEl.value = '';
  document.getElementById('cardAddError').textContent = '';
  document.getElementById('cardAddModal').classList.add('active');
}

function cardCloseAddModal(){
  cardEditId = null;
  document.getElementById('cardAddModal').classList.remove('active');
}

async function cardEdit(id){
  cardCloseAllSwipes();
  const ok = await cardAskPin('Edit — Enter Password');
  if(!ok) return;
  const item = cardCache.find(c => c.id === id);
  if(!item) return;
  cardEditId = id;
  document.getElementById('cardModalTitle').textContent = 'Edit Card';
  document.getElementById('cardAddSaveBtn').textContent = 'Save';
  document.getElementById('cardNewName').value = item.name || '';
  document.getElementById('cardNewNumber').value = formatFullCardNumber(item.number);
  document.getElementById('cardNewNote').value = item.note || '';
  const cvvEl = document.getElementById('cardNewCvv');
  if(cvvEl) cvvEl.value = item.cvv || '';
  const logoEl = document.getElementById('cardNewLogo');
  if(logoEl) logoEl.value = item.logo || '';
  const companyEl = document.getElementById('cardNewCompany');
  if(companyEl) companyEl.value = item.company || '';
  document.getElementById('cardAddError').textContent = '';
  document.getElementById('cardAddModal').classList.add('active');
}

let cardAddInFlight = false;
async function cardSubmitNew(){
  const name = document.getElementById('cardNewName').value.trim();
  const number = document.getElementById('cardNewNumber').value.trim();
  const note = document.getElementById('cardNewNote').value.trim();
  const cvv = (document.getElementById('cardNewCvv')?.value || '').trim();
  const logo = (document.getElementById('cardNewLogo')?.value || '').trim();
  const company = (document.getElementById('cardNewCompany')?.value || '').trim();
  const errorEl = document.getElementById('cardAddError');
  const btn = document.getElementById('cardAddSaveBtn');
  if(cardAddInFlight) return;
  if(!name || !number){
    errorEl.textContent = 'Name and card number are required.';
    return;
  }
  const digits = number.replace(/\D/g, '');
  if(digits.length < 12 || digits.length > 19){
    errorEl.textContent = 'Enter a valid card number (12–19 digits).';
    return;
  }
  const cvvDigits = cvv.replace(/\D/g, '');
  if(cvvDigits && (cvvDigits.length < 3 || cvvDigits.length > 4)){
    errorEl.textContent = 'CVV must be 3 or 4 digits.';
    return;
  }
  if(logo){
    try { new URL(logo); } catch {
      errorEl.textContent = 'Logo must be a valid URL (https://...)';
      return;
    }
  }
  cardAddInFlight = true;
  const isEdit = cardEditId !== null;
  btn.textContent = isEdit ? 'Saving...' : 'Adding...';
  btn.disabled = true;
  try{
    const endpoint = isEdit ? 'cards/update' : 'cards/add';
    const payload = isEdit
      ? { token: cardToken, id: cardEditId, name, number: digits, note, cvv: cvvDigits, logo, company }
      : { token: cardToken, name, number: digits, note, cvv: cvvDigits, logo, company };
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || (isEdit ? 'Could not update card' : 'Could not add card'));
    cardCloseAddModal();
    await loadCardList();
  }catch(err){
    errorEl.textContent = err.message || 'Something went wrong';
  }finally{
    btn.textContent = isEdit ? 'Save' : 'Add';
    btn.disabled = false;
    cardAddInFlight = false;
  }
}

async function cardDelete(id){
  cardCloseAllSwipes();
  const ok = await cardAskPin('Delete — Enter Password');
  if(!ok) return;
  try{
    const res = await fetch(`${API_BASE}/cards/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cardToken, id })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error);
    await loadCardList();
  }catch(e){
    alert('Could not remove this card, please try again.');
  }
}

const CARD_SWIPE_W = 78;

function cardCloseAllSwipes(){
  document.querySelectorAll('.pc-swipe-wrap').forEach(row => {
    row.classList.remove('is-open-left', 'is-open-right', 'is-dragging');
    const card = row.querySelector('.plastic-card');
    if(card){
      card.style.transition = '';
      card.style.transform = '';
    }
  });
}

function initCardSwipeRows(){
  document.querySelectorAll('.pc-swipe-wrap').forEach(row => {
    if(row.dataset.swipeReady) return;
    row.dataset.swipeReady = '1';
    const card = row.querySelector('.plastic-card');
    if(!card) return;

    let startX = 0, startY = 0, startOffset = 0, dragging = false, axisLocked = null;
    let blockClickUntil = 0;

    function getOffset(){
      if(row.classList.contains('is-open-left')) return CARD_SWIPE_W;
      if(row.classList.contains('is-open-right')) return -CARD_SWIPE_W;
      return 0;
    }

    function applyOffset(x){
      const clamped = Math.max(-CARD_SWIPE_W, Math.min(CARD_SWIPE_W, x));
      card.style.transition = 'none';
      card.style.transform = clamped ? `translateX(${clamped}px)` : '';
      return clamped;
    }

    function snap(offset){
      row.classList.remove('is-open-left', 'is-open-right');
      card.style.transition = 'transform 0.25s var(--ease)';
      if(offset > CARD_SWIPE_W * 0.35){
        row.classList.add('is-open-left');
        card.style.transform = `translateX(${CARD_SWIPE_W}px)`;
      } else if(offset < -CARD_SWIPE_W * 0.35){
        row.classList.add('is-open-right');
        card.style.transform = `translateX(-${CARD_SWIPE_W}px)`;
      } else {
        card.style.transform = '';
      }
    }

    function onStart(clientX, clientY){
      startX = clientX;
      startY = clientY;
      startOffset = getOffset();
      dragging = true;
      axisLocked = null;
      row.classList.remove('is-dragging');
      card.style.transition = 'none';
      document.querySelectorAll('.pc-swipe-wrap').forEach(other => {
        if(other !== row){
          other.classList.remove('is-open-left', 'is-open-right', 'is-dragging');
          const oc = other.querySelector('.plastic-card');
          if(oc){ oc.style.transition = ''; oc.style.transform = ''; }
        }
      });
    }

    function onMove(clientX, clientY){
      if(!dragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if(axisLocked === null){
        if(Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if(axisLocked !== 'x') return;
      if(Math.abs(dx) > 8) row.classList.add('is-dragging');
      applyOffset(startOffset + dx);
    }

    function onEnd(clientX){
      if(!dragging) return;
      dragging = false;
      row.classList.remove('is-dragging');
      if(axisLocked !== 'x'){
        card.style.transition = 'transform 0.25s var(--ease)';
        card.style.transform = getOffset() ? `translateX(${getOffset()}px)` : '';
        return;
      }
      const dx = clientX - startX;
      if(Math.abs(dx) > 8) blockClickUntil = Date.now() + 400;
      snap(startOffset + dx);
    }

    card.addEventListener('click', (e) => {
      if(Date.now() < blockClickUntil){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if(row.classList.contains('is-open-left') || row.classList.contains('is-open-right')){
        e.preventDefault();
        e.stopPropagation();
        cardCloseAllSwipes();
      }
    }, true);

    card.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      onStart(touch.clientX, touch.clientY);
    }, { passive:true });

    card.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      if(axisLocked === 'x') e.preventDefault();
      onMove(touch.clientX, touch.clientY);
    }, { passive:false });

    card.addEventListener('touchend', (e) => {
      const touch = e.changedTouches[0];
      onEnd(touch.clientX);
    });

    card.addEventListener('mousedown', (e) => {
      if(e.button !== 0) return;
      e.preventDefault();
      onStart(e.clientX, e.clientY);
      const onMouseMove = (ev) => onMove(ev.clientX, ev.clientY);
      const onMouseUp = (ev) => {
        onEnd(ev.clientX);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

document.addEventListener('click', (e) => {
  if(!e.target.closest('.pc-swipe-wrap') && !e.target.closest('.sec-modal-overlay')) cardCloseAllSwipes();
});


function cardLogout(){
  cardToken = null;
  cardCache = [];
  cardCloseAddModal();
  const listEl = document.getElementById('cardList');
  if(listEl) listEl.innerHTML = '';
  const emptyEl = document.getElementById('cardEmptyHint');
  if(emptyEl) emptyEl.style.display = '';
  const pf = document.getElementById('cardPasswordField');
  if(pf){ pf.value = ''; pf.type = 'password'; }
  const icon = document.getElementById('cardEyeIcon');
  if(icon){ icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
  document.getElementById('cardMainMenu')?.classList.remove('active');
  document.getElementById('cardAuthScreen')?.classList.add('active');
  const err = document.getElementById('cardLockError');
  if(err) err.textContent = '';
}

function cvOnInput(){ cvModule.onInput(); }
function cvSubmit(e){ cvModule.submit(e); }
function cvToggleVisibility(){ cvModule.toggleVisibility(); }
function cvResetLock(){ cvModule.resetLock(); }

function diplomaOnInput(){ diplomaModule.onInput(); }
function diplomaSubmit(e){ diplomaModule.submit(e); }
function diplomaToggleVisibility(){ diplomaModule.toggleVisibility(); }
function diplomaResetLock(){ diplomaModule.resetLock(); }

function schoolOnInput(){ schoolModule.onInput(); }
function schoolSubmit(e){ schoolModule.submit(e); }
function schoolToggleVisibility(){ schoolModule.toggleVisibility(); }
function schoolResetLock(){ schoolModule.resetLock(); }

function citizenOnInput(){ citizenModule.onInput(); }
function citizenSubmit(e){ citizenModule.submit(e); }
function citizenToggleVisibility(){ citizenModule.toggleVisibility(); }
function citizenResetLock(){ citizenModule.resetLock(); }

function passportOnInput(){ passportModule.onInput(); }
function passportSubmit(e){ passportModule.submit(e); }
function passportToggleVisibility(){ passportModule.toggleVisibility(); }
function passportResetLock(){ passportModule.resetLock(); }

function nidOnInput(){ nidModule.onInput(); }
function nidSubmit(e){ nidModule.submit(e); }
function nidToggleVisibility(){ nidModule.toggleVisibility(); }
function nidResetLock(){ nidModule.resetLock(); }

let secToken = null;

function secToggleVisibility(){
  const pf = document.getElementById('secPasswordField');
  const icon = document.getElementById('secEyeIcon');
  if(pf.type === "password"){
    pf.type = "text";
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    pf.type = "password";
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function secClearError(){
  document.getElementById('secLockError').textContent = '';
}

let secInFlight = false;
async function secTryLogin(){
  const val = document.getElementById('secPasswordField').value.trim();
  const errorEl = document.getElementById('secLockError');
  const btn = document.getElementById('secSubmitBtn');
  if(!val || secInFlight) return;
  secInFlight = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Checking...';
  btn.disabled = true;
  try{
    secToken = await apiLogin('security', val);
    errorEl.textContent = '';
    document.getElementById('secAuthScreen').classList.remove('active');
    document.getElementById('secMainMenu').classList.add('active');
    loadSecDashboard();
  }catch(err){
    errorEl.textContent = describeAuthError(err, 'login');
  }finally{
    btn.textContent = originalLabel;
    btn.disabled = false;
    secInFlight = false;
  }
}

let secLinksCache = null;
let secCustomCache = [];

async function loadSecDashboard(){
  try{
    const res = await fetch(`${API_BASE}/security-links?token=${encodeURIComponent(secToken)}`);
    const data = await res.json();
    if(!res.ok) throw new Error(data.error);
    secLinksCache = data.links || {};
    secCustomCache = data.custom || [];
    renderSecCustomBtns();
  }catch(e){
    // If this fails we just fall back to lazy-loading inside secOpenLink.
  }
}

function secCustomIcon(name, url){
  const hay = `${name || ''} ${url || ''}`.toLowerCase();
  if(/\byt\b|youtube|youtu\.be/.test(hay)) return 'fab fa-youtube';
  if(/facebook|fb\./.test(hay)) return 'fab fa-facebook';
  if(/instagram|instagr\./.test(hay)) return 'fab fa-instagram';
  if(/google|gmail/.test(hay)) return 'fab fa-google';
  if(/twitter|\bx\.com\b/.test(hay)) return 'fab fa-x-twitter';
  if(/mega\.nz|mega\.co/.test(hay)) return 'fas fa-cloud';
  if(/netflix/.test(hay)) return 'fas fa-film';
  if(/github/.test(hay)) return 'fab fa-github';
  if(/linkedin/.test(hay)) return 'fab fa-linkedin';
  if(/whatsapp/.test(hay)) return 'fab fa-whatsapp';
  if(/telegram|t\.me/.test(hay)) return 'fab fa-telegram';
  return 'fas fa-link';
}

function renderSecCustomBtns(){
  const wrap = document.getElementById('secCustomBtns');
  if(!wrap) return;
  wrap.innerHTML = secCustomCache.map(item => `
    <div class="sec-swipe-row" data-id="${item.id}">
      <div class="sec-swipe-action sec-swipe-action-left" onclick="secOpenEditSettings(${item.id})" title="Edit">
        <i class="fas fa-pencil"></i>
      </div>
      <div class="sec-swipe-action sec-swipe-action-right" onclick="secDeleteCustomLink(${item.id})" title="Remove">
        <i class="fas fa-trash"></i>
      </div>
      <div class="sec-swipe-content">
        <button type="button" class="sec-btn sec-swipe-open-btn" data-link-key="custom_${item.id}">
          <i class="${secCustomIcon(item.name, item.url)}"></i> ${escapeHtml(item.name)}
        </button>
      </div>
    </div>
  `).join('');
  initSecSwipeRows();
}

const SEC_SWIPE_WIDTH = 72;

function secCloseAllSwipeRows(){
  document.querySelectorAll('.sec-swipe-row').forEach(row => {
    row.classList.remove('is-open-left', 'is-open-right', 'is-dragging');
    const content = row.querySelector('.sec-swipe-content');
    if(content){
      content.style.transition = '';
      content.style.transform = '';
    }
  });
}

function initSecSwipeRows(){
  document.querySelectorAll('.sec-swipe-row').forEach(row => {
    if(row.dataset.swipeReady) return;
    row.dataset.swipeReady = '1';

    const content = row.querySelector('.sec-swipe-content');
    const btn = row.querySelector('.sec-swipe-open-btn');
    if(!content || !btn) return;

    let startX = 0, startY = 0, startOffset = 0, dragging = false, axisLocked = null;
    let blockClickUntil = 0;

    function blockLinkClick(){
      blockClickUntil = Date.now() + 450;
    }

    btn.addEventListener('click', (e) => {
      if(Date.now() < blockClickUntil){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if(row.classList.contains('is-open-left') || row.classList.contains('is-open-right')){
        e.preventDefault();
        secCloseAllSwipeRows();
        return;
      }
      secOpenLink(btn.dataset.linkKey);
    });

    function getOffset(){
      if(row.classList.contains('is-open-left')) return SEC_SWIPE_WIDTH;
      if(row.classList.contains('is-open-right')) return -SEC_SWIPE_WIDTH;
      return 0;
    }

    function applyOffset(x, animate){
      const clamped = Math.max(-SEC_SWIPE_WIDTH, Math.min(SEC_SWIPE_WIDTH, x));
      content.style.transition = animate ? 'transform 0.25s var(--ease)' : 'none';
      content.style.transform = clamped ? `translateX(${clamped}px)` : '';
      return clamped;
    }

    function snap(offset){
      row.classList.remove('is-open-left', 'is-open-right');
      content.style.transition = 'transform 0.25s var(--ease)';
      if(offset > SEC_SWIPE_WIDTH * 0.35){
        row.classList.add('is-open-left');
        content.style.transform = `translateX(${SEC_SWIPE_WIDTH}px)`;
      } else if(offset < -SEC_SWIPE_WIDTH * 0.35){
        row.classList.add('is-open-right');
        content.style.transform = `translateX(-${SEC_SWIPE_WIDTH}px)`;
      } else {
        content.style.transform = '';
      }
    }

    function onStart(clientX, clientY){
      startX = clientX;
      startY = clientY;
      startOffset = getOffset();
      dragging = true;
      axisLocked = null;
      row.classList.remove('is-dragging');
      content.style.transition = 'none';
      document.querySelectorAll('.sec-swipe-row').forEach(other => {
        if(other !== row) other.classList.remove('is-open-left', 'is-open-right', 'is-dragging');
      });
    }

    function onMove(clientX, clientY){
      if(!dragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if(axisLocked === null){
        if(Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if(axisLocked !== 'x') return;
      if(Math.abs(dx) > 8) row.classList.add('is-dragging');
      applyOffset(startOffset + dx, false);
    }

    function onEnd(clientX){
      if(!dragging) return;
      dragging = false;
      row.classList.remove('is-dragging');
      if(axisLocked !== 'x'){
        content.style.transition = 'transform 0.25s var(--ease)';
        content.style.transform = getOffset() ? `translateX(${getOffset()}px)` : '';
        return;
      }
      const dx = clientX - startX;
      if(Math.abs(dx) > 8) blockLinkClick();
      snap(startOffset + dx);
      if(row.classList.contains('is-open-left') || row.classList.contains('is-open-right')){
        blockLinkClick();
      }
    }

    content.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive:true });

    content.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if(axisLocked === 'x') e.preventDefault();
      onMove(t.clientX, t.clientY);
    }, { passive:false });

    content.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      onEnd(t.clientX);
    });

    content.addEventListener('mousedown', (e) => {
      if(e.button !== 0 || e.target.closest('.sec-swipe-action')) return;
      e.preventDefault();
      onStart(e.clientX, e.clientY);
      const onMouseMove = (ev) => onMove(ev.clientX, ev.clientY);
      const onMouseUp = (ev) => {
        onEnd(ev.clientX);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

document.addEventListener('click', (e) => {
  if(!e.target.closest('.sec-swipe-row')) secCloseAllSwipeRows();
});

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function secOpenLink(key){
  try{
    if(!secLinksCache){
      const res = await fetch(`${API_BASE}/security-links?token=${encodeURIComponent(secToken)}`);
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      secLinksCache = data.links;
      secCustomCache = data.custom || [];
    }
    let link;
    if(key.startsWith('custom_')){
      const id = Number(key.slice('custom_'.length));
      const item = secCustomCache.find(c => c.id === id);
      link = item && item.url;
    } else {
      link = secLinksCache[key];
    }
    if(link) window.open(link, '_blank');
  }catch(e){
    alert('Your session has expired, please log in again.');
    secLogout();
  }
}

let secEditId = null;

function secOpenSettings(){
  secEditId = null;
  document.getElementById('secModalTitle').textContent = 'Add New Service';
  document.getElementById('secAddSaveBtn').textContent = 'Add';
  document.getElementById('secNewName').value = '';
  document.getElementById('secNewLink').value = '';
  document.getElementById('secAddError').textContent = '';
  document.getElementById('secAddModal').classList.add('active');
}

function secOpenEditSettings(id){
  const item = secCustomCache.find(c => c.id === id);
  if(!item) return;
  secCloseAllSwipeRows();
  secEditId = id;
  document.getElementById('secModalTitle').textContent = 'Edit Service';
  document.getElementById('secAddSaveBtn').textContent = 'Save';
  document.getElementById('secNewName').value = item.name;
  document.getElementById('secNewLink').value = item.url;
  document.getElementById('secAddError').textContent = '';
  document.getElementById('secAddModal').classList.add('active');
}

function secCloseSettings(){
  secEditId = null;
  document.getElementById('secAddModal').classList.remove('active');
}

let secAddInFlight = false;
async function secSubmitNewLink(){
  const name = document.getElementById('secNewName').value.trim();
  const link = document.getElementById('secNewLink').value.trim();
  const errorEl = document.getElementById('secAddError');
  const btn = document.getElementById('secAddSaveBtn');
  const isEdit = secEditId !== null;
  if(secAddInFlight) return;
  if(!name || !link){
    errorEl.textContent = 'Please fill in both fields.';
    return;
  }
  secAddInFlight = true;
  const originalLabel = btn.textContent;
  btn.textContent = isEdit ? 'Saving...' : 'Adding...';
  btn.disabled = true;
  try{
    const endpoint = isEdit ? 'security-links/update' : 'security-links/add';
    const payload = isEdit
      ? { token: secToken, id: secEditId, name, link }
      : { token: secToken, name, link };
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || (isEdit ? 'Could not update this service' : 'Could not add this service'));
    errorEl.textContent = '';
    secCloseSettings();
    await loadSecDashboard();
  }catch(err){
    errorEl.textContent = err.message || 'Something went wrong, please try again.';
  }finally{
    btn.textContent = originalLabel;
    btn.disabled = false;
    secAddInFlight = false;
  }
}

async function secDeleteCustomLink(id){
  secCloseAllSwipeRows();
  if(!confirm('Remove this service from the Vault?')) return;
  try{
    const res = await fetch(`${API_BASE}/security-links/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: secToken, id })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error);
    await loadSecDashboard();
  }catch(e){
    alert('Could not remove this service, please try again.');
  }
}

function secLogout(){
  secToken = null;
  secLinksCache = null;
  secCustomCache = [];
  secEditId = null;
  secCloseSettings();
  const customWrap = document.getElementById('secCustomBtns');
  if(customWrap) customWrap.innerHTML = '';
  document.getElementById('secPasswordField').value = "";
  document.getElementById('secPasswordField').type = "password";
  document.getElementById('secEyeIcon').classList.replace('fa-eye-slash', 'fa-eye');
  document.getElementById('secMainMenu').classList.remove('active');
  document.getElementById('secAuthScreen').classList.add('active');
  document.getElementById('secLockError').textContent = '';
}


(function(){
  const progressEl = document.getElementById('scrollProgress');
  const backToTop = document.getElementById('backToTop');
  function onScroll(){
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const top = window.scrollY || doc.scrollTop;
    const pct = max > 0 ? (top / max) * 100 : 0;
    if(progressEl) progressEl.style.width = pct + '%';
    if(backToTop) backToTop.classList.toggle('show', top > 400);
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
  if(backToTop){
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }
  const footerToTop = document.getElementById('footerToTop');
  if(footerToTop){
    footerToTop.addEventListener('click', () => {
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }

  const revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold:0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  const navIndicator = document.getElementById('navIndicator');
  const navLinks = document.querySelectorAll('nav a[data-view]');
  function moveNavIndicator(){
    if(!navIndicator) return;
    const active = document.querySelector('nav a[data-view].active') || navLinks[0];
    if(!active) return;
    navIndicator.style.height = active.offsetHeight + 'px';
    navIndicator.style.transform = `translateY(${active.offsetTop}px)`;
    navIndicator.classList.add('ready');
  }
  navLinks.forEach(link => link.addEventListener('click', () => setTimeout(moveNavIndicator, 0)));
  window.addEventListener('resize', moveNavIndicator);
  setTimeout(moveNavIndicator, 50);

})();