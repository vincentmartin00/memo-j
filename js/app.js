// Mémo J — application
import { createClient } from '../vendor/supabase.js';
import * as A from './algo.js';

const SUPABASE_URL = 'https://ejpsnyrmsxezkrocyglx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_I60hj9XIlqI-4k-FHGEJEA_RKQRrnNG';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

// ---------------------------------------------------------------- état
const S = {
  user: null,
  matieres: [], chapitres: [], revisions: [], reglages: null,
  ui: { open: {}, archOpen: false, semaineOffset: 0, statsPeriode: 'mois', echelle: 'semaines' },
  recovery: false,
};
const app = document.getElementById('app');

// ---------------------------------------------------------------- outils
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => A.isoJour(new Date());
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtJourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dCourt = (iso) => fmtCourt.format(A.jour(iso));
const dJourMois = (iso) => fmtJourMois.format(A.jour(iso));
const heure = (ts) => { const d = new Date(ts); return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`; };
const dureeTxt = (m) => (m >= 60 ? `${m / 60} h`.replace('.', ',') : `${m} min`);
const pct = (x) => `${Math.round(x * 100)} %`;
const PALETTE = [
  ['Bleu', '#2F5BE0'], ['Vert', '#1F7A6D'], ['Prune', '#7A3E6E'], ['Ocre', '#9A6A12'], ['Ardoise', '#5B6B7A'], ['Framboise', '#A33A4F'],
  ['Brique', '#A84A17'], ['Olive', '#5E6B1F'], ['Indigo', '#4B3FA8'], ['Turquoise', '#0E7490'], ['Rose', '#B03A7A'],
];
const NOTE_COULEUR = { decouverte: 'var(--muted)', rate: 'var(--late)', complique: 'var(--s4)', frais: 'var(--accent)', tres_frais: 'var(--s2)' };

function sombre() {
  const th = S.reglages?.theme || 'auto';
  return th === 'sombre' || (th === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}
// Couleur d'une matière adaptée au thème sombre (plus claire)
function couleur(hex) {
  if (!sombre()) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * 0.42);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

const I = {
  gear: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  plusBig: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  chev: '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  cal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>',
  archive: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg>',
  folder: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  star: (on) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${on ? 'var(--s4)' : 'none'}" stroke="${on ? 'var(--s4)' : 'var(--off)'}" stroke-width="1.5" stroke-linejoin="round" aria-label="${on ? 'Continue après l’examen' : 'S’arrête à l’examen'}"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/></svg>`,
  tabToday: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  tabWeek: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  tabBook: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23"/></svg>',
  tabStats: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>',
  logo: '<svg class="logo" viewBox="0 0 180 180" aria-hidden="true"><rect width="180" height="180" rx="40" fill="#2F5BE0"/><path d="M92 44V114a25 25 0 0 1-50 0" fill="none" stroke="#FFF" stroke-width="18" stroke-linecap="round"/><circle cx="118" cy="126" r="6" fill="#F0945F"/><circle cx="130" cy="98" r="8.5" fill="#F0945F"/><circle cx="140" cy="64" r="11.5" fill="#F0945F"/></svg>',
};

// ---------------------------------------------------------------- données
const matiereDe = (ch) => S.matieres.find((m) => m.id === ch.matiere_id);
const revsDe = (chId) => S.revisions.filter((r) => r.chapitre_id === chId).sort((a, b) => new Date(a.faite_le) - new Date(b.faite_le));
const actives = () => S.matieres.filter((m) => !m.archivee_le).sort((a, b) => a.ordre - b.ordre || a.created_at.localeCompare(b.created_at));
const archivees = () => S.matieres.filter((m) => m.archivee_le);
const chapitresActifs = () => S.chapitres.filter((c) => { const m = matiereDe(c); return m && !m.archivee_le; });
const chapitresDe = (mId) => S.chapitres.filter((c) => c.matiere_id === mId).sort((a, b) => a.created_at.localeCompare(b.created_at));
const retentionCh = (ch, iso = today()) => A.retention(revsDe(ch.id), iso);
const jDe = (ch) => ch.prochain_j ?? A.ecartJours(ch.date_j0, ch.prochaine_date || today());

async function charger() {
  const [m, c, r, g] = await Promise.all([
    sb.from('matieres').select('*'),
    sb.from('chapitres').select('*'),
    sb.from('revisions').select('*'),
    sb.from('reglages').select('*').maybeSingle(),
  ]);
  for (const x of [m, c, r, g]) if (x.error) throw x.error;
  S.matieres = m.data; S.chapitres = c.data; S.revisions = r.data;
  if (!g.data) {
    const ins = await sb.from('reglages').insert({}).select().single();
    if (ins.error) throw ins.error;
    S.reglages = ins.data;
  } else S.reglages = g.data;
  appliquerTheme();
  await archivageAuto();
  majPastille();
}

async function archivageAuto() {
  const t = today();
  for (const m of actives()) {
    if (!m.semaine_examen) continue;
    if (A.ecartJours(A.ajouterJours(m.semaine_examen, 6), t) <= 0) continue; // semaine d'examen pas finie
    const garder = chapitresDe(m.id).some((c) => c.continuer_apres_examen);
    if (garder) continue;
    const { data, error } = await sb.from('matieres').update({ archivee_le: new Date().toISOString(), archive_mode: 'auto' }).eq('id', m.id).select().single();
    if (!error) Object.assign(m, data);
  }
}

// Recalcule l'état d'un chapitre en rejouant ses révisions
async function recalculer(ch) {
  const m = matiereDe(ch);
  const e = A.rejouer(ch.date_j0, revsDe(ch.id), m?.semaine_examen || null, ch.continuer_apres_examen);
  const maj = { facteur: e.facteur, intervalle_jours: e.intervalle, prochaine_date: e.prochaineDate, prochain_j: e.prochainJ };
  if (maj.prochaine_date !== ch.prochaine_date) maj.planifie_a = null;
  const { data, error } = await sb.from('chapitres').update(maj).eq('id', ch.id).select().single();
  if (error) throw error;
  Object.assign(ch, data);
  return e;
}

function majPastille() {
  const n = chapitresActifs().filter((c) => c.prochaine_date && A.ecartJours(c.prochaine_date, today()) >= 0).length;
  try {
    if (S.reglages?.pastille && 'setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge());
    else if ('clearAppBadge' in navigator) navigator.clearAppBadge();
  } catch (_) { /* non pris en charge */ }
}

function appliquerTheme() {
  const th = S.reglages?.theme || 'auto';
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', th);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', sombre() ? '#121316' : '#F4F1EA');
}

// ---------------------------------------------------------------- toast
let toastT;
function toast(titre, texte) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `${I.cal}<span><b>${esc(titre)}</b>${texte ? `<br>${esc(texte)}` : ''}</span>`;
  document.body.appendChild(el);
  clearTimeout(toastT);
  toastT = setTimeout(() => el.remove(), 3400);
}
function erreur(e) {
  console.error(e);
  toast('Oups, ça n’a pas marché', e?.message || String(e));
}

