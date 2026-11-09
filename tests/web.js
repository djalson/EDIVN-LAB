const SIM = require('./load')(); const W = SIM.buildHealthyWorld({}); const WEB = SIM.web;
const t = (c, u) => { const r = WEB.fetch(W, c, u); console.log((c + ' → ' + u).padEnd(58), r.ok ? 'OK ' + r.status + ' ' + (r.page && r.page.title) + (r.redirects.length ? ' (redir ' + r.redirects.length + ')' : '') : 'ÉCHEC ' + (r.err || r.status) + ' ' + (r.errCode || '') + ' ' + (r.detail || '') + (r.error ? ' ' + r.error.code : '')); };
t('PC-01', 'http://srv-fic'); t('PC-01', 'https://srv-fic'); t('PC-01', 'https://srv-fic.toulouse.local'); t('PC-01', 'http://portail.toulouse.local:8080'); t('PC-01', 'http://10.10.10.20:8080');
t('PC-01', 'http://intranet.toulouse.local'); t('PC-01', 'http://www.exemple.fr'); t('PC-01', 'https://10.10.0.1'); t('PCEXT', 'http://vitrine.formatech.fr'); t('PCEXT', 'https://vitrine.formatech.fr'); t('PCEXT', 'http://www.exemple.fr'); t('PCEXT', 'http://192.0.2.2');
t('PC-RV2', 'http://www.ramonville.lan'); t('PC-ADM', 'https://10.10.10.20');
