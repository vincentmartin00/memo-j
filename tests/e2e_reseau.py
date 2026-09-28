# Test avec le vrai client Supabase face à un faux serveur, avec coupures réseau simulées.
import asyncio, base64, json, os, subprocess, sys, time, uuid, urllib.parse
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = 'https://ejpsnyrmsxezkrocyglx.supabase.co'
UID = str(uuid.uuid4())
db = {'matieres': [], 'chapitres': [], 'revisions': [], 'reglages': [], 'abonnements_push': []}
stats = {'coupures': 0, 'requetes': 0, 'lectures': {}}
couper = {'prochaine_ecriture': 0}

def b64(d):
    return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
TOKEN = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'role': 'authenticated', 'exp': int(time.time()) + 36000, 'aud': 'authenticated', 'email': 'v@test.fr'}) + '.sig'
USER = {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'v@test.fr', 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-09-01T00:00:00Z'}
DEFAUTS = {
    'matieres': lambda: {'couleur': '#2F5BE0', 'semaine_examen': None, 'archivee_le': None, 'archive_mode': None, 'ordre': 0, 'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ')},
    'chapitres': lambda: {'continuer_apres_examen': False, 'facteur': 2.5, 'intervalle_jours': 0, 'prochaine_date': None, 'prochain_j': None, 'planifie_a': None, 'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ')},
    'revisions': lambda: {'date_prevue': None, 'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ')},
    'reglages': lambda: {'theme': 'auto', 'notif_jour': True, 'heure_notif_jour': '07:00:00', 'notif_semaine': True, 'heure_notif_semaine': '08:00:00', 'pastille': True, 'duree_j0': 60, 'duree_j1': 45, 'duree_suivantes': 20, 'heure_planif': '18:00:00', 'fuseau': 'Europe/Paris'},
    'abonnements_push': lambda: {},
}

def filtre(rows, qs):
    out = rows
    for k, v in qs.items():
        if k in ('select', 'on_conflict', 'columns'):
            continue
        val = v[0]
        if val.startswith('eq.'):
            out = [r for r in out if str(r.get(k)) == val[3:]]
        elif val.startswith('not.is.'):
            out = [r for r in out if r.get(k) is not None]
    return out