// ---------------------------------------------------------------- fiches (bas → haut)
function ouvrirFiche(html, onMount) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-dim" data-close></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="grip" title="Glisser vers le bas pour fermer"><i></i></div>
    <div class="sheet-body">${html}</div>
  </div>`;
  document.body.appendChild(wrap);
  const sheet = wrap.querySelector('.sheet');
  const fermer = () => {
    sheet.classList.add('closing');
    sheet.style.transform = 'translateY(110%)';
    wrap.querySelector('.sheet-dim').style.opacity = '0';
    setTimeout(() => wrap.remove(), 280);
  };
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) fermer(); });
  // glisser la poignée vers le bas pour fermer
  const grip = wrap.querySelector('.grip');
  let y0 = null, dy = 0;
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; grip.setPointerCapture(e.pointerId); sheet.style.animation = 'none'; sheet.classList.remove('closing'); });
  grip.addEventListener('pointermove', (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
  const fin = () => {
    if (y0 === null) return; y0 = null;
    if (dy > 110) fermer();
    else { sheet.classList.add('closing'); sheet.style.transform = ''; }
  };
  grip.addEventListener('pointerup', fin); grip.addEventListener('pointercancel', fin);
  if (onMount) onMount(wrap, fermer);
  return { wrap, fermer };
}
const enteteFiche = (titre, sur) => `<div class="sheet-head"><div class="stack" style="gap:4px">${sur ? `<div class="small muted row" style="gap:6px">${sur}</div>` : ''}<h2>${esc(titre)}</h2></div><button class="close-btn" data-close aria-label="Fermer"><span>${I.close}</span></button></div>`;

// ---------------------------------------------------------------- navigation
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'aujourdhui';
  const [path, qs] = h.split('?');
  const parts = path.split('/');
  return { name: parts[0], id: parts[1], id2: parts[2], q: new URLSearchParams(qs || '') };
}
const tabs = (on) => `<nav class="tabs" aria-label="Navigation">
  <a href="#/aujourdhui" class="${on === 'aujourdhui' ? 'on' : ''}">${I.tabToday}Aujourd'hui</a>
  <a href="#/semaine" class="${on === 'semaine' ? 'on' : ''}">${I.tabWeek}Semaine</a>
  <a href="#/matieres" class="${on === 'matieres' ? 'on' : ''}">${I.tabBook}Matières</a>
  <a href="#/stats" class="${on === 'stats' ? 'on' : ''}">${I.tabStats}Stats</a></nav>`;

function rendre() {
  if (!S.user) return rendreConnexion();
  if (S.recovery) return rendreNouveauMdp();
  const r = route();
  const vues = { aujourdhui: vueAujourdhui, semaine: vueSemaine, matieres: vueMatieres, stats: vueStats, chapitre: vueChapitre, reglages: vueReglages };
  const vue = vues[r.name] || vueAujourdhui;
  const scrollKey = location.hash;
  const prev = app.querySelector('.page');
  const garderScroll = prev && prev.dataset.key === scrollKey ? prev.scrollTop : 0;
  app.innerHTML = vue(r);
  const page = app.querySelector('.page');
  if (page) { page.dataset.key = scrollKey; page.scrollTop = garderScroll; }
  majPastille();
}
window.addEventListener('hashchange', rendre);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { appliquerTheme(); rendre(); });

// ---------------------------------------------------------------- Aujourd'hui
function carteDue(ch, t) {
  const m = matiereDe(ch);
  const retard = A.ecartJours(ch.prochaine_date, t);
  const j = jDe(ch);
  const dur = A.dureeCreneau(j, S.reglages);
  const planifie = !!ch.planifie_a;
  const matiere = `<div class="row small muted" style="gap:6px"><span class="dot" style="background:${couleur(m.couleur)}"></span>${esc(m.nom)}</div>`;
  if (retard > 0) {
    return `<div class="card late pad stack" style="gap:12px">
      <div class="row" style="align-items:flex-start;justify-content:space-between">
        <div class="stack" style="gap:4px">${matiere}<div style="font-size:17px;font-weight:600">${esc(ch.nom)}</div>
        <div class="small" style="color:var(--late);font-weight:500">Prévue ${dCourt(ch.prochaine_date)} · ${retard} jour${retard > 1 ? 's' : ''} de retard</div></div>
        <div class="jbig" style="color:var(--late);font-size:20px">J${j}</div></div>
      <div class="row" style="gap:8px"><button class="btn" style="height:44px;font-size:15px" data-valider="${ch.id}">Valider</button>
      <button class="chip" style="height:44px;font-size:15px;padding:0 14px" data-planifier="${ch.id}" data-date="${t}">Planifier · ${dureeTxt(dur)}</button></div></div>`;
  }
  return `<div class="card pad row" style="gap:12px;padding-left:6px">
    <button class="check" data-valider="${ch.id}" aria-label="Valider la révision ${esc(ch.nom)}"><span></span></button>
    <div class="grow stack" style="gap:2px">${matiere}<div style="font-size:16px;font-weight:600">${esc(ch.nom)}</div>
    ${planifie ? `<div class="small" style="color:var(--accent);font-weight:500">Planifiée à ${heure(ch.planifie_a)} · ${dureeTxt(dur)}</div>`
      : `<button class="small" style="color:var(--accent);font-weight:600;text-align:left;min-height:30px" data-planifier="${ch.id}" data-date="${t}">Planifier · ${dureeTxt(dur)}</button>`}</div>
    <div class="jbig">J${j}</div></div>`;
}

function vueAujourdhui() {
  const t = today();
  const dues = chapitresActifs().filter((c) => c.prochaine_date && A.ecartJours(c.prochaine_date, t) >= 0)
    .sort((a, b) => a.prochaine_date.localeCompare(b.prochaine_date));
  const retard = dues.filter((c) => A.ecartJours(c.prochaine_date, t) > 0);
  const jour = dues.filter((c) => c.prochaine_date === t);
  let contenu;
  if (!S.matieres.length) {
    contenu = `<div class="empty"><h3>Bienvenue dans Mémo J</h3><p>Commence par créer une matière, puis ajoute ton premier chapitre : son J0 sera aujourd'hui.</p>
      <button class="btn" style="margin-top:12px" data-action="nouvelle-matiere">Créer une matière</button></div>`;
  } else if (!dues.length) {
    const prochain = chapitresActifs().filter((c) => c.prochaine_date).sort((a, b) => a.prochaine_date.localeCompare(b.prochaine_date))[0];
    contenu = `<div class="empty"><h3>Rien à réviser aujourd'hui</h3><p>${prochain ? `Prochaine révision : ${esc(prochain.nom)}, ${dCourt(prochain.prochaine_date)}` : 'Ajoute un chapitre avec le bouton +.'}</p></div>`;
  } else {
    contenu = `${retard.length ? `<div class="label late">En retard · ${retard.length}</div>${retard.map((c) => carteDue(c, t)).join('')}` : ''}
      ${jour.length ? `<div class="label">Du jour · ${jour.length}</div>${jour.map((c) => carteDue(c, t)).join('')}` : ''}`;
  }
  return `<main class="page"><div class="date-line"><span>${cap(fmtLong.format(new Date()))}</span><a class="icon-btn" href="#/reglages" aria-label="Réglages" style="margin-right:-10px">${I.gear}</a></div>
    <div class="head" style="margin-bottom:8px"><h1>Aujourd'hui</h1>${dues.length ? `<span style="background:var(--btn);color:var(--btn-fg);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600">${dues.length} à faire</span>` : ''}</div>
    <div class="stack stagger">${contenu}</div></main>
    ${S.matieres.length ? `<button class="fab" data-action="nouveau-chapitre" aria-label="Ajouter un chapitre">${I.plusBig}</button>` : ''}${tabs('aujourdhui')}`;
}

// ---------------------------------------------------------------- Semaine
function vueSemaine() {
  const t = today();
  const debut = A.ajouterJours(t, 7 * S.ui.semaineOffset);
  const fin = A.ajouterJours(debut, 6);
  const jours = Array.from({ length: 7 }, (_, i) => ({ iso: A.ajouterJours(debut, i), items: [] }));
  let total = 0, planifiees = 0;
  for (const ch of chapitresActifs()) {
    if (!ch.prochaine_date) continue;
    const m = matiereDe(ch);
    const e = { facteur: ch.facteur, intervalle: Number(ch.intervalle_jours), prochaineDate: ch.prochaine_date, prochainJ: ch.prochain_j, rang: revsDe(ch.id).length };
    const proj = A.projeter(e, ch.date_j0, m.semaine_examen, ch.continuer_apres_examen, fin);
    proj.forEach((p, i) => {
      let d = p.date;
      if (i === 0 && A.ecartJours(d, t) > 0) d = t; // en retard : affiché aujourd'hui
      const jourObj = jours.find((x) => x.iso === d);
      if (!jourObj) return;
      const confirme = i === 0;
      const planifie = confirme && !!ch.planifie_a;
      jourObj.items.push({ ch, m, j: p.j, confirme, planifie, retard: i === 0 && p.date !== d });
      total++; if (planifie) planifiees++;
    });
  }
  const html = jours.map((d) => `<div class="stack" style="gap:6px"><div style="font-size:13px;font-weight:600">${cap(fmtCourt.format(A.jour(d.iso)))}${d.iso === t ? ' · aujourd’hui' : ''}</div>
    ${d.items.length ? d.items.map((it) => {
      const dur = dureeTxt(A.dureeCreneau(it.j, S.reglages));
      const style = it.confirme ? 'background:var(--card);border:1.5px solid var(--line)' : 'border:1.5px dashed var(--dash)';
      return `<div class="row" style="${style};border-radius:12px;padding:6px 8px 6px 12px;min-height:48px">
        <span class="dot" style="background:${couleur(it.m.couleur)}"></span>
        <a class="grow small" href="#/chapitre/${it.ch.id}?from=semaine" style="color:${it.confirme ? 'var(--ink)' : 'var(--muted)'};font-size:14px"><b>${esc(it.m.nom)}</b> · ${esc(it.ch.nom)} · J${it.j}${it.retard ? ' <span style="color:var(--late)">· en retard</span>' : ''}</a>
        ${it.planifie ? `<div style="font-size:13px;font-weight:600;color:var(--accent);text-align:right;line-height:1.2;padding:0 6px">${heure(it.ch.planifie_a)}<br><span class="xs muted" style="font-weight:500">${dur}</span></div>`
          : it.confirme ? `<button class="chip" data-planifier="${it.ch.id}" data-date="${d.iso}">Planifier · ${dur}</button>` : `<span class="xs muted" style="padding:0 6px">prévue</span>`}
      </div>`;
    }).join('') : '<div class="small muted">Aucune révision</div>'}</div>`).join('');
  return `<main class="page"><div class="head" style="margin-top:14px"><h1>Semaine</h1><div class="row" style="gap:4px">
    <button class="icon-btn" style="border:1px solid var(--line);color:var(--ink);${S.ui.semaineOffset <= 0 ? 'opacity:.35' : ''}" data-action="sem-prev" aria-label="Semaine précédente" ${S.ui.semaineOffset <= 0 ? 'disabled' : ''}>${I.prev}</button>
    <button class="icon-btn" style="border:1px solid var(--line);color:var(--ink)" data-action="sem-next" aria-label="Semaine suivante">${I.next}</button></div></div>
    <div class="sub">${dCourt(debut)} – ${dCourt(fin)} · ${total} révision${total > 1 ? 's' : ''} · ${planifiees} planifiée${planifiees > 1 ? 's' : ''}</div>
    <div class="row xs muted" style="gap:14px;margin:8px 0 14px"><span class="row" style="gap:6px"><span style="width:14px;height:10px;border-radius:3px;border:1.5px solid var(--line);background:var(--card)"></span>Confirmée</span><span class="row" style="gap:6px"><span style="width:14px;height:10px;border-radius:3px;border:1.5px dashed var(--dash)"></span>Prévisionnelle</span></div>
    <div class="stack stagger">${html}</div></main>${tabs('semaine')}`;
}

