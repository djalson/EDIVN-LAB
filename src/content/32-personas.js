/* ============================================================================
   Personnalités des utilisateurs : chacun écrit ses tickets à sa façon.
   Le fond technique d'un ticket ne change JAMAIS (symptôme, machines, adresses, heures) : seuls la formule d'ouverture, une remarque
   sans contenu technique et la formule de fin portent le caractère. Aucune remarque ne suggère de cause : pas de fausse piste.
   Appliqué quand la mission est créée avec l'option personas (interface V3) ; le moteur et le mode d'origine gardent les textes bruts.
   ============================================================================ */
(function (g) {
'use strict';
const SIM = g.SIM, U = SIM.U;
const PS = SIM.personas = {};
PS.LIST = [
  { key: 'Alice Martin', trait: 'précise et toujours pressée', open: ['Bonjour,', 'Bonjour, je fais court :'], aside: ['Je suis en pleine clôture mensuelle.', 'J’ai noté l’heure exacte si besoin.'], close: ['Merci de faire vite, j’ai des écritures à passer avant midi.', 'Je reste à mon poste, merci de me tenir au courant.'] },
  { key: 'Bruno Durand', trait: 'bavard, s’excuse beaucoup', open: ['Bonjour, désolé de vous déranger encore…', 'Bonjour, c’est encore moi, pardon !'], aside: ['Je ne suis pas très doué avec ces machines.', 'J’espère que je n’ai rien fait de travers.'], close: ['Merci beaucoup pour votre patience, vraiment.', 'Encore pardon pour le dérangement, et merci !'] },
  { key: 'Claire Lef', trait: 'directe, n’a jamais le temps', open: ['Bonjour.', 'Bonjour, c’est urgent.'], aside: ['J’ai une réunion dans dix minutes.'], close: ['J’ai besoin que ce soit réglé aujourd’hui.', 'Tenez-moi informée dès que c’est rétabli.'] },
  { key: 'David Moreau', trait: 'méthodique, raconte tout dans l’ordre', open: ['Bonjour, voici ce que j’observe :', 'Bonjour, je vous décris les faits :'], aside: ['J’ai tout noté sur un papier au fur et à mesure.'], close: ['Je peux vous refaire la manipulation devant vous si besoin.', 'Dites-moi si vous voulez d’autres précisions.'] },
  { key: 'Elena Garcia', trait: 'calme, écrit pour toute l’agence', open: ['Bonjour à l’équipe de Toulouse,', 'Bonjour, ici l’agence de Bordeaux,'], aside: ['Je vous écris pour l’agence.'], close: ['Merci d’avance, bonne journée à vous.', 'On patiente, merci pour votre aide.'] },
  { key: 'Louison Berger', trait: 'enthousiaste, tutoie tout le monde', open: ['Coucou le support !', 'Hello l’équipe !'], aside: ['Promis, je n’ai touché à rien.'], close: ['Vous êtes les meilleurs, merci !', 'Merci d’avance, vous me sauvez la journée !'] },
  { key: 'Jano Ribeiro', trait: 'écrit le strict minimum', open: ['Bjr.', 'Bonjour.'], aside: [], close: ['Merci.', 'Cdt.'], terse: true },
  { key: 'Mathis Caron', trait: 'nouvel arrivant, pose des questions', open: ['Bonjour, je suis arrivé la semaine dernière, pardon si la question est bête :', 'Bonjour, je débute ici :'], aside: ['Je ne sais pas si c’est normal.'], close: ['Est-ce que je dois faire quelque chose de mon côté ?', 'Merci de m’expliquer, que je sache pour la prochaine fois.'] },
  { key: 'Jenny Lambert', trait: 'organisée, va droit au but', open: ['Bonjour, constaté ce matin en arrivant :', 'Bonjour, un point à traiter :'], aside: ['C’est reproductible à chaque essai.'], close: ['Je reste disponible à mon poste.', 'Merci de me confirmer quand c’est réglé.'] },
  { key: 'Liam Fontaine', trait: 'cordial mais impatient', open: ['Bonjour, je compte sur vous :', 'Bonjour,'], aside: ['Je dois repartir en rendez-vous juste après.'], close: ['Je compte sur vous pour régler ça rapidement.', 'Merci de traiter ça en priorité.'] },
  { key: 'Sophie Lambert', trait: 'chaleureuse, donne des nouvelles de l’agence', open: ['Bonjour de Ramonville !', 'Bonjour à tous,'], aside: ['Tout le monde ici vous passe le bonjour.'], close: ['Merci pour votre aide, comme toujours.', 'Bonne journée à toute l’équipe !'] },
  { key: 'Marc Delmas', trait: 'pragmatique, parle terrain', open: ['Bonjour,', 'Salut l’équipe,'], aside: ['Je suis sur place toute la journée.'], close: ['Appelez-moi si vous voulez que je regarde quelque chose sur place.', 'Merci, je reste joignable.'] }
];
PS.of = from => PS.LIST.find(p => String(from || '').indexOf(p.key) === 0) || null;
const POLITE = /\s*(?:Pouvez-vous[^.?!]*\?|Merci[^.?!]*[.!]|Pourriez-vous[^.?!]*\?)\s*$/;
const cap = s => /^\S*[\/\\.\d@]/.test(s) ? s : s.charAt(0).toUpperCase() + s.slice(1);   /* une adresse ou un chemin en tête de phrase garde sa casse */
/* le texte d'un ticket, dit par son auteur. seed : pour tirer la même variante à chaque fois. */
PS.say = function (from, body, seed) {
  const p = PS.of(from); body = String(body || ''); if (!p || !body) return body;
  const rng = U.rng('persona|' + seed + '|' + p.key);
  /* seule une formule de politesse courte et sans élément technique est remplacée par celle du personnage */
  let core = body.replace(/^(?:Bonjour|Salut)\s*[,.!]?\s*/i, ''); { const pm = POLITE.exec(core); if (pm && pm[0].length <= 70 && !/[\d\\\/@«]|[A-Z]{2,}/.test(pm[0])) core = core.slice(0, pm.index); } core = core.trim(); if (!core) core = body;
  const open = rng.pick(p.open); const close = rng.pick(p.close);
  /* la remarque vient après la première phrase, une fois sur deux ; jamais pour un ticket très court ni chez les laconiques */
  let aside = p.aside.length && !p.terse && rng.chance(0.5) ? rng.pick(p.aside) : '';
  if (aside) { const m = /^(.*?[.!?…])(\s+)(.*)$/s.exec(core); if (m && m[3]) core = m[1] + ' ' + aside + ' ' + m[3]; else core = core + ' ' + aside; }
  const glue = /[,:]$/.test(open) ? core.charAt(0).toLowerCase() === core.charAt(0) || /^[A-ZÀ-Ý][a-zà-ÿ’']/.test(core) && !/^[A-Z]{2}|^(?:PC|SRV|SW|R-|IMP|Internet|Windows|Outlook|Teams|Excel|Word)/.test(core) ? core.charAt(0).toLowerCase() + core.slice(1) : core : cap(core);
  return (open + ' ' + glue + ' ' + close).replace(/\s+/g, ' ').trim();
};
/* applique la personnalité au ticket d'une panne instanciée (une seule fois) */
PS.apply = function (inst, seed) { const t = inst && inst.ticket; if (!t || t._persona) return inst; const p = PS.of(t.from); if (p) { t.body = PS.say(t.from, t.body, seed + '|' + inst.id); t.trait = p.trait; } t._persona = true; return inst; };
})(typeof globalThis !== 'undefined' ? globalThis : window);