async def handler(route):
    req = route.request
    url = urllib.parse.urlparse(req.url)
    stats['requetes'] += 1
    cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*'}
    if req.method == 'OPTIONS':
        return await route.fulfill(status=200, headers=cors, body='')
    if url.path.startswith('/auth/v1/token'):
        return await route.fulfill(status=200, headers={**cors, 'content-type': 'application/json'}, body=json.dumps({'access_token': TOKEN, 'token_type': 'bearer', 'expires_in': 36000, 'expires_at': int(time.time()) + 36000, 'refresh_token': 'r', 'user': USER}))
    if url.path.startswith('/auth/v1/user'):
        return await route.fulfill(status=200, headers={**cors, 'content-type': 'application/json'}, body=json.dumps(USER))
    if not url.path.startswith('/rest/v1/'):
        return await route.fulfill(status=404, headers=cors, body='{}')
    table = url.path.split('/')[-1]
    qs = urllib.parse.parse_qs(url.query)
    if req.method != 'GET' and couper['prochaine_ecriture'] > 0:
        couper['prochaine_ecriture'] -= 1
        stats['coupures'] += 1
        return await route.abort('internetdisconnected')  # la requête n'atteint jamais le serveur
    rows = db[table]
    single = 'vnd.pgrst.object' in (req.headers.get('accept') or '')
    if req.method == 'GET':
        stats['lectures'][table] = stats['lectures'].get(table, 0) + 1
        data = filtre(rows, qs)
    elif req.method == 'POST':
        payload = json.loads(req.post_data or '{}')
        payload = payload if isinstance(payload, list) else [payload]
        data = []
        for p in payload:
            p = {**p}
            p.setdefault('user_id', UID)
            if table != 'reglages':
                p.setdefault('id', str(uuid.uuid4()))
            existant = next((r for r in rows if p.get('id') and r.get('id') == p.get('id')), None)
            if existant and 'merge-duplicates' in (req.headers.get('prefer') or ''):
                existant.update(p); data.append(existant)
            elif existant:
                return await route.fulfill(status=409, headers={**cors, 'content-type': 'application/json'}, body=json.dumps({'message': 'duplicate key'}))
            else:
                r = {**DEFAUTS[table](), **p}; rows.append(r); data.append(r)
    elif req.method == 'PATCH':
        payload = json.loads(req.post_data or '{}')
        data = filtre(rows, qs)
        for r in data: r.update(payload)
    elif req.method == 'DELETE':
        data = filtre(rows, qs)
        for r in data: rows.remove(r)
    else:
        data = []
    if single:
        if not data:
            return await route.fulfill(status=406, headers={**cors, 'content-type': 'application/json'}, body=json.dumps({'message': 'no rows', 'code': 'PGRST116'}))
        body = json.dumps(data[0])
    else:
        body = json.dumps(data)
    await route.fulfill(status=201 if req.method == 'POST' else 200, headers={**cors, 'content-type': 'application/json'}, body=body)

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8768', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    erreurs, toasts = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, locale='fr-FR', timezone_id='Europe/Paris')
        page = await ctx.new_page()
        page.on('pageerror', lambda e: erreurs.append(str(e)))
        await page.route(HOST + '/**', handler)
        await page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=''))
        await page.expose_function('noteToast', lambda t: toasts.append(t))
        await page.add_init_script("new MutationObserver(() => { const t = document.querySelector('.toast'); if (t && !t.dataset.vu) { t.dataset.vu = 1; window.noteToast(t.innerText.replace(/\\n/g, ' | ')); } }).observe(document, { childList: true, subtree: true });")
        await page.goto('http://localhost:8768/index.html')
        await page.wait_for_selector('#form-auth')
        await page.fill('#email', 'v@test.fr'); await page.fill('#mdp', 'motdepasse1')
        await page.click('button[data-mode=connexion]')
        await page.wait_for_selector('button[data-action=nouvelle-matiere]')
        await page.wait_for_timeout(800)
        print('lectures au démarrage :', stats['lectures'])

        # 1. création de matière avec la 1re écriture coupée (comme au retour d'arrière-plan)
        couper['prochaine_ecriture'] = 1
        await page.click('button[data-action=nouvelle-matiere]')
        await page.fill('#nom-m', 'Droit bancaire')
        await page.click('#ok'); await page.wait_for_timeout(2500)
        print('1. matières en base :', [m['nom'] for m in db['matieres']], '| coupures :', stats['coupures'], '| fiche fermée :', await page.evaluate("!document.querySelector('.sheet-wrap')"))

        # 2. création de chapitre avec 2 coupures d'affilée (relances successives)
        couper['prochaine_ecriture'] = 2
        await page.click('.acc-body button[data-action=nouveau-chapitre]')
        await page.fill('#nom-c', 'Ch. 1 · Le crédit')
        await page.click('#ok'); await page.wait_for_timeout(4500)
        print('2. chapitres :', [c['nom'] for c in db['chapitres']], '| J0 :', len([r for r in db['revisions'] if r['note'] == 'decouverte']), '| coupures :', stats['coupures'])

        # 3. réseau vraiment coupé : 3 échecs → message clair, rien de perdu, et nouvel essai sans doublon
        couper['prochaine_ecriture'] = 3
        await page.click('.acc-body button[data-action=nouveau-chapitre]')
        await page.fill('#nom-c', 'Ch. 2 · Les garanties')
        await page.click('#ok'); await page.wait_for_timeout(3500)
        print('3a. toast :', toasts[-1] if toasts else None, '| bouton réactivé :', await page.evaluate("!document.querySelector('#ok').disabled"))
        await page.click('#ok'); await page.wait_for_timeout(1500)
        noms = [c['nom'] for c in db['chapitres']]
        print('3b. chapitres :', noms, '| doublons :', len(noms) - len(set(noms)), '| J0 :', len([r for r in db['revisions'] if r['note'] == 'decouverte']))

        # 4. actualisation (retour dans l'app) pendant qu'une fiche est ouverte : ignorée
        l0 = dict(stats['lectures'])
        await page.click('.acc-body button[data-action=nouveau-chapitre]')
        await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        await page.fill('#nom-c', 'Ch. 3'); await page.click('#ok'); await page.wait_for_timeout(1200)
        print('4. lectures pendant la fiche :', {k: stats['lectures'][k] - l0.get(k, 0) for k in stats['lectures']}, '| chapitres :', len(db['chapitres']))

        # 5. retour dans l'app sans fiche : une seule actualisation
        l0 = dict(stats['lectures'])
        await page.evaluate("document.dispatchEvent(new Event('visibilitychange')); document.dispatchEvent(new Event('visibilitychange'))")
        await page.wait_for_timeout(1200)
        print('5. lectures (2 retours rapides) :', {k: stats['lectures'][k] - l0.get(k, 0) for k in stats['lectures']})

        # 6. validation d'une révision avec coupure
        await page.goto('http://localhost:8768/index.html#/aujourdhui'); await page.wait_for_timeout(1000)
        n = await page.locator('button[data-valider]').count()
        if n:
            couper['prochaine_ecriture'] = 1
            await page.click('button[data-valider] >> nth=0'); await page.wait_for_selector('#ok')
            await page.click('#ok'); await page.wait_for_timeout(2500)
        print('6. révisions :', len(db['revisions']), '| à valider aujourd’hui :', n)
        print('toasts :', toasts)
        await b.close()
    srv.terminate()
    print('ERREURS JS :', erreurs or 'aucune')

asyncio.run(main())