// ---------------------------------------------------------------- Matières
function vueMatieres() {
  const act = actives();
  const arch = archivees();
  const blocs = act.map((m) => {
    const chs = chapitresDe(m.id);
    const open = !!S.ui.open[m.id];
    const exam = m.semaine_examen ? `examen semaine du ${dJourMois(m.semaine_examen)}` : 'examen : semaine à préciser';
    return `<div class="card ${open ? 'open' : ''}" style="overflow:hidden">
      <button class="accordion-head" data-toggle-matiere="${m.id}" aria-expanded="${open}">
        <span class="grow stack" style="gap:6px"><span class="row" style="gap:8px;font-size:17px;font-weight:600"><span class="dot big" style="background:${couleur(m.couleur)}"></span>${esc(m.nom)}</span>
        <span class="small muted">${chs.length} chapitre${chs.length > 1 ? 's' : ''} · ${exam}</span></span><span class="muted">${I.chev}</span></button>
      ${open ? `<div class="acc-body">${chs.map((c) => {
        const dueTxt = !c.prochaine_date ? 'Cycle terminé'
          : A.ecartJours(c.prochaine_date, today()) > 0 ? `En retard depuis ${dCourt(c.prochaine_date)}`
          : c.prochaine_date === today() ? `Aujourd'hui · J${jDe(c)}` : `Prochaine : ${dCourt(c.prochaine_date)} · rétention ${pct(retentionCh(c))}`;
        const urgent = c.prochaine_date && A.ecartJours(c.prochaine_date, today()) >= 0;
        return `<a class="list-row" href="#/chapitre/${c.id}?from=matieres"><div class="grow stack" style="gap:2px"><span style="font-size:15px;font-weight:500">${esc(c.nom)}</span><span class="xs" style="color:${urgent ? 'var(--late)' : 'var(--muted)'}">${dueTxt}</span></div>${I.star(c.continuer_apres_examen)}</a>`;
      }).join('')}
      <div class="row" style="justify-content:space-between;padding:4px 6px 4px 16px;flex-wrap:wrap">
        <button class="link" data-action="nouveau-chapitre" data-matiere="${m.id}">${I.plus}Ajouter un chapitre</button>
        <div class="row" style="gap:0"><button class="link" style="color:var(--muted);padding:0 8px" data-modifier-matiere="${m.id}">${I.edit}Modifier</button>
        <button class="link" style="color:var(--muted);padding:0 8px" data-archiver="${m.id}">${I.archive}Archiver</button></div></div></div>` : ''}</div>`;
  }).join('');
  const dossier = `<div class="folder ${S.ui.archOpen ? 'open' : ''}" style="margin-top:6px">
    <button class="accordion-head" data-action="toggle-archives" aria-expanded="${S.ui.archOpen}"><span class="muted">${I.folder}</span>
      <span class="grow stack" style="gap:4px"><span style="font-size:16px;font-weight:600">Archives · ${arch.length} matière${arch.length > 1 ? 's' : ''}</span><span class="xs muted">Rangées ici après l'examen quand aucun chapitre n'est à continuer</span></span><span class="muted">${I.chev}</span></button>
    ${S.ui.archOpen ? `<div class="acc-body" style="border-top:1px dashed var(--dash)">${arch.length ? arch.map((m) => `<div class="list-row" style="padding:10px 8px 10px 16px"><span class="dot big" style="background:${couleur(m.couleur)};opacity:.6"></span>
      <span class="grow stack" style="gap:2px"><span class="muted" style="font-size:15px;font-weight:500">${esc(m.nom)}</span><span class="xs muted">${m.archive_mode === 'auto' ? 'Archivée automatiquement après l’examen' : 'Archivée par toi'} · ${dJourMois(A.isoJour(m.archivee_le))}</span></span>
      <button class="chip" data-restaurer="${m.id}">Remettre en révision</button></div>`).join('') : '<div class="small muted" style="padding:14px 16px">Aucune matière archivée.</div>'}</div>` : ''}</div>`;
  return `<main class="page"><div class="head" style="margin-top:14px"><h1>Matières</h1><button class="chip" style="height:40px;border-radius:20px;padding:0 14px;font-size:14px" data-action="nouvelle-matiere">${I.plus}Matière</button></div>
    <div class="stack stagger" style="gap:10px">${act.length ? blocs : '<div class="empty"><h3>Aucune matière</h3><p>Crée ta première matière avec le bouton « Matière ».</p></div>'}${dossier}</div></main>${tabs('matieres')}`;
}

// ---------------------------------------------------------------- Chapitre + courbe
function courbe(ch) {
  const revs = revsDe(ch.id);
  const m = matiereDe(ch);
  const t = today();
  const echelle = S.ui.echelle;
  const j0 = ch.date_j0;
  const tJ = A.ecartJours(j0, t);
  const examD = m?.semaine_examen ? A.ecartJours(j0, m.semaine_examen) : null;
  let debut = 0, fin;
  if (echelle === 'jours') { debut = Math.max(0, tJ - 12); fin = debut + 24; }
  else if (echelle === 'semaines') { fin = Math.max(56, examD != null ? examD + 7 : tJ + 42, tJ + 14); }
  else { fin = Math.max(180, (examD ?? 0) + 60, tJ + 60); }
  const span = fin - debut;
  const X = (d) => 40 + ((d - debut) / span) * 300;
  const Y = (R) => 16 + (1 - R) * 150;
  const circ = (x, y, r) => `M${(x - r).toFixed(1)},${y.toFixed(1)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 `;

  // révisions réelles (+ projection « encore frais »)
  const stab = A.stabilites(revs).map((r) => ({ d: A.ecartJours(j0, A.isoJour(r.faite_le)), S: r.S, note: r.note, reel: true }));
  const etat = { facteur: ch.facteur, intervalle: Number(ch.intervalle_jours), prochaineDate: ch.prochaine_date, prochainJ: ch.prochain_j, rang: revs.length };
  const proj = ch.prochaine_date ? A.projeter(etat, j0, m?.semaine_examen, ch.continuer_apres_examen, A.ajouterJours(j0, fin), 60) : [];
  let S0 = stab.length ? stab[stab.length - 1].S : 1.2;
  const pts = [...stab];
  proj.forEach((p) => { S0 = S0 * 2.3; pts.push({ d: Math.max(A.ecartJours(j0, p.date), tJ), S: S0, note: 'prevue', reel: false }); });
  if (!pts.length) return { svg: '', mois: '' };
  const R = (d) => { let r = pts[0]; for (const p of pts) if (p.d <= d) r = p; return d < pts[0].d ? 1 : Math.exp(-(d - r.d) / r.S); };

  let past = '', fut = '';
  const dots = { decouverte: '', rate: '', complique: '', frais: '', tres_frais: '', prevue: '' };
  let moisHtml = '';
  if (echelle !== 'mois') {
    const step = span / 240;
    for (let i = 0; i < pts.length; i++) {
      const a = Math.max(pts[i].d, debut);
      const b = Math.min(i + 1 < pts.length ? pts[i + 1].d : fin, fin);
      if (b < debut || a > fin) continue;
      const ts = [];
      for (let v = a; v < b; v += step) ts.push(v);
      ts.push(b);
      if (a < tJ && b > tJ) { ts.push(tJ); ts.sort((x, y) => x - y); }
      for (const v of ts) {
        const val = Math.exp(-(v - pts[i].d) / pts[i].S);
        const pt = `${X(v).toFixed(1)},${Y(val).toFixed(1)} `;
        if (v <= tJ) past += (past ? 'L' : 'M') + pt;
        if (v >= tJ) fut += (fut ? 'L' : 'M') + pt;
      }
    }
    for (const p of pts) if (p.d >= debut && p.d <= fin) dots[p.note] += circ(X(p.d), 16, p.reel ? 4.5 : 3.5);
  } else {
    const hebdo = [];
    for (let w = debut; w < fin; w += 7) {
      let s = 0, n = 0;
      for (let v = w; v < Math.min(w + 7, fin); v += 0.5) { s += R(v); n++; }
      hebdo.push({ c: Math.min(w + 3.5, fin), R: s / n });
    }
    hebdo.forEach((p) => { const pt = `${X(p.c).toFixed(1)},${Y(p.R).toFixed(1)} `; if (p.c <= tJ) past += (past ? 'L' : 'M') + pt; if (p.c >= tJ) fut += (fut ? 'L' : 'M') + pt; });
    // un point et un compteur par mois
    const moisList = [];
    let cur = A.jour(j0); cur.setDate(1);
    const finDate = A.jour(A.ajouterJours(j0, fin));
    while (cur <= finDate && moisList.length < 8) {
      const a = A.isoJour(cur); const nx = new Date(cur); nx.setMonth(nx.getMonth() + 1);
      const b = A.ajouterJours(A.isoJour(nx), -1);
      const da = Math.max(A.ecartJours(j0, a), 0), db = A.ecartJours(j0, b);
      const n = pts.filter((p) => p.d >= da && p.d <= db).length;
      moisList.push({ label: fmtMois.format(cur), n });
      if (n) {
        const mid = (da + Math.min(db, fin)) / 2;
        const near = hebdo.reduce((best, p) => (Math.abs(p.c - mid) < Math.abs(best.c - mid) ? p : best), hebdo[0]);
        dots[da <= tJ ? 'frais' : 'prevue'] += circ(X(mid), Y(near.R), da <= tJ ? 4.5 : 4);
      }
      cur = nx;
    }
    moisHtml = `<div class="stack" style="gap:6px"><div class="xs muted">Courbe lissée : rétention moyenne par semaine · révisions par mois</div>
      <div class="months" style="grid-template-columns:repeat(${moisList.length}, minmax(0,1fr))">${moisList.map((x) => `<div><b>${x.n || '–'}</b><span class="xs muted">${x.label}</span></div>`).join('')}</div></div>`;
  }
  const lbl = (d) => dJourMois(A.ajouterJours(j0, Math.round(d)));
  const ticks = [debut, debut + span / 3, debut + (2 * span) / 3, fin];
  const examIn = examD != null && examD >= debut && examD <= fin;
  const todayIn = tJ >= debut && tJ <= fin;
  const svg = `<svg viewBox="0 0 350 200" width="100%" role="img" aria-label="Courbe de l'oubli : rétention estimée ${pct(retentionCh(ch))}">
    <g font-family="Instrument Sans, sans-serif" font-size="10" fill="var(--muted)">
      <text x="32" y="19" text-anchor="end">100</text><text x="32" y="94" text-anchor="end">50</text><text x="32" y="169" text-anchor="end">0</text>
      <text x="40" y="196">${lbl(ticks[0])}</text><text x="140" y="196" text-anchor="middle">${lbl(ticks[1])}</text><text x="240" y="196" text-anchor="middle">${lbl(ticks[2])}</text><text x="340" y="196" text-anchor="end">${lbl(ticks[3])}</text></g>
    <path d="M40 16H340M40 91H340M40 166H340" stroke="var(--line2)" stroke-width="1"/>
    ${examIn ? `<path d="M${X(examD).toFixed(1)} 14V166" stroke="var(--late)" stroke-width="1.5"/><text x="${X(examD).toFixed(1)}" y="10" text-anchor="middle" font-size="10" font-weight="600" fill="var(--late)" font-family="Instrument Sans, sans-serif">Examen</text><text x="${X(examD).toFixed(1)}" y="180" text-anchor="middle" font-size="10" font-weight="700" fill="var(--late)" font-family="Instrument Sans, sans-serif">${dJourMois(m.semaine_examen)}</text>` : ''}
    ${todayIn ? `<path d="M${X(tJ).toFixed(1)} 14V166" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3"/><text x="${X(tJ).toFixed(1)}" y="10" text-anchor="middle" font-size="10" font-weight="600" fill="var(--ink)" font-family="Instrument Sans, sans-serif">auj.</text>` : ''}
    <path class="draw" pathLength="1" d="${past}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>
    <path class="late-in" d="${fut}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 4" opacity=".55"/>
    <path d="${dots.prevue}" fill="var(--card)" stroke="var(--accent)" stroke-width="1.5"/>
    ${['decouverte', 'rate', 'complique', 'frais', 'tres_frais'].map((k) => `<path d="${dots[k]}" fill="${NOTE_COULEUR[k]}"/>`).join('')}
  </svg>`;
  return { svg, mois: moisHtml };
}

function vueChapitre(r) {
  const ch = S.chapitres.find((c) => c.id === r.id);
  if (!ch) { location.hash = '#/matieres'; return ''; }
  const m = matiereDe(ch);
  const from = r.q.get('from');
  const retour = from === 'stats' ? `#/stats/${m.id}` : from === 'semaine' ? '#/semaine' : from === 'aujourdhui' ? '#/aujourdhui' : '#/matieres';
  const retourTxt = from === 'semaine' ? 'Semaine' : from === 'aujourdhui' ? 'Aujourd’hui' : esc(m.nom);
  const revs = revsDe(ch.id);
  const c = courbe(ch);
  const leg = [['var(--late)', 'Raté'], ['var(--s4)', 'Compliqué'], ['var(--accent)', 'Encore frais'], ['var(--s2)', 'Très frais'], ['var(--muted)', 'J0 · découverte']]
    .map(([col, l]) => `<span><em><i style="width:10px;height:10px;border-radius:5px;background:${col};display:block"></i></em>${l}</span>`).join('')
    + '<span><em><i style="width:9px;height:9px;border-radius:5px;border:1.5px solid var(--accent);background:var(--card);display:block"></i></em>Révision prévue</span>'
    + '<span><em><i style="width:16px;border-top:1px dashed var(--accent);display:block"></i></em>Projection</span>'
    + `<span><em><i style="width:2px;height:12px;background:var(--late);display:block"></i></em>Examen${m.semaine_examen ? ` · ${dJourMois(m.semaine_examen)}` : ' · à préciser'}</span>`;
  const hist = revs.map((rv) => `<div class="list-row" style="padding:8px 6px 8px 14px">
      <span class="jbig" style="font-size:15px;width:40px">J${rv.j_label}</span>
      <span class="grow stack" style="gap:2px"><span style="font-size:14px;font-weight:500">${cap(dCourt(A.isoJour(rv.faite_le)))} · ${heure(rv.faite_le)}</span>
      <span class="xs muted row" style="gap:6px"><span class="dot" style="background:${NOTE_COULEUR[rv.note]}"></span>${A.NOTES[rv.note].label}</span></span>
      <button class="icon-btn" data-modifier-revision="${rv.id}" aria-label="Modifier cette révision">${I.edit}</button></div>`).join('')
    + (ch.prochaine_date ? `<div class="list-row" style="padding:8px 14px"><span class="jbig muted" style="font-size:15px;width:40px">J${ch.prochain_j}</span><span class="grow stack" style="gap:2px"><span style="font-size:14px;font-weight:500">${cap(dCourt(ch.prochaine_date))} · prochaine</span><span class="xs muted">Calculée depuis ta dernière révision</span></span></div>` : '');
  return `<main class="page no-tabs"><a class="link" href="${retour}" style="margin-left:-6px">${I.back}${retourTxt}</a>
    <div class="stack stagger" style="margin-top:4px">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><h1 style="font-size:28px">${esc(ch.nom)}</h1><button class="icon-btn" data-modifier-chapitre="${ch.id}" aria-label="Modifier le chapitre">${I.edit}</button></div>
      <button class="toggle-row" data-continuer="${ch.id}"><span class="grow">Continuer à apprendre après l'examen</span><span class="switch" role="switch" aria-checked="${ch.continuer_apres_examen}"><span></span></span></button>
      <div class="card pad stack" style="gap:10px">
        <div class="row" style="justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px 10px"><b style="font-size:15px;white-space:nowrap">Courbe de l'oubli</b><span class="small muted" style="white-space:nowrap">Rétention estimée <b style="font-family:var(--title);font-size:20px;color:var(--ink)">${pct(retentionCh(ch))}</b></span></div>
        <div class="seg" role="tablist">${[['jours', 'Jours'], ['semaines', 'Semaines'], ['mois', 'Mois']].map(([k, l]) => `<button role="tab" aria-selected="${S.ui.echelle === k}" class="${S.ui.echelle === k ? 'on' : ''}" data-echelle="${k}">${l}</button>`).join('')}</div>
        ${c.svg}${c.mois}<div class="legend">${leg}</div></div>
      <div class="row" style="justify-content:space-between"><div class="label" style="margin:0">Historique</div><button class="link" data-action="ajouter-revision" data-chapitre="${ch.id}">Ajouter une révision passée</button></div>
      <div class="card">${hist || '<div class="small muted" style="padding:14px">Aucune révision.</div>'}</div>
    </div></main>`;
}

