# Mémo J

Web app de révision avec la méthode des J (J0, J1, J3, puis intervalles adaptés à l'auto-évaluation).

## Contenu

- `index.html`, `styles.css` : l'interface
- `js/app.js` : les écrans et la connexion à Supabase
- `js/algo.js` : l'algorithme des J et la courbe de l'oubli
- `sw.js`, `manifest.webmanifest`, `icons/` : installation sur l'écran d'accueil et fonctionnement hors ligne
- `vendor/supabase.js` : bibliothèque Supabase (v2.117)

## Mise en ligne

Le dossier est un site statique : il suffit de le déposer tel quel chez un hébergeur (Netlify, GitHub Pages, Cloudflare Pages). Il doit être servi en HTTPS.

Ensuite, dans Supabase : Authentication › URL Configuration › Site URL = l'adresse du site.

## Installation sur l'iPhone

Ouvrir l'adresse dans Safari › Partager › « Sur l'écran d'accueil ».

## Tests

- `node tests/algo.test.mjs` : algorithme
- `python3 tests/e2e.py` : parcours complet dans un navigateur, avec une base simulée
