/* ============================================================================
   Navigateur web du poste Windows : barre d'adresse, historique, rechargement, pages renvoyées par le
   moteur (WEB.fetch : IIS, Apache, nginx, pare-feu, imprimante), page d'avertissement de certificat,
   pages d'erreur réseau. Chaque chargement est enregistré comme observation « http: » (preuve de test).
   Les pages applicatives riches (interface web du pare-feu) s'enregistrent dans UI.webKinds.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U, UI = SIM.ui, WEB = SIM.web, h = UI.h;
SIM.AVREG['browser-gui-proxy'] = 'Navigateur, erreurs liées au proxy : ERR_PROXY_CONNECTION_FAILED, ERR_TUNNEL_CONNECTION_FAILED (titre « Désolé, impossible d’accéder à cette page », cité par la fiche de TP) et ERR_SSL_PROTOCOL_ERROR (titre « La connexion de ce site n’est pas sécurisée », cité par la fiche de TP) ; les textes d’explication sont reconstitués.';
SIM.AVREG['browser-gui'] = 'Navigateur : pages d’erreur (« Impossible d’accéder à ce site », ERR_NAME_NOT_RESOLVED, ERR_CONNECTION_TIMED_OUT, ERR_CONNECTION_REFUSED, ERR_ADDRESS_UNREACHABLE), page « Votre connexion n’est pas privée » (NET::ERR_CERT_*), pages d’erreur IIS et libellés reconstitués de mémoire, sans reprendre le logo ni la police d’un éditeur ; à vérifier par capture.';
UI.webKinds = UI.webKinds || {};
const ERRTXT = {
  ERR_NAME_NOT_RESOLVED: h0 => ['Impossible de trouver l’adresse IP du serveur de ' + h0 + '.', ['Vérifiez qu’il n’y a pas d’erreur de frappe dans ' + h0 + '.', 'Vérifiez la connexion réseau et la configuration DNS.']],
  ERR_CONNECTION_TIMED_OUT: h0 => ['Le délai de réponse de ' + h0 + ' est trop long.', ['Vérifiez la connexion réseau.', 'Vérifiez la configuration du proxy, du pare-feu et du DNS.']],
  ERR_CONNECTION_REFUSED: h0 => [h0 + ' a refusé la connexion.', ['Vérifiez la connexion réseau.', 'Vérifiez la configuration du proxy et du pare-feu.']],
  ERR_ADDRESS_UNREACHABLE: h0 => ['L’adresse de ' + h0 + ' est inaccessible.', ['Vérifiez la connexion réseau.']],
  ERR_TOO_MANY_REDIRECTS: h0 => [h0 + ' vous a redirigé trop de fois.', ['Essayez de supprimer vos cookies.']],
  ERR_PROXY_CONNECTION_FAILED: h0 => ['Impossible de se connecter au serveur proxy.', ['Vérifiez les paramètres du proxy (Options Internet).', 'Contactez votre administrateur réseau pour vous assurer que le serveur proxy fonctionne.'], 'Impossible d’accéder à ce site'],
  ERR_TUNNEL_CONNECTION_FAILED: h0 => ['Impossible d’établir un tunnel vers ' + h0 + ' : le serveur proxy a refusé ou n’a pas pu ouvrir la connexion.', ['Vérifiez les paramètres du proxy.', 'Contactez votre administrateur réseau.'], 'Désolé, impossible d’accéder à cette page'],
  ERR_SSL_PROTOCOL_ERROR: h0 => [h0 + ' a envoyé une réponse non valide.', ['Le protocole SSL n’a pas pu être négocié avec le serveur.'], 'La connexion de ce site n’est pas sécurisée']
};
const TLSTXT = { ERR_CERT_DATE_INVALID: 'Le certificat du serveur a expiré ou n’est pas encore valide.', ERR_CERT_COMMON_NAME_INVALID: 'Le nom du serveur ne correspond pas au certificat.', ERR_CERT_AUTHORITY_INVALID: 'Le certificat du serveur n’est pas signé par une autorité de certification approuvée sur cet appareil.' };

UI.app('browser', {
  title: 'Navigateur', icon: 'globe',
  open: (desk, arg) => {
    const W = desk.W; const hist = []; let pos = -1; let win; const accepted = new Set();
    const addr = h('input.w10in.baddr', { type: 'text', spellcheck: false, placeholder: 'Rechercher ou saisir une adresse web' });
    const content = h('div.bcontent'); const status = h('div.bstatus');
    const tabLabel = h('span', 'Nouvel onglet');
    const back = h('button.tb', { title: 'Précédent', on: { click: () => go(pos - 1, true) } }, '◀'), fwd = h('button.tb', { title: 'Suivant', on: { click: () => go(pos + 1, true) } }, '▶'), reload = h('button.tb', { title: 'Actualiser', on: { click: () => load(hist[pos] && hist[pos].url, { noPush: true, fresh: true }) } }, '⟳');
    const btns = () => { back.disabled = pos <= 0; fwd.disabled = pos >= hist.length - 1; };
    const normalize = t => { t = t.trim(); if (!t) return ''; if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = 'http://' + t; return t; };
    const setTitle = t => { tabLabel.textContent = t; win.setTitle(t + ' — Navigateur'); };
    const render = (url, r, o) => {
      UI.clear(content); addr.value = url; const hostOf = (WEB.parseUrl(url) || { host: url }).host;
      if (r.err === 'tls' && !o.ignoreTls) {
        const code = SIM.codes.text(String(r.errCode || '').replace(/^ERR_/, 'NET::ERR_'), 'navigateur'); const adv = h('div', { style: { display: 'none', margin: '14px 0' } }, h('p', hostOf + ' utilise normalement le chiffrement pour protéger vos informations. ' + (TLSTXT[r.errCode] || '') + ' Il se peut qu’un individu malveillant tente de se faire passer pour ' + hostOf + '.'), h('a.blink', { href: '#', on: { click: e => { e.preventDefault(); load(url, { noPush: true, ignoreTls: true }); } } }, 'Continuer vers ' + hostOf + ' (dangereux)'));
        content.append(h('div.bwarn', h('div.bwicon', UI.icon('warning', 56)), h('h1', 'Votre connexion n’est pas privée'), h('p', 'Des individus malveillants tentent peut-être de dérober vos informations sur ' + hostOf + ' (mots de passe, messages ou cartes bancaires, par exemple).'), h('div.bcode', code), h('div', { style: { display: 'flex', gap: '10px', marginTop: '18px' } }, h('button.bbtn.pri', { on: { click: () => { if (pos > 0) go(pos - 1, true); } } }, 'Retour en lieu sûr'), h('button.bbtn', { on: { click: () => { adv.style.display = adv.style.display === 'none' ? 'block' : 'none'; } } }, 'Paramètres avancés')), adv));
        setTitle('Avertissement de sécurité'); status.textContent = ''; return;
      }
      if (r.err && r.err !== 'tls') {
        const f = ERRTXT[r.errCode] ? ERRTXT[r.errCode](hostOf) : ['Impossible d’établir la connexion.', []];
        content.append(h('div.berr', h('div.bwicon', UI.icon('error', 40)), h('h1', f[2] || 'Impossible d’accéder à ce site'), h('p', f[0]), h('ul', f[1].map(x => h('li', x))), h('div.bcode', SIM.codes.text(r.errCode || r.err, 'navigateur')))); setTitle(hostOf); status.textContent = ''; return;
      }
      if (r.page && r.page.kind === 'pfsense') { const k = UI.webKinds.pfsense; if (k) { k(content, { desk, host: r.page.host, url, setTitle, navigate: (u) => load(u), W }); status.textContent = 'Terminé'; return; } }
      if (r.page && r.page.kind === 'html') { const box = h('div.bpage'); box.appendChild(UI.safeHtml(r.page.html)); content.append(box); setTitle(r.page.title || hostOf); status.textContent = r.status ? 'HTTP ' + r.status : ''; return; }
      if (r.error) { content.append(h('div.bpage.iiserr', h('div.iishd', 'Erreur de serveur'), h('h2', SIM.codes.text('Erreur HTTP ' + r.error.code + ' - ' + r.error.title, 'navigateur')), h('p', r.error.detail))); setTitle(r.error.code + ' ' + r.error.title); status.textContent = 'HTTP ' + r.status; return; }
      content.append(h('div.bpage', h('h2', SIM.codes.text('HTTP ' + r.status, 'navigateur')))); setTitle(hostOf);
    };
    const load = (url, o) => {
      o = o || {}; if (!url) return; url = normalize(url); if (!url) return;
      { const pu = WEB.parseUrl(url); const hk = pu ? pu.host : ''; if (o.ignoreTls) accepted.add(hk); else if (accepted.has(hk)) o = Object.assign({}, o, { ignoreTls: true }); }
      status.textContent = 'Connexion en cours…'; UI.clear(content); content.append(h('div.bload', 'Chargement…'));
      setTimeout(() => {
        if (win.closed) return;
        const r = WEB.fetch(W, desk.devId, url, { noCache: !!o.fresh, ignoreTls: !!o.ignoreTls }); desk.env.advance(1);
        const okObs = !!r.ok && !r.blocked && !(r.tls && r.tls.ok === false); desk.env.obs('http:' + desk.devId + ':' + url, okObs, { status: r.status, err: r.err });
        desk.act('Navigateur : ' + url + (r.err ? ' — échec (' + SIM.codes.text(r.errCode || r.err, 'trace') + ')' : ' — HTTP ' + r.status), { kind: 'ui' });
        const finalUrl = r.finalUrl || r.url || url;
        if (!o.noPush) { hist.splice(pos + 1); hist.push({ url: finalUrl }); pos = hist.length - 1; } else if (o.noPush && hist[pos]) hist[pos].url = finalUrl;
        btns(); render(finalUrl, r, o);
      }, 250);
    };
    const go = (i, noPush) => { if (i < 0 || i >= hist.length) return; pos = i; btns(); load(hist[i].url, { noPush: true }); };
    addr.addEventListener('keydown', e => { if (e.key === 'Enter') load(addr.value); });
    const bar = h('div.bbar', back, fwd, reload, addr);
    const tabs = h('div.btabs', h('div.btab.on', UI.icon('globe', 14), tabLabel));
    win = desk.wm.open({ title: 'Nouvel onglet — Navigateur', icon: 'globe', w: 1000, h: 620, className: 'browser', body: () => h('div.bwrap', tabs, bar, content, status) });
    content.append(h('div.bpage.bnew', h('h2', 'Nouvel onglet'), h('p.muted', 'Saisissez une adresse dans la barre d’adresse.'))); btns();
    if (arg) load(arg);
    setTimeout(() => addr.focus(), 50);
    return win;
  }
});
})(typeof globalThis !== 'undefined' ? globalThis : window);