// ---------------------------------------------------------------- Statistiques
function periode() {
  const t = today();
  const d = A.jour(t);
  if (S.ui.statsPeriode === 'semaine') { const a = A.lundi(t); return { a, b: A.ajouterJours(a, 6), titre: `Semaine du ${dJourMois(a)}` }; }
  if (S.ui.statsPeriode === 'mois') {
    const a = A.isoJour(new Date(d.getFullYear(), d.getMonth(), 1));
    const b = A.isoJour(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return { a, b, titre: cap(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d)) };
  }
  const mo = d.getMonth();
  if (mo >= 8 || mo === 0) { const y = mo === 0 ? d.getFullYear() - 1 : d.getFullYear(); return { a: `${y}-09-01`, b: `${y + 1}-01-31`, titre: 'Semestre 1 · septembre à janvier' }; }
  if (mo >= 1 && mo <= 5) return { a: `${d.getFullYear()}-02-01`, b: `${d.getFullYear()}-06-30`, titre: 'Semestre 2 · février à juin' };
  return { a: `${d.getFullYear()}-07-01`, b: `${d.getFullYear()}-08-31`, titre: 'Été' };
}
function revsPeriode(p, filtre = () => true) {
  return S.revisions.filter((r) => r.note !== 'decouverte' && filtre(r)).filter((r) => { const d = A.isoJour(r.faite_le); return d >= p.a && d <= p.b; });
}
function projectionsPeriode(p) {
  const out = [];
  const t = today();
  for (const ch of chapitresActifs()) {
    if (!ch.prochaine_date) continue;
    const m = matiereDe(ch);
    const e = { facteur: ch.facteur, intervalle: Number(ch.intervalle_jours), prochaineDate: ch.prochaine_date, prochainJ: ch.prochain_j, rang: revsDe(ch.id).length };
    for (const x of A.projeter(e, ch.date_j0, m.semaine_examen, ch.continuer_apres_examen, p.b, 80)) {
      const d = A.ecartJours(x.date, t) > 0 ? t : x.date;
      if (d >= p.a && d <= p.b && d >= t) out.push({ date: d, ch });
    }
  }
  return out;
}

function vueStats(r) {
  if (r.id) return vueStatsMatiere(r.id);
  const p = periode();
  const revs = revsPeriode(p);
  const proj = projectionsPeriode(p);
  const t = today();
  const avecPrevue = revs.filter((x) => x.date_prevue);
  const aLHeure = avecPrevue.filter((x) => A.isoJour(x.faite_le) <= x.date_prevue).length;
  const chs = chapitresActifs();
  const retMoy = chs.length ? chs.reduce((s, c) => s + retentionCh(c), 0) / chs.length : 0;
  const sem = S.ui.statsPeriode === 'semestre';
  const kpis = sem
    ? [[revs.length, `validées sur ${revs.length + proj.length} prévues`], [chs.length, 'chapitres suivis'], [pct(retMoy), 'rétention moyenne']]
    : [[revs.length, 'révisions validées'], [avecPrevue.length ? pct(aLHeure / avecPrevue.length) : '–', 'faites le jour prévu'], [pct(retMoy), 'rétention moyenne']];

  // activité
  let cols = [];
  if (S.ui.statsPeriode === 'semaine') {
    cols = Array.from({ length: 7 }, (_, i) => {
      const d = A.ajouterJours(p.a, i);
      const futur = d > t;
      const n = futur ? proj.filter((x) => x.date === d).length : revs.filter((x) => A.isoJour(x.faite_le) === d).length;
      return { l: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i], n, proj: futur };
    });
  } else if (S.ui.statsPeriode === 'mois') {
    let a = p.a;
    while (a <= p.b) {
      const b0 = A.ajouterJours(A.lundi(a), 6); const b = b0 > p.b ? p.b : b0;
      const futur = a > t;
      const n = revs.filter((x) => { const d = A.isoJour(x.faite_le); return d >= a && d <= b; }).length + proj.filter((x) => x.date >= a && x.date <= b && x.date > t).length;
      cols.push({ l: `${A.jour(a).getDate()}–${A.jour(b).getDate()}`, n, proj: futur });
      a = A.ajouterJours(b, 1);
    }
  } else {
    let cur = A.jour(p.a);
    while (A.isoJour(cur) <= p.b) {
      const a = A.isoJour(cur); const nx = new Date(cur); nx.setMonth(nx.getMonth() + 1); const b = A.ajouterJours(A.isoJour(nx), -1);
      const passe = revs.filter((x) => { const d = A.isoJour(x.faite_le); return d >= a && d <= b; }).length;
      const fut = proj.filter((x) => x.date >= a && x.date <= b).length;
      cols.push({ l: fmtMois.format(cur), n: passe + fut, proj: a > t });
      cur = nx;
    }
  }
  const maxC = Math.max(1, ...cols.map((c) => c.n));
  const titreAct = { semaine: 'Révisions par jour', mois: 'Révisions par semaine', semestre: 'Révisions par mois' }[S.ui.statsPeriode];
  // heures
  const h = Array(17).fill(0);
  revs.forEach((x) => { const hr = new Date(x.faite_le).getHours(); if (hr >= 7 && hr <= 23) h[hr - 7]++; });
  const maxH = Math.max(1, ...h);
  const pic = h.indexOf(Math.max(...h));
  // matières
  const parM = actives().map((m) => {
    const ids = new Set(chapitresDe(m.id).map((c) => c.id));
    const n = revs.filter((x) => ids.has(x.chapitre_id)).length;
    const prevues = proj.filter((x) => ids.has(x.ch.id)).length;
    return { m, n, total: n + prevues };
  });
  const maxM = Math.max(1, ...parM.map((x) => x.n));
  return `<main class="page"><div class="head" style="margin-top:14px"><h1>Statistiques</h1></div>
    <div class="seg" role="tablist">${[['semaine', 'Semaine'], ['mois', cap(new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date()))], ['semestre', 'Semestre']].map(([k, l]) => `<button role="tab" aria-selected="${S.ui.statsPeriode === k}" class="${S.ui.statsPeriode === k ? 'on' : ''}" data-periode="${k}">${l}</button>`).join('')}</div>
    <div class="sub" style="margin:10px 0 12px">${p.titre}</div>
    <div class="stack stagger" style="gap:10px">
      <div class="kpis">${kpis.map(([v, l]) => `<div class="card kpi"><b>${v}</b><span class="xs muted">${l}</span></div>`).join('')}</div>
      <div class="card pad stack" style="gap:10px"><div class="row" style="justify-content:space-between;align-items:baseline"><b style="font-size:15px">${titreAct}</b><span class="row xs muted" style="gap:5px"><span style="width:10px;height:10px;border-radius:2px;border:1.5px dashed var(--accent)"></span>prévu</span></div>
        <div class="bars">${cols.map((c) => `<div class="col"><span class="xs" style="font-weight:600;color:${c.proj ? 'var(--muted)' : 'var(--ink)'}">${c.n}</span><div class="bar ${c.proj ? 'proj' : ''}" style="height:${Math.max(3, Math.round((c.n / maxC) * 84))}px"></div></div>`).join('')}</div>
        <div class="row" style="gap:8px">${cols.map((c) => `<span class="xs muted" style="flex:1 1 0;text-align:center">${c.l}</span>`).join('')}</div></div>
      <div class="card pad stack" style="gap:10px"><div class="row" style="justify-content:space-between;align-items:baseline"><b style="font-size:15px">Heure de validation</b><span class="xs muted">${revs.length ? `pic : ${pic + 7}h` : 'pas encore de données'}</span></div>
        <div class="hours">${h.map((n, i) => `<i class="${n && i === pic ? 'peak' : ''}" style="height:${Math.max(2, Math.round((n / maxH) * 80))}px"></i>`).join('')}</div>
        <div class="row xs muted" style="justify-content:space-between"><span>7h</span><span>11h</span><span>15h</span><span>19h</span><span>23h</span></div></div>
      <div class="card pad stack" style="gap:12px"><div class="row" style="justify-content:space-between;align-items:baseline"><b style="font-size:15px;white-space:nowrap">${sem ? 'Avancement par matière' : 'Révisions par matière'}</b><span class="xs muted" style="text-align:right">touche pour le détail</span></div>
        ${parM.length ? parM.map((x) => `<a href="#/stats/${x.m.id}" class="stack" style="gap:4px;color:var(--ink);padding:2px 0"><span class="row small" style="justify-content:space-between"><span>${esc(x.m.nom)}</span><b>${sem ? `${x.n} / ${x.total}` : x.n}</b></span>
          <span class="meter"><i style="width:${Math.round((sem ? (x.total ? x.n / x.total : 0) : x.n / maxM) * 100)}%;background:${couleur(x.m.couleur)}"></i></span></a>`).join('') : '<div class="small muted">Aucune matière.</div>'}</div>
    </div></main>${tabs('stats')}`;
}

