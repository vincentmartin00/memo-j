// Faux client Supabase en mémoire, pour tester l'interface sans réseau.
const uid = 'u-test';
const db = { matieres: [], chapitres: [], revisions: [], reglages: [] };
const now = () => new Date().toISOString();
const defaults = {
  matieres: () => ({ id: crypto.randomUUID(), user_id: uid, couleur: '#2F5BE0', semaine_examen: null, archivee_le: null, archive_mode: null, ordre: 0, created_at: now() }),
  chapitres: () => ({ id: crypto.randomUUID(), user_id: uid, date_j0: new Date().toISOString().slice(0, 10), continuer_apres_examen: false, facteur: 2.5, intervalle_jours: 0, prochaine_date: null, prochain_j: null, planifie_a: null, created_at: now() }),
  revisions: () => ({ id: crypto.randomUUID(), user_id: uid, faite_le: now(), created_at: now() }),
  reglages: () => ({ user_id: uid, theme: 'auto', notif_jour: true, heure_notif_jour: '07:00:00', notif_semaine: true, heure_notif_semaine: '08:00:00', pastille: true, duree_j0: 60, duree_j1: 45, duree_suivantes: 20, heure_planif: '18:00:00', fuseau: 'Europe/Paris', updated_at: now() }),
};
window.__db = db;
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.payload = null; this.one = false; this.maybe = false; }
  select() { if (this.op === 'select') this.op = 'select'; return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k, v) { this.f.push((r) => r[k] === v); return this; }
  not(k, op, v) { this.f.push((r) => r[k] !== v); return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; this.maybe = true; return this; }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
  run() {
    const T = db[this.t];
    let rows;
    if (this.op === 'insert') {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
      rows = arr.map((p) => ({ ...defaults[this.t](), ...p }));
      T.push(...rows);
    } else if (this.op === 'update') {
      rows = T.filter((r) => this.f.every((f) => f(r)));
      rows.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      rows = T.filter((r) => this.f.every((f) => f(r)));
      for (const r of rows) T.splice(T.indexOf(r), 1);
      if (this.t === 'matieres') for (const r of rows) { db.chapitres = db.chapitres.filter((c) => c.matiere_id !== r.id); }
      if (this.t === 'chapitres') for (const r of rows) { db.revisions = db.revisions.filter((v) => v.chapitre_id !== r.id); }
    } else rows = T.filter((r) => this.f.every((f) => f(r)));
    rows = JSON.parse(JSON.stringify(rows));
    if (this.one) return { data: rows[0] ?? null, error: rows[0] || this.maybe ? null : { message: 'no rows' } };
    return { data: rows, error: null };
  }
}
export function createClient() {
  const cbs = [];
  let session = null;
  return {
    from: (t) => new Q(t),
    auth: {
      onAuthStateChange(cb) { cbs.push(cb); setTimeout(() => cb('INITIAL_SESSION', session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword({ email }) { session = { user: { id: uid, email } }; cbs.forEach((cb) => cb('SIGNED_IN', session)); return { error: null }; },
      async signUp({ email }) { return { data: { session: null }, error: null }; },
      async signOut() { session = null; cbs.forEach((cb) => cb('SIGNED_OUT', null)); return { error: null }; },
      async resetPasswordForEmail() { return { error: null }; },
      async updateUser() { return { error: null }; },
    },
  };
}
