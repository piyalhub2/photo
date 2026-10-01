/* ===== Fingerprint / Face unlock (Passkeys) =====
   main.js ar myfile-drive.js-er PORE load korte hobe.
   Password ager moto-i kaj kore; passkey shudhu extra shortcut. */
(function () {
  const PK_AUTO = true;                 // section khulle nijei fingerprint/face chaibe (false korle shudhu button)
  const MAGIC = '__passkey__';
  const CATS = {
    security: ['secPasswordField', 'secTryLogin'],
    private:  ['privPasswordField', 'privTryLogin'],
    card:     ['cardPasswordField', 'cardTryLogin'],
    myfile:   ['myfilePasswordField', 'myfileTryLogin'],
    cv:       ['cvPasswordField', 'cvSubmit'],
    diploma:  ['diplomaPasswordField', 'diplomaSubmit'],
    school:   ['schoolPasswordField', 'schoolSubmit'],
    citizen:  ['citizenPasswordField', 'citizenSubmit'],
    passport: ['passportPasswordField', 'passportSubmit'],
    nid:      ['nidPasswordField', 'nidSubmit']
  };
  // je dashboard theke device add/remove kora jabe
  const MANAGE = {
    security: ['secMainMenu',  () => secToken],
    card:     ['cardMainMenu', () => cardToken],
    private:  ['privMainMenu', () => privToken]
  };

  const supported = !!(window.PublicKeyCredential && navigator.credentials);
  const enrolled = () => { try { return localStorage.getItem('pkEnrolled') === '1'; } catch (_e) { return false; } };
  const enc = s => new TextEncoder().encode(s);
  const b64u = buf => { let s = ''; new Uint8Array(buf).forEach(x => s += String.fromCharCode(x)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  const say = m => { try { mfToast(m); } catch (_e) { alert(m); } };

  async function post(path, body) {
    const r = await fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
    return d;
  }

  // apiLogin wrap: passkey token thakle password-er bodole oita dei (baki sob logic ager moto)
  const pending = {};
  const _apiLogin = apiLogin;
  apiLogin = async function (category, password) {
    if (password === MAGIC && pending[category]) { const t = pending[category]; delete pending[category]; return t; }
    return _apiLogin(category, password);
  };

  const busy = {};
  async function unlock(cat, quiet) {
    const m = CATS[cat];
    if (!supported || !m || busy[cat]) return;
    busy[cat] = true;
    try {
      const o = await post('/passkey/login-options', { category: cat });
      const cred = await navigator.credentials.get({ publicKey: { challenge: enc(o.challenge), rpId: o.rpId, userVerification: 'required', timeout: 60000 } });
      const r = cred.response;
      const d = await post('/passkey/login', {
        category: cat, id: cred.id,
        clientDataJSON: b64u(r.clientDataJSON), authenticatorData: b64u(r.authenticatorData), signature: b64u(r.signature)
      });
      pending[cat] = d.token;
      const f = document.getElementById(m[0]);
      f.value = MAGIC;
      window[m[1]]();
      setTimeout(() => { if (f.value === MAGIC) f.value = ''; }, 10000);
    } catch (e) {
      const cancelled = e && (e.name === 'NotAllowedError' || e.name === 'AbortError');
      if (!quiet || !cancelled) say(cancelled ? 'Fingerprint/Face kaj kore ni. Password din.' : (e.message || 'Passkey error'));
    } finally { busy[cat] = false; }
  }

  function deviceLabel() {
    const u = navigator.userAgent;
    const os = /Android/i.test(u) ? 'Android' : /iPhone|iPad/i.test(u) ? 'iPhone/iPad' : /Windows/i.test(u) ? 'Windows' : /Mac/i.test(u) ? 'Mac' : /Linux/i.test(u) ? 'Linux' : 'Device';
    return os + ' · ' + new Date().toLocaleDateString();
  }

  async function enroll(cat, tok) {
    const o = await post('/passkey/reg-options', { token: tok, category: cat });
    let cred;
    try {
      cred = await navigator.credentials.create({ publicKey: {
        challenge: enc(o.challenge), rp: o.rp,
        user: { id: enc(o.user.id), name: o.user.name, displayName: o.user.displayName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
        excludeCredentials: o.exclude.map(id => ({ type: 'public-key', id: unb64u(id) })),
        attestation: 'none', timeout: 60000
      } });
    } catch (e) {
      if (e && e.name === 'InvalidStateError') throw new Error('Ei device-e ager thekei chalu ache');
      throw e;
    }
    const r = cred.response;
    if (!r.getPublicKey) throw new Error('Ei browser purono, update korun');
    await post('/passkey/register', {
      token: tok, category: cat, id: cred.id,
      clientDataJSON: b64u(r.clientDataJSON), authenticatorData: b64u(r.getAuthenticatorData()),
      publicKey: b64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(), label: deviceLabel()
    });
    try { localStorage.setItem('pkEnrolled', '1'); } catch (_e) {}
    addUnlockButtons();
  }

  /* ---------- UI ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .pk-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin:0 0 14px;padding:12px;border-radius:50px;border:1px solid var(--border-strong);background:var(--cyan-soft);color:var(--text);font:inherit;font-size:.92rem;font-weight:600;cursor:pointer;transition:.2s}
  .pk-btn:hover{border-color:var(--cyan);transform:translateY(-2px)}
  .hide-el + .pk-btn{display:none !important}
  .pk-ov{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px}
  .pk-box{width:min(420px,100%);background:var(--surface-solid);border:1px solid var(--border-strong);border-radius:16px;padding:22px;color:var(--text);text-align:left}
  .pk-box h3{margin:0 0 4px;font-family:'Fraunces',serif}
  .pk-box p{margin:0 0 14px;color:var(--text-dim);font-size:.85rem;line-height:1.6}
  .pk-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:var(--surface);font-size:.88rem}
  .pk-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pk-row button{background:none;border:1px solid var(--border);color:var(--danger);border-radius:8px;cursor:pointer;padding:5px 9px}
  .pk-act{display:flex;gap:8px;margin-top:14px}
  .pk-act button{flex:1;padding:11px;border-radius:50px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font:inherit;font-weight:600;cursor:pointer}
  .pk-act .pk-main{background:linear-gradient(135deg,var(--gold),#B98F4C);color:#12100A;border:none}`;
  document.head.appendChild(css);

  function addUnlockButtons() {
    if (!supported || !enrolled()) return;
    Object.keys(CATS).forEach(cat => {
      const f = document.getElementById(CATS[cat][0]); if (!f) return;
      const wrap = f.closest('.sec-input-wrap,.cv-input-wrap');
      if (!wrap || (wrap.nextElementSibling && wrap.nextElementSibling.classList.contains('pk-btn'))) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pk-btn';
      b.innerHTML = '<i class="fas fa-fingerprint"></i> Fingerprint / Face';
      b.onclick = () => unlock(cat);
      wrap.after(b);
    });
  }

  function addManageButtons() {
    if (!supported) return;
    Object.keys(MANAGE).forEach(cat => {
      const host = document.getElementById(MANAGE[cat][0]);
      if (!host || host.querySelector('.pk-manage')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sec-btn pk-manage';
      b.innerHTML = '<i class="fas fa-fingerprint"></i> Fingerprint / Face';
      b.onclick = () => openManager(cat, MANAGE[cat][1]);
      host.appendChild(b);
    });
  }

  async function openManager(cat, getTok) {
    const ov = document.createElement('div');
    ov.className = 'pk-ov';
    ov.innerHTML = '<div class="pk-box"><h3>Fingerprint / Face</h3><p>Ei device-er fingerprint, face ba screen-lock diye lock khulte parben. Password ager moto kaj korbe.</p><div class="pk-list">Loading...</div><div class="pk-act"><button class="pk-main">Add this device</button><button class="pk-close">Close</button></div></div>';
    document.body.appendChild(ov);
    const list = ov.querySelector('.pk-list');
    const close = () => ov.remove();
    ov.querySelector('.pk-close').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });

    async function refresh() {
      try {
        const d = await post('/passkey/list', { token: getTok(), category: cat });
        list.innerHTML = '';
        if (!d.passkeys.length) list.textContent = 'Kono device add kora nei.';
        d.passkeys.forEach(p => {
          const row = document.createElement('div'); row.className = 'pk-row';
          const s = document.createElement('span'); s.textContent = p.label || 'Device';
          const x = document.createElement('button'); x.innerHTML = '<i class="fas fa-trash"></i>'; x.title = 'Remove';
          x.onclick = async () => {
            if (!confirm('Ei device-er passkey muche felben?')) return;
            try { await post('/passkey/remove', { token: getTok(), category: cat, id: p.id }); refresh(); } catch (e) { say(e.message); }
          };
          row.append(s, x); list.appendChild(row);
        });
      } catch (e) { list.textContent = e.message; }
    }
    ov.querySelector('.pk-main').onclick = async () => {
      try { await enroll(cat, getTok()); say('Ei device-e Fingerprint/Face chalu holo'); refresh(); }
      catch (e) { say(e && e.name === 'NotAllowedError' ? 'Cancel hoyeche' : (e.message || 'Hoyni')); }
    };
    refresh();
  }

  // section khulle auto prompt
  document.addEventListener('click', e => {
    if (!PK_AUTO) return;
    const el = e.target.closest('[data-view]');
    if (!el) return;
    const cat = el.dataset.view;
    if (CATS[cat] && supported && enrolled()) setTimeout(() => unlock(cat, true), 350);
  });

  addUnlockButtons();
  addManageButtons();
})();