function vueStatsMatiere(id) {
  const m = S.matieres.find((x) => x.id === id);
  if (!m) { location.hash = '#/stats'; return ''; }
  const chs = chapitresDe(m.id);
  const nRev = S.revisions.filter((r) => r.note !== 'decouverte' && chs.some((c) => c.id === r.chapitre_id)).length;
  const ret = chs.length ? chs.reduce((s, c) => s + retentionCh(c), 0) / chs.length : 0;
  return `<main class="page"><a class="link" href="#/stats" style="margin-left:-6px">${I.back}Statistiques</a>
    <div class="stack stagger" style="margin-top:4px">
      <h1 class="row" style="gap:10px;font-size:28px"><span class="dot big" style="width:12px;height:12px;border-radius:6px;background:${couleur(m.couleur)}"></span>${esc(m.nom)}</h1>
      <div class="sub">${m.semaine_examen ? `Examen semaine du ${dJourMois(m.semaine_examen)}` : 'Examen : semaine à préciser'}</div>
      <div class="kpis"><div class="card kpi"><b>${nRev}</b><span class="xs muted">révisions validées</span></div><div class="card kpi"><b>${pct(ret)}</b><span class="xs muted">rétention moyenne</span></div><div class="card kpi"><b>${chs.length}</b><span class="xs muted">chapitres</span></div></div>
      <div class="label">Choisis un chapitre</div>
      ${chs.map((c) => { const n = revsDe(c.id).filter((r) => r.note !== 'decouverte').length; const rt = retentionCh(c);
        return `<a class="card row" href="#/chapitre/${c.id}?from=stats" style="padding:14px 12px 14px 16px;color:var(--ink)"><span class="grow stack" style="gap:6px"><b style="font-size:15px">${esc(c.nom)}</b>
          <span class="xs muted">${n ? `${n} révision${n > 1 ? 's' : ''} · rétention ${pct(rt)}` : 'Aucune révision après le J0'}</span><span class="meter" style="height:6px"><i style="width:${Math.round(rt * 100)}%;background:var(--accent)"></i></span></span><span class="muted">${I.next}</span></a>`; }).join('') || '<div class="small muted">Aucun chapitre.</div>'}
    </div></main>${tabs('stats')}`;
}

// ---------------------------------------------------------------- Réglages
function vueReglages() {
  const g = S.reglages;
  const sw = (key, label, sub, extra = '') => `<div class="list-row" style="padding:8px 6px 8px 16px"><div class="grow stack" style="gap:2px"><span style="font-size:15px;font-weight:600">${label}</span><span class="small muted">${sub}</span></div>${extra}
    <button class="switch" role="switch" aria-checked="${!!g[key]}" aria-label="${label}" data-reglage-bool="${key}"><span></span></button></div>`;
  const timeIn = (key) => `<input type="time" class="chip" style="height:36px;background:transparent" value="${String(g[key]).slice(0, 5)}" data-reglage-heure="${key}" aria-label="Heure">`;
  const dureeSel = (key, opts) => `<select class="chip" style="height:36px;background:transparent" data-reglage-duree="${key}">${opts.map((o) => `<option value="${o}" ${Number(g[key]) === o ? 'selected' : ''}>${dureeTxt(o)}</option>`).join('')}</select>`;
  return `<main class="page no-tabs"><a class="link" href="#/aujourdhui" style="margin-left:-6px">${I.back}Aujourd'hui</a>
    <div class="stack stagger" style="margin-top:4px">
      <h1 style="font-size:32px">Réglages</h1>
      <div class="label">Notifications</div>
      <div class="card">${sw('notif_jour', 'Programme du jour', 'Tous les matins', timeIn('heure_notif_jour'))}${sw('notif_semaine', 'Bilan de la semaine', 'Le lundi, après celle du jour', timeIn('heure_notif_semaine'))}${sw('pastille', 'Pastille sur l’icône', 'Révisions restantes du jour')}</div>
      <div class="small muted">Les notifications seront activées à l'étape suivante, une fois l'app installée sur ton iPhone.</div>
      <div class="label">Durée des créneaux</div>
      <div class="card">
        <div class="list-row" style="padding:6px 12px 6px 16px"><span class="grow"><b style="font-family:var(--title)">J0</b></span>${dureeSel('duree_j0', [30, 45, 60, 90, 120])}</div>
        <div class="list-row" style="padding:6px 12px 6px 16px"><span class="grow"><b style="font-family:var(--title)">J1</b></span>${dureeSel('duree_j1', [20, 30, 45, 60])}</div>
        <div class="list-row" style="padding:6px 12px 6px 16px"><span class="grow"><b style="font-family:var(--title)">J3</b><span class="muted"> et suivantes</span></span>${dureeSel('duree_suivantes', [10, 15, 20, 30, 45])}</div>
        <div class="list-row" style="padding:6px 12px 6px 16px"><span class="grow" style="font-weight:600">Heure proposée</span>${timeIn('heure_planif')}</div></div>
      <div class="small muted">Quand tu touches « Planifier », l'événement arrive dans Calendrier le jour prévu, à l'heure proposée et avec cette durée : il ne reste qu'à le déplacer.</div>
      <div class="label">Apparence</div>
      <div class="seg">${[['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(([k, l]) => `<button class="${g.theme === k ? 'on' : ''}" data-theme-choix="${k}">${l}</button>`).join('')}</div>
      <div class="small muted">« Auto » suit le réglage clair / sombre de ton iPhone.</div>
      <div class="label">Données</div>
      <div class="card"><button class="list-row" data-action="export-json"><span class="grow stack" style="gap:2px"><b style="font-size:15px">Exporter une sauvegarde</b><span class="small muted">Fichier complet (.json), réimportable</span></span></button>
        <button class="list-row" data-action="export-csv"><span class="grow stack" style="gap:2px"><b style="font-size:15px">Exporter un tableau</b><span class="small muted">Toutes tes révisions (.csv) pour Excel ou Numbers</span></span></button>
        <label class="list-row" style="cursor:pointer"><span class="grow stack" style="gap:2px"><b style="font-size:15px">Importer une sauvegarde</b><span class="small muted">Tu choisis ensuite d'ajouter ou de remplacer</span></span><input type="file" accept="application/json,.json" data-action="import-json" class="sr"></label></div>
      <div class="label">Compte</div>
      <div class="card"><div class="list-row"><span class="grow small muted">Connecté : ${esc(S.user.email)}</span></div><button class="list-row" data-action="deconnexion" style="color:var(--late);font-weight:600">Se déconnecter</button></div>
    </div></main>`;
}

// ---------------------------------------------------------------- Connexion
function rendreConnexion(msg = '', err = '') {
  app.innerHTML = `<main class="page no-tabs"><div class="auth stack" style="gap:16px">${I.logo}
    <h1 style="font-size:32px">Mémo J</h1><p class="muted" style="margin:0">Tes révisions avec la méthode des J, synchronisées sur tous tes appareils.</p>
    <form class="stack" id="form-auth" style="gap:12px">
      <div class="field"><label for="email">Adresse e-mail</label><input class="input" id="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="mdp">Mot de passe</label><input class="input" id="mdp" type="password" autocomplete="current-password" minlength="8" required></div>
      ${err ? `<div class="err" role="alert">${esc(err)}</div>` : ''}${msg ? `<div class="small" style="color:var(--ok)" role="status">${esc(msg)}</div>` : ''}
      <button class="btn" type="submit" data-mode="connexion">Se connecter</button>
      <button class="btn ghost" type="submit" data-mode="inscription">Créer mon compte</button>
      <button class="link" type="button" data-action="mdp-oublie" style="align-self:center">Mot de passe oublié</button>
    </form></div></main>`;
}
function rendreNouveauMdp() {
  app.innerHTML = `<main class="page no-tabs"><div class="auth stack" style="gap:16px">${I.logo}<h1 style="font-size:28px">Nouveau mot de passe</h1>
    <form class="stack" id="form-mdp" style="gap:12px"><div class="field"><label for="nmdp">Nouveau mot de passe (8 caractères minimum)</label><input class="input" id="nmdp" type="password" minlength="8" autocomplete="new-password" required></div>
    <button class="btn" type="submit">Enregistrer</button></form></div></main>`;
}

