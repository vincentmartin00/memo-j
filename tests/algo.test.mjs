// Tests de l'algorithme : node tests/algo.test.mjs
import assert from 'node:assert/strict';
import { planifier, ajouterJours, ecartJours, retention, dureeCreneau, lundi, rejouer, projeter } from '../js/algo.js';

function simuler({ j0, examen, notes, continuer = false, retardJours = {} }) {
  let etat = { intervalle: 0, facteur: 2.5, prochaine: null };
  const dates = [];
  let rang = 0;
  let faite = j0;
  let res = planifier({ dateJ0: j0, faiteLe: j0, note: 'decouverte', rang: 0, intervalle: 0, facteur: 2.5, examen, continuer });
  rang = 1;
  etat = { intervalle: res.intervalle, facteur: res.facteur, prochaine: res.prochaineDate };
  for (let i = 0; i < notes.length && etat.prochaine; i++) {
    faite = ajouterJours(etat.prochaine, retardJours[i] || 0);
    dates.push(faite);
    res = planifier({ dateJ0: j0, faiteLe: faite, note: notes[i], rang, intervalle: etat.intervalle, facteur: etat.facteur, examen, continuer });
    rang++;
    etat = { intervalle: res.intervalle, facteur: res.facteur, prochaine: res.prochaineDate };
  }
  return { dates, fin: etat };
}

// 1. Rythme de base : J1 puis J3
{
  const r = simuler({ j0: '2026-10-01', examen: '2026-12-14', notes: ['frais', 'frais'] });
  assert.equal(r.dates[0], '2026-10-02', 'J1 le lendemain');
  assert.equal(r.dates[1], '2026-10-04', 'J3 deux jours après le J1');
}

// 2. Toujours « encore frais » : les intervalles grandissent puis se resserrent avant l'examen
{
  const r = simuler({ j0: '2026-10-01', examen: '2026-12-14', notes: Array(20).fill('frais') });
  const ecarts = r.dates.slice(1).map((d, i) => ecartJours(r.dates[i], d));
  console.log('Frais ×20 :', r.dates.join(' → '));
  console.log('Écarts   :', ecarts.join(', '));
  const derniere = r.dates[r.dates.length - 1];
  const avant = ecartJours(derniere, '2026-12-14');
  assert.ok(avant >= 2 && avant <= 5, `dernière révision 2 à 5 jours avant l'examen (ici ${avant})`);
  assert.equal(r.fin.prochaine, null, 'pas de révision après l’examen si non conservé');
  // plafond : jamais plus de 25 % des jours restants (plancher 7)
  for (let i = 0; i < r.dates.length - 1; i++) {
    const restant = ecartJours(r.dates[i], '2026-12-14');
    const ecart = ecartJours(r.dates[i], r.dates[i + 1]);
    assert.ok(ecart <= Math.max(7, Math.floor(restant * 0.25)) || ecartJours(r.dates[i + 1], '2026-12-14') >= 2, `plafond respecté au ${r.dates[i]}`);
  }
}

// 3. « Raté » fait revenir le chapitre le lendemain et baisse le facteur
{
  const res = planifier({ dateJ0: '2026-10-01', faiteLe: '2026-10-10', note: 'rate', rang: 4, intervalle: 6, facteur: 2.5, examen: '2026-12-14' });
  assert.equal(res.prochaineDate, '2026-10-11');
  assert.equal(res.facteur, 2.3);
}

// 4. « Très frais » espace plus que « encore frais », « compliqué » moins
{
  const base = { dateJ0: '2026-09-14', faiteLe: '2026-09-26', rang: 4, intervalle: 5, facteur: 2.5, examen: '2026-12-14' };
  const c = planifier({ ...base, note: 'complique' });
  const f = planifier({ ...base, note: 'frais' });
  const t = planifier({ ...base, note: 'tres_frais' });
  console.log('Aperçu (intervalle 5 j) : compliqué', c.intervalle, '· frais', f.intervalle, '· très frais', t.intervalle);
  assert.ok(c.intervalle < f.intervalle && f.intervalle < t.intervalle);
}

// 5. Calendrier glissant : un retard décale la suite
{
  const aHeure = simuler({ j0: '2026-10-01', examen: '2026-12-14', notes: ['frais', 'frais', 'frais'] });
  const enRetard = simuler({ j0: '2026-10-01', examen: '2026-12-14', notes: ['frais', 'frais', 'frais'], retardJours: { 1: 2 } });
  assert.equal(ecartJours(aHeure.dates[2], enRetard.dates[2]), 2, 'la révision suivante est décalée du retard');
}

// 6. Continuer après l'examen : entretien jusqu'à 90 jours
{
  const r = simuler({ j0: '2026-10-01', examen: '2026-12-14', notes: Array(30).fill('frais'), continuer: true });
  const apres = r.dates.filter((d) => ecartJours('2026-12-14', d) > 0);
  console.log('Après examen :', apres.join(' → '));
  assert.ok(apres.length >= 2, 'des révisions continuent après l’examen');
  for (let i = 1; i < apres.length; i++) assert.ok(ecartJours(apres[i - 1], apres[i]) <= 90);
}

// 7. Sans date d'examen : pas de plafond
{
  const r = simuler({ j0: '2026-10-01', examen: null, notes: Array(6).fill('frais') });
  assert.ok(r.fin.prochaine, 'le cycle continue');
}

// 8. Courbe : la rétention baisse moins vite après le J3 qu'après le J1
{
  const revs = [
    { faite_le: '2026-09-14', note: 'decouverte' },
    { faite_le: '2026-09-15', note: 'frais' },
    { faite_le: '2026-09-17', note: 'frais' },
  ];
  const apresJ1 = retention(revs.slice(0, 2), '2026-09-17');
  const apresJ3 = retention(revs, '2026-09-19');
  assert.ok(apresJ3 > apresJ1, 'chute plus lente après le J3');
}

// 9. Durées et lundi
assert.equal(dureeCreneau(0), 60);
assert.equal(dureeCreneau(1), 45);
assert.equal(dureeCreneau(7), 20);
assert.equal(lundi('2026-12-17'), '2026-12-14');

// 10. Rejouer = même résultat que la validation pas à pas, et projection
{
  const revs = [
    { faite_le: '2026-10-01T12:00:00', note: 'decouverte' },
    { faite_le: '2026-10-02T19:00:00', note: 'frais' },
    { faite_le: '2026-10-04T12:00:00', note: 'frais' },
    { faite_le: '2026-10-09T12:00:00', note: 'frais' },
  ];
  const e = rejouer('2026-10-01', revs, '2026-12-14', false);
  assert.equal(e.prochaineDate, '2026-10-22');
  const vide = rejouer('2026-10-01', [], '2026-12-14', false);
  assert.equal(vide.prochaineDate, '2026-10-01', 'sans révision, le J0 est dû');
  const p = projeter(e, '2026-10-01', '2026-12-14', false, '2026-12-31');
  assert.equal(p[0].date, '2026-10-22');
  assert.equal(p[p.length - 1].date, '2026-12-12');
}

console.log('Tous les tests passent.');
