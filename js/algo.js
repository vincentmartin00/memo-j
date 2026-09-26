// Mémo J — algorithme de planification des J et modèle de la courbe de l'oubli.
// Fonctions pures : aucune dépendance au navigateur ni à Supabase.

export const NOTES = {
  decouverte: { label: 'Découverte', court: 'J0' },
  rate: { label: 'Raté', desc: 'Exercice non réussi sans le cours' },
  complique: { label: 'Compliqué', desc: 'Réussi, mais avec effort' },
  frais: { label: 'Encore frais', desc: 'Réussi normalement' },
  tres_frais: { label: 'Très frais', desc: 'Réussi sans effort' },
};

export const FACTEUR_MIN = 1.3;
export const FACTEUR_MAX = 3.0;
export const PLANCHER_PLAFOND = 7;      // le plafond « examen » ne descend jamais sous 7 jours
export const MAX_MAINTENANCE = 90;       // intervalle maximum après l'examen

// ---------- Dates (en jours calendaires, sans heure) ----------

export function isoJour(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const j = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

export function jour(iso) {
  // « 2026-09-26 » -> Date locale à minuit
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function ajouterJours(iso, n) {
  const d = jour(iso);
  d.setDate(d.getDate() + n);
  return isoJour(d);
}

export function ecartJours(isoA, isoB) {
  // nombre de jours de A à B (B - A)
  return Math.round((jour(isoB) - jour(isoA)) / 86400000);
}

function borner(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// ---------- Planification ----------

/**
 * Calcule la prochaine révision après une révision validée.
 * @param {object} p
 * @param {string} p.dateJ0             date du J0 (ISO)
 * @param {string} p.faiteLe            date réelle de la révision validée (ISO)
 * @param {string} p.note               'rate' | 'complique' | 'frais' | 'tres_frais' | 'decouverte'
 * @param {number} p.rang               nombre de révisions déjà validées AVANT celle-ci (J0 compris)
 * @param {number} p.intervalle         dernier intervalle utilisé (jours)
 * @param {number} p.facteur            facteur du chapitre
 * @param {string|null} p.examen        lundi de la semaine d'examen (ISO) ou null
 * @param {boolean} p.continuer         continuer à apprendre après l'examen
 * @returns {{prochaineDate: string|null, prochainJ: number|null, intervalle: number, facteur: number, raison: string}}
 */
export function planifier(p) {
  let facteur = Number(p.facteur) || 2.5;
  const note = p.note;
  const rang = p.rang || 0;
  let base = Math.max(Number(p.intervalle) || 0, 2);
  let I;
  let raison;

  if (note === 'decouverte') {
    I = 1;
    raison = 'J1 : le lendemain de la découverte.';
  } else if (note === 'rate') {
    I = 1;
    facteur = borner(facteur - 0.2, FACTEUR_MIN, FACTEUR_MAX);
    raison = 'Le chapitre revient dès demain et son facteur baisse.';
  } else if (rang <= 1) {
    // première révision après le J0 : on vise le J3
    I = 2;
    raison = 'J3 : deux jours après le J1.';
  } else if (note === 'complique') {
    I = base * 1.2;
    facteur = borner(facteur - 0.15, FACTEUR_MIN, FACTEUR_MAX);
    raison = 'Intervalle précédent × 1,2 · facteur du chapitre en baisse.';
  } else if (note === 'tres_frais') {
    I = base * facteur * 1.3;
    facteur = borner(facteur + 0.15, FACTEUR_MIN, FACTEUR_MAX);
    raison = 'Intervalle précédent × facteur × 1,3.';
  } else {
    I = base * facteur;
    raison = `Intervalle précédent × facteur du chapitre (${facteur.toFixed(1).replace('.', ',')}).`;
  }

  I = Math.max(1, Math.round(I));
  const aujourdHui = p.faiteLe;
  let prochaine = ajouterJours(aujourdHui, I);

  if (p.examen) {
    const avantExamen = ecartJours(aujourdHui, p.examen); // jours restants avant l'examen
    if (avantExamen > 0) {
      // Plafond : 25 % des jours restants, jamais sous 7 jours
      const plafond = Math.max(PLANCHER_PLAFOND, Math.floor(avantExamen * 0.25));
      if (I > plafond && note !== 'rate') {
        I = plafond;
        prochaine = ajouterJours(aujourdHui, I);
        raison += ` Plafond examen : ${plafond} jours.`;
      }
      // Dernière révision garantie 2 à 5 jours avant l'examen
      const limite = ajouterJours(p.examen, -2);
      if (ecartJours(prochaine, limite) < 0 && avantExamen > 5) {
        prochaine = ajouterJours(p.examen, -3);
        I = ecartJours(aujourdHui, prochaine);
        raison = 'Dernière révision avant l’examen.';
      } else if (avantExamen <= 5 && ecartJours(p.examen, prochaine) >= 0) {
        // on est déjà dans la dernière ligne droite : la prochaine tombe après l'examen
        if (!p.continuer) {
          return { prochaineDate: null, prochainJ: null, intervalle: I, facteur, raison: 'Dernière révision avant l’examen : fin du cycle.' };
        }
      }
    } else if (!p.continuer) {
      // examen passé et chapitre non conservé : plus de révision
      return { prochaineDate: null, prochainJ: null, intervalle: I, facteur, raison: 'Examen passé : chapitre terminé.' };
    } else {
      // maintenance pour le Master
      I = Math.min(I, MAX_MAINTENANCE);
      prochaine = ajouterJours(aujourdHui, I);
      raison += ' Entretien après l’examen.';
    }
  }

  return {
    prochaineDate: prochaine,
    prochainJ: ecartJours(p.dateJ0, prochaine),
    intervalle: I,
    facteur: Math.round(facteur * 100) / 100,
    raison,
  };
}

/** Aperçu des 4 résultats possibles pour la fiche de validation. */
export function apercus(p) {
  const res = {};
  for (const n of ['rate', 'complique', 'frais', 'tres_frais']) res[n] = planifier({ ...p, note: n });
  return res;
}

/**
 * Rejoue toutes les révisions d'un chapitre (triées par date) pour retrouver son état.
 * Permet de modifier ou d'ajouter des révisions passées (reprise depuis Puissance J).
 */
export function rejouer(dateJ0, revisions, examen, continuer) {
  const tri = [...revisions].sort((a, b) => new Date(a.faite_le) - new Date(b.faite_le));
  let etat = { facteur: 2.5, intervalle: 0, prochaineDate: dateJ0, prochainJ: 0, raison: 'J0 à faire.' };
  tri.forEach((r, i) => {
    const res = planifier({
      dateJ0, faiteLe: isoJour(r.faite_le), note: r.note, rang: i,
      intervalle: etat.intervalle, facteur: etat.facteur, examen, continuer,
    });
    etat = res;
  });
  return { ...etat, rang: tri.length };
}

/**
 * Projection des prochaines révisions en supposant « encore frais » à chaque fois.
 * Sert aux révisions prévisionnelles (page Semaine, courbe, statistiques du semestre).
 */
export function projeter(etat, dateJ0, examen, continuer, jusqua, max = 40) {
  const out = [];
  let e = { ...etat };
  let rang = e.rang || 1;
  while (e.prochaineDate && ecartJours(e.prochaineDate, jusqua) >= 0 && out.length < max) {
    out.push({ date: e.prochaineDate, j: e.prochainJ });
    const res = planifier({ dateJ0, faiteLe: e.prochaineDate, note: 'frais', rang, intervalle: e.intervalle, facteur: e.facteur, examen, continuer });
    rang++;
    e = { ...res, rang };
  }
  return out;
}

// ---------- Courbe de l'oubli (modèle théorique) ----------

const GAIN = { decouverte: 1, rate: 0.6, complique: 1.6, frais: 2.3, tres_frais: 3.0 };

/** Stabilité (en jours) après chaque révision, dans l'ordre chronologique. */
export function stabilites(revisions) {
  let S = 1.2;
  return revisions.map((r, i) => {
    if (i === 0 || r.note === 'decouverte') S = 1.2;
    else if (r.note === 'rate') S = Math.max(1, S * GAIN.rate);
    else S = S * GAIN[r.note];
    return { ...r, S };
  });
}

/** Rétention estimée (0 à 1) à une date donnée. */
export function retention(revisions, isoDate) {
  const rs = stabilites(revisions).filter((r) => ecartJours(isoJour(r.faite_le), isoDate) >= 0);
  if (!rs.length) return 1;
  const last = rs[rs.length - 1];
  const t = ecartJours(isoJour(last.faite_le), isoDate);
  return Math.exp(-t / last.S);
}

/** Durée du créneau (minutes) selon le numéro de J. */
export function dureeCreneau(j, reglages = {}) {
  if (j === 0) return reglages.duree_j0 ?? 60;
  if (j === 1) return reglages.duree_j1 ?? 45;
  return reglages.duree_suivantes ?? 20;
}

/** Lundi de la semaine d'une date. */
export function lundi(iso) {
  const d = jour(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return isoJour(d);
}