// ---------------------------------------------------------------- fiches métier
function ficheValidation(chId) {
  const ch = S.chapitres.find((c) => c.id === chId); if (!ch) return;
  const m = matiereDe(ch);
  const revs = revsDe(ch.id);
  const j = jDe(ch);
  let note = 'frais';
  const maintenant = new Date();
  const localISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const calc = (dt) => A.apercus({ dateJ0: ch.date_j0, faiteLe: A.isoJour(dt), rang: revs.length, intervalle: Number(ch.intervalle_jours), facteur: Number(ch.facteur), examen: m.semaine_examen, continuer: ch.continuer_apres_examen });
  const texteProchaine = (res) => {
    if (!res.prochaineDate) return { d: 'Fin du cycle', w: res.raison };
    const n = A.ecartJours(today(), res.prochaineDate);
    return { d: `${n === 1 ? 'Demain' : `Dans ${n} jours`} · ${dCourt(res.prochaineDate)}`, w: res.raison };
  };
  const opts = ['rate', 'complique', 'frais', 'tres_frais'];
  const html = `${enteteFiche(ch.nom, `<span class="dot" style="background:${couleur(m.couleur)}"></span>${esc(m.nom)} · J${j}`)}
    <b style="font-size:15px">${j === 0 ? 'Le J0 est fait ?' : 'Comment s’est passé l’exercice ?'}</b>
    <div class="stack stagger" style="gap:8px" id="opts">${opts.map((k) => `<button class="option ${k === note ? 'on' : ''}" data-note="${k}"><span class="dot" style="width:12px;height:12px;border-radius:6px;background:${NOTE_COULEUR[k]}"></span><span class="grow stack" style="gap:2px"><b>${A.NOTES[k].label}</b><span class="small muted">${A.NOTES[k].desc}</span></span></button>`).join('')}</div>
    <div class="card pad stack" style="gap:6px"><div class="label" style="margin:0">Prochaine révision</div><div id="prochaine" style="font-family:var(--title);font-size:18px;font-weight:600;color:var(--accent)"></div><div id="pourquoi" class="small muted"></div></div>
    <div class="field"><label for="fait-le">Réalisée le</label><input id="fait-le" class="input" type="datetime-local" value="${localISO(maintenant)}" max="${localISO(maintenant)}"></div>
    <button class="btn" id="ok">Valider la révision</button>`;
  ouvrirFiche(html, (w, fermer) => {
    const maj = () => {
      const dt = new Date(w.querySelector('#fait-le').value || Date.now());
      const res = calc(dt)[note];
      const tx = texteProchaine(res);
      w.querySelector('#prochaine').textContent = tx.d; w.querySelector('#pourquoi').textContent = tx.w;
    };
    // le J0 n'a pas de note : on masque la grille
    if (j === 0 && !revs.length) { note = 'decouverte'; w.querySelector('#opts').style.display = 'none'; w.querySelector('#prochaine').textContent = `Demain · J1`; w.querySelector('#pourquoi').textContent = 'Le J1 arrive le lendemain du J0.'; }
    else maj();
    w.querySelector('#opts').addEventListener('click', (e) => { const b = e.target.closest('[data-note]'); if (!b) return; note = b.dataset.note; w.querySelectorAll('.option').forEach((o) => o.classList.toggle('on', o === b)); maj(); });
    w.querySelector('#fait-le').addEventListener('change', () => { if (note !== 'decouverte') maj(); });
    w.querySelector('#ok').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        const dt = new Date(w.querySelector('#fait-le').value || Date.now());
        const ins = await sb.from('revisions').insert({ chapitre_id: ch.id, j_label: j, date_prevue: ch.prochaine_date, faite_le: dt.toISOString(), note }).select().single();
        if (ins.error) throw ins.error;
        S.revisions.push(ins.data);
        await recalculer(ch);
        fermer(); rendre();
        toast('Révision validée', ch.prochaine_date ? `Prochaine : ${dCourt(ch.prochaine_date)} (J${ch.prochain_j}).` : 'Cycle terminé pour ce chapitre.');
      } catch (err) { erreur(err); e.currentTarget.disabled = false; }
    });
  });
}

function ficheMatiere(mId) {
  const m = mId ? S.matieres.find((x) => x.id === mId) : null;
  let couleurChoisie = m?.couleur || PALETTE[actives().length % PALETTE.length][1];
  let semaine = m?.semaine_examen ?? null;
  const lundis = []; let l = A.lundi(today());
  for (let i = 0; i < 44; i++) { lundis.push(l); l = A.ajouterJours(l, 7); }
  const perso = !PALETTE.some(([, h]) => h.toUpperCase() === couleurChoisie.toUpperCase());
  const html = `${enteteFiche(m ? 'Modifier la matière' : 'Nouvelle matière')}
    <div class="field"><label for="nom-m">Nom de la matière</label><input id="nom-m" class="input" maxlength="80" placeholder="Ex. Fiscalité du patrimoine" value="${esc(m?.nom || '')}"></div>
    <div class="field"><div class="flabel">Couleur</div><div class="pills" id="swatches" style="gap:10px">
      ${PALETTE.map(([n, h]) => `<button class="swatch ${!perso && h.toUpperCase() === couleurChoisie.toUpperCase() ? 'on' : ''}" data-couleur="${h}" aria-label="${n}"><i style="background:${h}"></i></button>`).join('')}
      <button class="swatch ${perso ? 'on' : ''}" data-couleur="perso" aria-label="Autre couleur"><i style="background:conic-gradient(#E0443A,#E0B13A,#5CC24A,#3AB8E0,#4A5CE0,#C04AE0,#E0443A);display:flex;align-items:center;justify-content:center"><b id="apercu-perso" style="width:14px;height:14px;border-radius:7px;border:2px solid #fff;background:${couleurChoisie}"></b></i></button></div>
      <div id="perso" class="card pad stack" style="gap:10px;${perso ? '' : 'display:none'}">
        <label for="teinte" class="small muted">Teinte</label><input id="teinte" type="range" min="0" max="359" value="150">
        <label for="lum" class="small muted">Luminosité</label><input id="lum" type="range" min="25" max="70" value="40">
        <label for="hex" class="small muted">Code couleur</label><input id="hex" class="input mono" maxlength="7" value="${esc(couleurChoisie)}"></div></div>
    <div class="field"><label for="semaine">Semaine d'examen</label><select id="semaine" class="input"><option value="">À préciser</option>${lundis.map((x) => `<option value="${x}" ${semaine === x ? 'selected' : ''}>Semaine du ${dJourMois(x)}</option>`).join('')}${semaine && !lundis.includes(semaine) ? `<option value="${semaine}" selected>Semaine du ${dJourMois(semaine)}</option>` : ''}</select>
      <div class="small muted">La date exacte n'est pas nécessaire : l'app vise une dernière révision juste avant cette semaine.</div></div>
    <button class="btn" id="ok">${m ? 'Enregistrer' : 'Créer la matière'}</button>
    ${m ? '<button class="btn ghost" id="suppr" style="color:var(--late)">Supprimer la matière et ses chapitres</button>' : ''}`;
  ouvrirFiche(html, (w, fermer) => {
    const hsl = (h, s, li) => { s /= 100; li /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(li, 1 - li); const f = (n) => li - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); const hx = (x) => Math.round(x * 255).toString(16).padStart(2, '0'); return `#${hx(f(0))}${hx(f(8))}${hx(f(4))}`.toUpperCase(); };
    const majPerso = (hex) => { couleurChoisie = hex; w.querySelector('#apercu-perso').style.background = hex; };
    w.querySelector('#swatches').addEventListener('click', (e) => {
      const b = e.target.closest('[data-couleur]'); if (!b) return;
      w.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === b));
      const persoOn = b.dataset.couleur === 'perso';
      w.querySelector('#perso').style.display = persoOn ? '' : 'none';
      if (!persoOn) couleurChoisie = b.dataset.couleur; else majPerso(w.querySelector('#hex').value.match(/^#[0-9A-F]{6}$/i) ? w.querySelector('#hex').value.toUpperCase() : couleurChoisie);
    });
    const slide = () => { const hex = hsl(+w.querySelector('#teinte').value, 62, +w.querySelector('#lum').value); w.querySelector('#hex').value = hex; w.querySelector('#hex').classList.remove('bad'); majPerso(hex); };
    w.querySelector('#teinte').addEventListener('input', slide); w.querySelector('#lum').addEventListener('input', slide);
    w.querySelector('#hex').addEventListener('input', (e) => { let v = e.target.value.toUpperCase(); if (v && v[0] !== '#') v = `#${v}`; const ok = /^#[0-9A-F]{6}$/.test(v); e.target.classList.toggle('bad', !ok); if (ok) majPerso(v); });
    w.querySelector('#ok').addEventListener('click', async (e) => {
      const nom = w.querySelector('#nom-m').value.trim();
      if (!nom) { w.querySelector('#nom-m').classList.add('bad'); w.querySelector('#nom-m').focus(); return; }
      e.currentTarget.disabled = true;
      const val = { nom, couleur: couleurChoisie, semaine_examen: w.querySelector('#semaine').value || null };
      try {
        if (m) {
          const { data, error } = await sb.from('matieres').update(val).eq('id', m.id).select().single(); if (error) throw error;
          Object.assign(m, data);
          for (const c of chapitresDe(m.id)) await recalculer(c); // la date d'examen change le plan
        } else {
          const { data, error } = await sb.from('matieres').insert({ ...val, ordre: S.matieres.length }).select().single(); if (error) throw error;
          S.matieres.push(data); S.ui.open[data.id] = true;
        }
        fermer();
        if (!m && location.hash !== '#/matieres') location.hash = '#/matieres'; else rendre();
        toast(m ? 'Matière enregistrée' : 'Matière créée', m ? '' : 'Ajoute maintenant ses chapitres.');
      } catch (err) { erreur(err); e.currentTarget.disabled = false; }
    });
    w.querySelector('#suppr')?.addEventListener('click', async () => {
      if (!confirm(`Supprimer « ${m.nom} » et tous ses chapitres ? C'est définitif.`)) return;
      const { error } = await sb.from('matieres').delete().eq('id', m.id);
      if (error) return erreur(error);
      const ids = new Set(chapitresDe(m.id).map((c) => c.id));
      S.revisions = S.revisions.filter((r) => !ids.has(r.chapitre_id));
      S.chapitres = S.chapitres.filter((c) => c.matiere_id !== m.id);
      S.matieres = S.matieres.filter((x) => x.id !== m.id);
      fermer(); rendre();
    });
  });
}

function ficheChapitre({ chId = null, matiereId = null } = {}) {
  const ch = chId ? S.chapitres.find((c) => c.id === chId) : null;
  const act = actives();
  if (!act.length) return ficheMatiere();
  let mSel = ch?.matiere_id || matiereId || act[0].id;
  let cont = ch ? ch.continuer_apres_examen : false;
  const html = `${enteteFiche(ch ? 'Modifier le chapitre' : 'Nouveau chapitre')}
    <div class="field"><div class="flabel">Matière</div><div class="pills" id="mats">${act.map((m) => `<button class="pill ${m.id === mSel ? 'on' : ''}" data-mat="${m.id}"><span class="dot" style="width:9px;height:9px;border-radius:5px;background:${couleur(m.couleur)}"></span>${esc(m.nom)}</button>`).join('')}</div></div>
    <div class="field"><label for="nom-c">Nom du chapitre</label><input id="nom-c" class="input" maxlength="120" placeholder="Ex. Ch. 5 · Les garanties du crédit" value="${esc(ch?.nom || '')}"></div>
    <div class="field"><label for="j0">Date du J0</label><input id="j0" class="input" type="date" value="${ch?.date_j0 || today()}" max="${today()}">
      <div class="small muted">Choisis une date passée pour reprendre un chapitre déjà commencé sur Puissance J : tu pourras ensuite ajouter ses révisions passées.</div></div>
    <button class="toggle-row" id="cont"><span class="grow">Continuer à apprendre après l'examen</span><span class="switch" role="switch" aria-checked="${cont}"><span></span></span></button>
    ${ch ? '' : `<div class="card pad stack" style="gap:6px"><div class="label" style="margin:0">Premières révisions</div><div id="apercu" style="display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;font-size:15px;align-items:baseline"></div><div class="small muted">Les suivantes s'adaptent à tes auto-évaluations.</div></div>`}
    <button class="btn" id="ok">${ch ? 'Enregistrer' : 'Ajouter le chapitre'}</button>
    ${ch ? '<button class="btn ghost" id="suppr" style="color:var(--late)">Supprimer le chapitre</button>' : ''}`;
  ouvrirFiche(html, (w, fermer) => {
    const apercu = () => {
      const el = w.querySelector('#apercu'); if (!el) return;
      const j0 = w.querySelector('#j0').value || today();
      const g = S.reglages;
      el.innerHTML = [[0, j0], [1, A.ajouterJours(j0, 1)], [3, A.ajouterJours(j0, 3)]].map(([j, d]) => `<b style="color:var(--accent)">J${j}</b><span>${d === today() ? 'aujourd’hui' : dCourt(d)}</span><span class="small muted">${dureeTxt(A.dureeCreneau(j, g))}</span>`).join('');
    };
    apercu();
    w.querySelector('#j0').addEventListener('change', apercu);
    w.querySelector('#mats').addEventListener('click', (e) => { const b = e.target.closest('[data-mat]'); if (!b) return; mSel = b.dataset.mat; w.querySelectorAll('.pill').forEach((p) => p.classList.toggle('on', p === b)); });
    w.querySelector('#cont').addEventListener('click', () => { cont = !cont; w.querySelector('#cont .switch').setAttribute('aria-checked', cont); });
    w.querySelector('#ok').addEventListener('click', async (e) => {
      const nom = w.querySelector('#nom-c').value.trim();
      if (!nom) { w.querySelector('#nom-c').classList.add('bad'); w.querySelector('#nom-c').focus(); return; }
      const j0 = w.querySelector('#j0').value || today();
      e.currentTarget.disabled = true;
      try {
        if (ch) {
          const { data, error } = await sb.from('chapitres').update({ nom, matiere_id: mSel, date_j0: j0, continuer_apres_examen: cont }).eq('id', ch.id).select().single(); if (error) throw error;
          Object.assign(ch, data);
          // le J0 suit la nouvelle date
          const j0rev = revsDe(ch.id).find((r) => r.note === 'decouverte');
          if (j0rev && A.isoJour(j0rev.faite_le) !== j0) {
            const t = new Date(`${j0}T12:00:00`).toISOString();
            const up = await sb.from('revisions').update({ faite_le: t }).eq('id', j0rev.id).select().single(); if (!up.error) Object.assign(j0rev, up.data);
          }
          for (const r of revsDe(ch.id)) r.j_label = Math.max(0, A.ecartJours(ch.date_j0, A.isoJour(r.faite_le)));
          await recalculer(ch);
          fermer(); rendre(); toast('Chapitre enregistré', '');
        } else {
          const ins = await sb.from('chapitres').insert({ nom, matiere_id: mSel, date_j0: j0, continuer_apres_examen: cont, prochaine_date: j0, prochain_j: 0 }).select().single();
          if (ins.error) throw ins.error;
          const nouveau = ins.data; S.chapitres.push(nouveau);
          // le J0 est fait au moment de l'ajout (compréhension + relecture du cours)
          const faite = j0 === today() ? new Date().toISOString() : new Date(`${j0}T12:00:00`).toISOString();
          const rv = await sb.from('revisions').insert({ chapitre_id: nouveau.id, j_label: 0, date_prevue: j0, faite_le: faite, note: 'decouverte' }).select().single();
          if (rv.error) throw rv.error;
          S.revisions.push(rv.data);
          await recalculer(nouveau);
          fermer(); rendre();
          toast('Chapitre ajouté', `J1 prévu ${dCourt(nouveau.prochaine_date)}`);
        }
      } catch (err) { erreur(err); e.currentTarget.disabled = false; }
    });
    w.querySelector('#suppr')?.addEventListener('click', async () => {
      if (!confirm(`Supprimer « ${ch.nom} » et son historique ? C'est définitif.`)) return;
      const { error } = await sb.from('chapitres').delete().eq('id', ch.id);
      if (error) return erreur(error);
      S.revisions = S.revisions.filter((r) => r.chapitre_id !== ch.id);
      S.chapitres = S.chapitres.filter((c) => c.id !== ch.id);
      fermer(); location.hash = '#/matieres';
    });
  });
}

