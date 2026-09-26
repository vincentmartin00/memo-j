// Mémo J — envoi des notifications (programme du jour, bilan du lundi, test)
// Appelée toutes les 15 min par pg_cron (avec x-cron-secret), ou par l'app pour un test.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------- dates locales ----------
function localNow(tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { iso: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) % 24 * 60 + Number(parts.minute), weekday: parts.weekday };
}
const isoLocal = (ts: string, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
const jours = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const ajouter = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const minutesDe = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// ---------- modèle de rétention (identique à l'app) ----------
const GAIN: Record<string, number> = { frais: 2.3, complique: 1.6, tres_frais: 3.0 };
function retention(revs: { faite_le: string; note: string }[], today: string, tz: string) {
  if (!revs.length) return 1;
  let S = 1.2;
  revs.forEach((r, i) => {
    if (i === 0 || r.note === 'decouverte') S = 1.2;
    else if (r.note === 'rate') S = Math.max(1, S * 0.6);
    else S = S * (GAIN[r.note] ?? 2.3);
  });
  const t = jours(isoLocal(revs[revs.length - 1].faite_le, tz), today);
  return Math.exp(-Math.max(0, t) / S);
}

async function donnees(userId: string) {
  const [m, c, r] = await Promise.all([
    admin.from('matieres').select('id, nom, archivee_le').eq('user_id', userId),
    admin.from('chapitres').select('id, nom, matiere_id, prochaine_date, prochain_j').eq('user_id', userId),
    admin.from('revisions').select('chapitre_id, faite_le, note, date_prevue').eq('user_id', userId),
  ]);
  const actives = new Map((m.data ?? []).filter((x) => !x.archivee_le).map((x) => [x.id, x]));
  const chapitres = (c.data ?? []).filter((x) => actives.has(x.matiere_id));
  return { actives, chapitres, revisions: r.data ?? [] };
}

async function messageJour(userId: string, today: string) {
  const { actives, chapitres } = await donnees(userId);
  const dues = chapitres.filter((c) => c.prochaine_date && c.prochaine_date <= today).sort((a, b) => a.prochaine_date.localeCompare(b.prochaine_date));
  if (!dues.length) return null;
  const retard = dues.filter((c) => c.prochaine_date < today).length;
  const liste = dues.slice(0, 4).map((c) => `${actives.get(c.matiere_id)!.nom} · ${c.nom} (J${c.prochain_j})`).join(', ');
  const plus = dues.length > 4 ? ` et ${dues.length - 4} autre${dues.length - 4 > 1 ? 's' : ''}` : '';
  return {
    title: 'Révisions du jour',
    body: `${dues.length} révision${dues.length > 1 ? 's' : ''} aujourd'hui${retard ? ` dont ${retard} en retard` : ''} : ${liste}${plus}.`,
    badge: dues.length,
    url: './#/aujourdhui',
  };
}

async function messageSemaine(userId: string, today: string, tz: string) {
  const { actives, chapitres, revisions } = await donnees(userId);
  // semaine dernière : du lundi au dimanche précédents
  const d = new Date(today + 'T00:00:00Z');
  const lundiCourant = ajouter(today, -((d.getUTCDay() + 6) % 7));
  const a = ajouter(lundiCourant, -7), b = ajouter(lundiCourant, -1);
  const faites = revisions.filter((r) => r.note !== 'decouverte' && r.date_prevue && r.date_prevue >= a && r.date_prevue <= b).length;
  const manquees = chapitres.filter((c) => c.prochaine_date && c.prochaine_date >= a && c.prochaine_date <= b).length;
  const prevues = faites + manquees;
  let phrase1 = prevues ? `Semaine dernière : ${Math.round((faites / prevues) * 100)} % des révisions prévues réalisées (${faites} sur ${prevues}).` : 'Aucune révision n’était prévue la semaine dernière.';
  // matière prioritaire : rétention moyenne la plus basse
  const parCh = new Map<string, { faite_le: string; note: string }[]>();
  for (const r of revisions) { if (!parCh.has(r.chapitre_id)) parCh.set(r.chapitre_id, []); parCh.get(r.chapitre_id)!.push(r); }
  for (const l of parCh.values()) l.sort((x, y) => Date.parse(x.faite_le) - Date.parse(y.faite_le));
  let pire: { nom: string; ret: number } | null = null;
  for (const [id, m] of actives) {
    const chs = chapitres.filter((c) => c.matiere_id === id);
    if (!chs.length) continue;
    const ret = chs.reduce((s, c) => s + retention(parCh.get(c.id) ?? [], today, tz), 0) / chs.length;
    if (!pire || ret < pire.ret) pire = { nom: m.nom, ret };
  }
  const phrase2 = pire ? ` Matière prioritaire cette semaine : ${pire.nom}, rétention moyenne de ${Math.round(pire.ret * 100)} %.` : '';
  return { title: 'Bilan de la semaine', body: phrase1 + phrase2, url: './#/stats' };
}

async function envoyer(userId: string, msg: Record<string, unknown>) {
  const { data: subs } = await admin.from('abonnements_push').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  let ok = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 6 * 3600, urgency: 'normal' });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from('abonnements_push').delete().eq('id', s.id);
      else console.error('push', code, (e as Error).message);
    }
  }
  return { appareils: subs?.length ?? 0, envoyees: ok };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const { data: cfgRows } = await admin.from('config_privee').select('cle, valeur');
  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.cle, r.valeur]));
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  const body = await req.json().catch(() => ({}));

  // Notification de test, demandée depuis l'app par l'utilisateur connecté
  if (body.mode === 'test') {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ erreur: 'non connecté' }, 401);
    const { data: g } = await admin.from('reglages').select('fuseau').eq('user_id', user.id).maybeSingle();
    const tz = g?.fuseau ?? 'Europe/Paris';
    const jour = await messageJour(user.id, localNow(tz).iso);
    const msg = jour ? { ...jour, title: 'Test · ' + jour.title } : { title: 'Test Mémo J', body: 'Les notifications fonctionnent. Rien à réviser aujourd’hui.', badge: 0, url: './#/aujourdhui' };
    return json(await envoyer(user.id, msg));
  }

  // Tournée planifiée
  if (req.headers.get('x-cron-secret') !== cfg.cron_secret) return json({ erreur: 'interdit' }, 403);
  const { data: reglages } = await admin.from('reglages').select('*');
  const bilan: unknown[] = [];
  for (const g of reglages ?? []) {
    const now = localNow(g.fuseau || 'Europe/Paris');
    // fenêtre de 3 h après l'heure choisie, y compris quand elle passe minuit
    const dans = (heure: string) => (now.minutes - minutesDe(heure) + 1440) % 1440 < 180;
    const deja = async (type: string) => {
      const { error } = await admin.from('notifications_envoyees').insert({ user_id: g.user_id, type, jour: now.iso });
      return !!error; // conflit = déjà envoyée aujourd'hui
    };
    if (g.notif_jour && dans(g.heure_notif_jour) && !(await deja('jour'))) {
      const msg = await messageJour(g.user_id, now.iso);
      if (msg) bilan.push({ type: 'jour', ...(await envoyer(g.user_id, msg)) });
    }
    if (g.notif_semaine && now.weekday === 'Mon' && dans(g.heure_notif_semaine) && !(await deja('semaine'))) {
      const msg = await messageSemaine(g.user_id, now.iso, g.fuseau || 'Europe/Paris');
      bilan.push({ type: 'semaine', ...(await envoyer(g.user_id, msg)) });
    }
  }
  return json({ ok: true, bilan });
});