function ficheRevision({ revId = null, chId = null }) {
  const rv = revId ? S.revisions.find((r) => r.id === revId) : null;
  const ch = S.chapitres.find((c) => c.id === (rv?.chapitre_id || chId)); if (!ch) return;
  let note = rv?.note || 'frais';
  const localISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const val = rv ? localISO(new Date(rv.faite_le)) : `${A.ajouterJours(today(), -1)}T18:00`;
  const notes = rv?.note === 'decouverte' ? ['decouverte'] : ['rate', 'complique', 'frais', 'tres_frais'];
  const html = `${enteteFiche(rv ? 'Modifier la révision' : 'Révision passée', esc(ch.nom))}
    <div class="field"><label for="quand">Date et heure</label><input id="quand" class="input" type="datetime-local" value="${val}" max="${localISO(new Date())}"></div>
    ${rv?.note === 'decouverte' ? '<div class="small muted">C’est le J0 du chapitre : pour changer sa date, modifie la date du J0 du chapitre.</div>' : `<div class="field"><div class="flabel">Comment ça s'était passé ?</div><div class="stack" style="gap:8px" id="opts">${notes.map((k) => `<button class="option ${k === note ? 'on' : ''}" data-note="${k}"><span class="dot" style="width:12px;height:12px;border-radius:6px;background:${NOTE_COULEUR[k]}"></span><b>${A.NOTES[k].label}</b></button>`).join('')}</div></div>`}
    ${rv?.note === 'decouverte' ? '' : `<button class="btn" id="ok">${rv ? 'Enregistrer' : 'Ajouter la révision'}</button>`}
    ${rv && rv.note !== 'decouverte' ? '<button class="btn ghost" id="suppr" style="color:var(--late)">Supprimer cette révision</button>' : ''}
    <div class="small muted">La suite du planning est recalculée automatiquement.</div>`;
  ouvrirFiche(html, (w, fermer) => {
    if (rv?.note === 'decouverte') w.querySelector('#quand').disabled = true;
    w.querySelector('#opts')?.addEventListener('click', (e) => { const b = e.target.closest('[data-note]'); if (!b) return; note = b.dataset.note; w.querySelectorAll('.option').forEach((o) => o.classList.toggle('on', o === b)); });
    w.querySelector('#ok')?.addEventListener('click', async (e) => {
      const d = new Date(w.querySelector('#quand').value);
      if (isNaN(d)) return;
      if (A.ecartJours(ch.date_j0, A.isoJour(d)) < 0) { toast('Date impossible', 'Une révision ne peut pas précéder le J0.'); return; }
      e.currentTarget.disabled = true;
      const payload = { faite_le: d.toISOString(), note, j_label: A.ecartJours(ch.date_j0, A.isoJour(d)) };
      try {
        if (rv) { const up = await sb.from('revisions').update(payload).eq('id', rv.id).select().single(); if (up.error) throw up.error; Object.assign(rv, up.data); }
        else { const ins = await sb.from('revisions').insert({ ...payload, chapitre_id: ch.id }).select().single(); if (ins.error) throw ins.error; S.revisions.push(ins.data); }
        await recalculer(ch); fermer(); rendre(); toast('Historique mis à jour', ch.prochaine_date ? `Prochaine : ${dCourt(ch.prochaine_date)}` : '');
      } catch (err) { erreur(err); e.currentTarget.disabled = false; }
    });
    w.querySelector('#suppr')?.addEventListener('click', async () => {
      const { error } = await sb.from('revisions').delete().eq('id', rv.id); if (error) return erreur(error);
      S.revisions = S.revisions.filter((r) => r.id !== rv.id);
      await recalculer(ch); fermer(); rendre();
    });
  });
}

// ---------------------------------------------------------------- Calendrier (.ics)
function planifier(chId, dateIso) {
  const ch = S.chapitres.find((c) => c.id === chId); if (!ch) return;
  const m = matiereDe(ch);
  const j = jDe(ch);
  const dur = A.dureeCreneau(j, S.reglages);
  const [hh, mm] = String(S.reglages.heure_planif || '18:00').split(':').map(Number);
  const debut = A.jour(dateIso); debut.setHours(hh, mm, 0, 0);
  const fin = new Date(debut.getTime() + dur * 60000);
  const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = (s) => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Memo J//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${ch.id}-${dateIso}@memo-j`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(debut)}`, `DTEND:${z(fin)}`,
    `SUMMARY:${txt(`J${j} · ${m.nom} · ${ch.nom}`)}`, `DESCRIPTION:${txt('Mémo J · exercice sans le cours, puis correction et relecture ciblée.')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(`Révision J${j}`)}`, 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const fichier = new File([ics], `memo-j-${dateIso}.ics`, { type: 'text/calendar' });
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a'); a.href = url; a.download = fichier.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  sb.from('chapitres').update({ planifie_a: debut.toISOString() }).eq('id', ch.id).select().single().then(({ data }) => { if (data) { Object.assign(ch, data); rendre(); } });
  toast('Envoyé à Calendrier', `J${j} · ${m.nom} · ${dureeTxt(dur)}, ${dCourt(dateIso)} à ${hh}h${String(mm).padStart(2, '0')}. Il ne reste qu’à le déplacer.`);
}

// ---------------------------------------------------------------- export / import
function telecharger(nom, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function exporterJSON() {
  const sans = (o) => { const { user_id, ...r } = o; return r; };
  const data = { app: 'memo-j', version: 1, exporte_le: new Date().toISOString(), matieres: S.matieres.map(sans), chapitres: S.chapitres.map(sans), revisions: S.revisions.map(sans), reglages: sans(S.reglages) };
  telecharger(`memo-j-sauvegarde-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
}
function exporterCSV() {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lignes = [['Matière', 'Chapitre', 'J', 'Date', 'Heure', 'Note', 'Prévue le'].map(q).join(';')];
  for (const r of [...S.revisions].sort((a, b) => new Date(a.faite_le) - new Date(b.faite_le))) {
    const ch = S.chapitres.find((c) => c.id === r.chapitre_id); const m = ch && matiereDe(ch);
    lignes.push([m?.nom, ch?.nom, `J${r.j_label}`, A.isoJour(r.faite_le), heure(r.faite_le), A.NOTES[r.note].label, r.date_prevue || ''].map(q).join(';'));
  }
  telecharger(`memo-j-revisions-${today()}.csv`, '﻿' + lignes.join('\r\n'), 'text/csv');
}
async function importerJSON(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('Fichier illisible', 'Choisis une sauvegarde Mémo J (.json).'); }
  if (data.app !== 'memo-j' || !Array.isArray(data.matieres)) return toast('Fichier non reconnu', 'Ce n’est pas une sauvegarde Mémo J.');
  const remplacer = confirm(`Sauvegarde du ${new Date(data.exporte_le).toLocaleDateString('fr-FR')} : ${data.matieres.length} matières, ${data.chapitres.length} chapitres, ${data.revisions.length} révisions.\n\nOK = REMPLACER toutes tes données actuelles\nAnnuler = les AJOUTER à tes données actuelles`);
  try {
    if (remplacer) { const d = await sb.from('matieres').delete().not('id', 'is', null); if (d.error) throw d.error; }
    const idM = new Map(), idC = new Map();
    const champs = (o, keep) => Object.fromEntries(Object.entries(o).filter(([k]) => keep.includes(k)));
    const mats = data.matieres.map((m) => { const id = crypto.randomUUID(); idM.set(m.id, id); return { ...champs(m, ['nom', 'couleur', 'semaine_examen', 'archivee_le', 'archive_mode', 'ordre', 'created_at']), id }; });
    const chs = data.chapitres.filter((c) => idM.has(c.matiere_id)).map((c) => { const id = crypto.randomUUID(); idC.set(c.id, id); return { ...champs(c, ['nom', 'date_j0', 'continuer_apres_examen', 'facteur', 'intervalle_jours', 'prochaine_date', 'prochain_j', 'planifie_a', 'created_at']), id, matiere_id: idM.get(c.matiere_id) }; });
    const revs = data.revisions.filter((r) => idC.has(r.chapitre_id)).map((r) => ({ ...champs(r, ['j_label', 'date_prevue', 'faite_le', 'note', 'created_at']), chapitre_id: idC.get(r.chapitre_id) }));
    for (const [table, rows] of [['matieres', mats], ['chapitres', chs], ['revisions', revs]]) {
      for (let i = 0; i < rows.length; i += 500) { const { error } = await sb.from(table).insert(rows.slice(i, i + 500)); if (error) throw error; }
    }
    await charger();
    for (const c of S.chapitres) await recalculer(c);
    rendre(); toast('Import terminé', `${mats.length} matières, ${chs.length} chapitres, ${revs.length} révisions.`);
  } catch (err) { erreur(err); }
}

// ---------------------------------------------------------------- événements
app.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a, [data-action]');
  if (!t) return;
  const d = t.dataset;
  try {
    if (d.valider) return ficheValidation(d.valider);
    if (d.planifier) return planifier(d.planifier, d.date);
    if (d.toggleMatiere) { S.ui.open[d.toggleMatiere] = !S.ui.open[d.toggleMatiere]; return rendre(); }
    if (d.modifierMatiere) return ficheMatiere(d.modifierMatiere);
    if (d.modifierChapitre) return ficheChapitre({ chId: d.modifierChapitre });
    if (d.modifierRevision) return ficheRevision({ revId: d.modifierRevision });
    if (d.echelle) { S.ui.echelle = d.echelle; return rendre(); }
    if (d.periode) { S.ui.statsPeriode = d.periode; return rendre(); }
    if (d.archiver) {
      const m = S.matieres.find((x) => x.id === d.archiver);
      if (!confirm(`Archiver « ${m.nom} » ? Ses révisions s'arrêtent, tu pourras la remettre en révision.`)) return;
      const { data, error } = await sb.from('matieres').update({ archivee_le: new Date().toISOString(), archive_mode: 'manuel' }).eq('id', m.id).select().single(); if (error) throw error;
      Object.assign(m, data); return rendre();
    }
    if (d.restaurer) {
      const m = S.matieres.find((x) => x.id === d.restaurer);
      const { data, error } = await sb.from('matieres').update({ archivee_le: null, archive_mode: null }).eq('id', m.id).select().single(); if (error) throw error;
      Object.assign(m, data);
      // reprise : les chapitres terminés repartent à J0 aujourd'hui
      for (const c of chapitresDe(m.id)) {
        if (!c.prochaine_date) {
          const up = await sb.from('chapitres').update({ prochaine_date: today(), planifie_a: null }).eq('id', c.id).select().single(); if (!up.error) Object.assign(c, up.data);
        }
      }
      toast('Matière remise en révision', 'Ses chapitres réapparaissent dans Aujourd’hui.'); return rendre();
    }
    if (d.continuer) {
      const ch = S.chapitres.find((c) => c.id === d.continuer);
      const { data, error } = await sb.from('chapitres').update({ continuer_apres_examen: !ch.continuer_apres_examen }).eq('id', ch.id).select().single(); if (error) throw error;
      Object.assign(ch, data); await recalculer(ch); return rendre();
    }
    if (d.reglageBool) return majReglage({ [d.reglageBool]: !S.reglages[d.reglageBool] });
    if (d.themeChoix) return majReglage({ theme: d.themeChoix });
    switch (d.action) {
      case 'nouvelle-matiere': return ficheMatiere();
      case 'nouveau-chapitre': return ficheChapitre({ matiereId: d.matiere });
      case 'ajouter-revision': return ficheRevision({ chId: d.chapitre });
      case 'toggle-archives': S.ui.archOpen = !S.ui.archOpen; return rendre();
      case 'sem-prev': S.ui.semaineOffset = Math.max(0, S.ui.semaineOffset - 1); return rendre();
      case 'sem-next': S.ui.semaineOffset++; return rendre();
      case 'export-json': return exporterJSON();
      case 'export-csv': return exporterCSV();
      case 'deconnexion': await sb.auth.signOut(); return;
      case 'mdp-oublie': {
        const email = document.getElementById('email')?.value.trim();
        if (!email) return rendreConnexion('', 'Saisis d’abord ton adresse e-mail.');
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        return error ? rendreConnexion('', error.message) : rendreConnexion('Un e-mail de réinitialisation vient de t’être envoyé.');
      }
      default:
    }
  } catch (err) { erreur(err); }
});
app.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.reglageHeure) return majReglage({ [el.dataset.reglageHeure]: el.value });
  if (el.dataset.reglageDuree) return majReglage({ [el.dataset.reglageDuree]: Number(el.value) });
  if (el.dataset.action === 'import-json' && el.files[0]) return importerJSON(el.files[0]);
});
app.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id === 'form-mdp') {
    const { error } = await sb.auth.updateUser({ password: document.getElementById('nmdp').value });
    if (error) return toast('Échec', error.message);
    S.recovery = false; history.replaceState(null, '', location.pathname + '#/aujourdhui'); rendre(); return toast('Mot de passe enregistré', '');
  }
  if (e.target.id !== 'form-auth') return;
  const mode = e.submitter?.dataset.mode || 'connexion';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('mdp').value;
  e.submitter && (e.submitter.disabled = true);
  if (mode === 'inscription') {
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return rendreConnexion('', error.message);
    if (!data.session) return rendreConnexion('Compte créé : confirme ton adresse avec le lien reçu par e-mail, puis connecte-toi ici.');
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return rendreConnexion('', error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message === 'Email not confirmed' ? 'Confirme d’abord ton adresse avec le lien reçu par e-mail.' : error.message);
  }
});

async function majReglage(val) {
  const { data, error } = await sb.from('reglages').update({ ...val, updated_at: new Date().toISOString() }).eq('user_id', S.user.id).select().single();
  if (error) return erreur(error);
  S.reglages = data; appliquerTheme(); rendre();
}

// ---------------------------------------------------------------- démarrage
sb.auth.onAuthStateChange(async (evt, session) => {
  if (evt === 'PASSWORD_RECOVERY') { S.user = session?.user || null; S.recovery = true; return rendre(); }
  const u = session?.user || null;
  if (evt !== 'INITIAL_SESSION' && evt !== 'SIGNED_IN' && u?.id === S.user?.id) return;
  S.user = u;
  if (!u) { S.matieres = []; S.chapitres = []; S.revisions = []; S.reglages = null; appliquerTheme(); return rendreConnexion(); }
  setTimeout(async () => {
    app.innerHTML = `<main class="page no-tabs"><div class="empty">${I.logo}<p>Chargement…</p></div></main>`;
    try { await charger(); } catch (err) { erreur(err); }
    if (!location.hash || location.hash.includes('access_token')) history.replaceState(null, '', location.pathname + '#/aujourdhui');
    rendre();
  }, 0);
});
// rafraîchir quand on revient sur l'app (changement de jour, autre appareil)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S.user && !S.recovery) { try { await charger(); rendre(); } catch (_) {} }
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
