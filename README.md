# PandiFlow 🐼✨

**La routine du soir des enfants devient un jeu.** Le parent note chaque tâche de la soirée en vert, orange ou rouge depuis son téléphone, dont l'écran est dupliqué sur la télé. La jauge de chaque enfant avance, il gagne des **pandi** et les dépense en accessoires pour son avatar. Des **défis** (par exemple 10 brossages de dents en vert) débloquent des trésors animés comme **Brossou, la brosse à dents super-héros** qui vole et se met du dentifrice toute seule.

Pensé pour les 5 à 10 ans : grosses tuiles avec émojis, couleurs vives, sons, et des animations partout.

---

## Fonctionnalités

| | |
|---|---|
| 🌙 **Soirée** | Une colonne par enfant, une jauge par enfant, notation en un tap. Pièces qui volent, jauge qui se remplit, célébration de fin de soirée et bonus « soirée parfaite ». |
| 🧒 **Avatar** | Personnage dessiné (14 coiffures, 10 teintes de peau, yeux, lunettes, taches de rousseur, dent de lait…), qui cligne des yeux, respire et réagit aux notes. |
| 📸 **Photo magique** | Une photo de l'enfant est analysée par Claude, qui règle l'avatar pour qu'il lui ressemble. La photo n'est jamais conservée. |
| 🛍️ **Boutique** | 40 objets : chapeaux, lunettes, capes et ailes, pyjamas, compagnons animés, décors, effets magiques. |
| 🎭 **Costumes complets** | 25 tenues qui habillent tout le personnage : pompier, police, médecin, super-héros, tortues ninja (4 couleurs), maillots de foot (PSG, OM, OL, France, Real Madrid, Barça, Brésil — couleurs des équipes, sans logo officiel), rabbin (chapeau, barbe, péot, tsitsit), dompteur de lions, dresseur de dragons, astronaute, chef, chevalier, capitaine pirate, magicien, prince et princesse. |
| 💰 **Cagnotte** | En touchant le compteur de pandi (code parent), on offre ou retire des pandi hors des routines, avec une raison. Pandi la mascotte saute de joie ou pleure sous son petit nuage. Un retrait ne fait jamais passer la cagnotte sous zéro. |
| 🏆 **Défis** | Défis cumulatifs (les soirs ratés ne remettent pas à zéro) avec 4 trésors exclusifs animés. |
| 🔐 **Espace parent** | Code PIN, gestion des enfants, des tâches (jours actifs), des défis et du barème, historique corrigeable, ajustement des pandi, sauvegarde. |
| ☁️ **Synchronisation** | Supabase : les deux parents partagent la même famille, chacun sur son téléphone. Les notes données hors connexion partent dès le retour du réseau. |

Barème par défaut : vert = 3 pandi, orange = 1, rouge = 0, +5 pour une soirée toute verte (modifiable).

---

## 1. Essayer tout de suite (mode démo)

Sans aucune configuration, l'app tourne en **mode démo** : les données restent dans le navigateur.

```bash
python tools/devserver.py
```

Puis ouvrir http://localhost:8080. Les tests unitaires sont sur http://localhost:8080/tests/ et la galerie des avatars sur http://localhost:8080/tests/gallery.html (`?s=items`, `?s=big`).

---

## 2. Mise en ligne sur pandiflow.com

### Étape A — Supabase (déjà fait)

Le projet Supabase **pandiflow** (région Paris, référence `kyhhkhmwdostzdaksxzw`) a été créé et configuré avec l'outil en ligne de commande Supabase :

- tables et règles de sécurité : [`supabase/schema.sql`](supabase/schema.sql), envoyé avec `supabase db query --linked --project-ref kyhhkhmwdostzdaksxzw --file supabase/schema.sql` ;
- adresse du site et redirections autorisées : [`supabase/config.toml`](supabase/config.toml), envoyé avec `supabase config push --project-ref kyhhkhmwdostzdaksxzw` ;
- URL du projet et clé publique (*publishable*) dans [`js/config.js`](js/config.js). Ces deux valeurs sont publiques par conception : la sécurité repose sur les règles RLS du schéma.

### Étape A bis — Connexion des parents

Chaque parent crée son compte avec **e-mail + mot de passe** (8 caractères minimum). Aucun e-mail de confirmation n'est envoyé : le service d'e-mail gratuit de Supabase n'écrit qu'aux membres de l'organisation Supabase, et l'accès à une famille est de toute façon protégé par les invitations. Le lien « Mot de passe oublié » n'arrive donc qu'aux membres de l'organisation, sauf à brancher un SMTP dans *Authentication → SMTP Settings*.

**Inviter un autre parent** : *Espace parent → Réglages → Parents de la famille → Inviter un parent*. Le code a 8 caractères, il est valable 48 h et ne sert qu'une fois ; 5 invitations en cours et 6 parents au maximum par famille ; 10 essais ratés par heure au maximum. Seul le créateur de la famille peut retirer un parent. Ces règles sont dans [`supabase/migrations/20261020120000_invitations.sql`](supabase/migrations/20261020120000_invitations.sql).

**Connexion avec Google (facultatif)** : le bouton « Continuer avec Google » apparaît tout seul dès que le fournisseur Google est activé dans Supabase.

1. Dans la [console Google Cloud](https://console.cloud.google.com/projectcreate), créer un projet `PandiFlow` (avec un compte Google personnel).
2. **Google Auth Platform → Get started** : nom de l'app `PandiFlow`, ton e-mail d'assistance, audience **External**, ton e-mail de contact.
3. **Branding → Authorized domains** : ajouter `pandiflow.com` et `supabase.co`.
4. **Clients → Create client** : type *Web application*, nom `PandiFlow`.
   - *Authorized JavaScript origins* : `https://pandiflow.com` et `http://localhost:8080`
   - *Authorized redirect URIs* : `https://kyhhkhmwdostzdaksxzw.supabase.co/auth/v1/callback`
5. Copier le **Client ID** et le **Client secret**.
6. **Audience** : cliquer sur *Publish app* (les autorisations demandées, e-mail et profil, ne demandent pas de validation par Google), ou ajouter les adresses Gmail des deux parents comme *Test users*.
7. Dans Supabase : [Authentication → Sign In / Providers → Google](https://supabase.com/dashboard/project/kyhhkhmwdostzdaksxzw/auth/providers) → activer, coller le Client ID et le Client secret → *Save*. Le secret reste dans Supabase, jamais dans le code.

### Étape B — Photo magique (Edge Function + clé Claude)

1. La fonction `analyze-photo` est déployée avec `supabase functions deploy analyze-photo --project-ref kyhhkhmwdostzdaksxzw --use-api --no-verify-jwt` (elle vérifie elle-même la session du parent).
2. Enregistrer la clé API Claude (créée sur [console.anthropic.com](https://console.anthropic.com)) avec le script [`tools/set-claude-key.ps1`](tools/set-claude-key.ps1) : il la demande en saisie masquée et l'envoie dans les secrets Supabase (`ANTHROPIC_API_KEY`). La clé reste côté serveur : elle n'est jamais dans le navigateur ni dans le code.
3. Si la clé n'est rattachée à aucun espace de travail (*workspace*) de la console Anthropic, ajouter aussi le secret `ANTHROPIC_WORKSPACE_ID` (identifiant `wrkspc_…` visible dans *Settings → Workspaces*), ou créer une clé directement dans un espace de travail.

Coût indicatif : quelques centimes par photo (modèle `claude-opus-5-5`). L'app limite à 5 analyses par enfant et par jour.

### Étape C — GitHub Pages

1. Créer un dépôt vide `pandiflow` sur GitHub.
2. Pousser le code :
   ```bash
   git remote add origin https://github.com/<ton-compte>/pandiflow.git
   git push -u origin main
   ```
3. **Settings → Pages** : *Source* = *Deploy from a branch*, branche `main`, dossier `/ (root)`.
4. *Custom domain* = `pandiflow.com` (le fichier `CNAME` est déjà dans le dépôt), puis cocher **Enforce HTTPS** quand GitHub le propose.

### Étape D — DNS chez Hostinger

Dans **Hostinger → Domaines → pandiflow.com → DNS / Nameservers** :

1. Supprimer les enregistrements `A` et `ALIAS`/`CNAME` existants sur `@` et sur `www` (ceux mis par défaut par Hostinger).
2. Ajouter :

| Type | Nom | Valeur |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<ton-compte>.github.io` |

La propagation prend de quelques minutes à quelques heures. Ensuite, https://pandiflow.com affiche l'app.

### Étape E — Sur le téléphone et la télé

1. Ouvrir https://pandiflow.com sur le téléphone, créer son compte parent (ou **Continuer avec Google** si activé), puis créer la famille.
2. L'installer comme une app : *Ajouter à l'écran d'accueil* (Safari) ou *Installer l'application* (Chrome).
3. Dans *Espace parent → Réglages → Parents de la famille*, créer une invitation et l'envoyer. Le second parent crée son propre compte et choisit **Rejoindre une famille** avec ce code.
   Sur iPhone, connecte-toi dans Safari **avant** d'ajouter l'app à l'écran d'accueil : la connexion Google peut s'ouvrir hors de l'app installée.
4. Le soir : tenir le téléphone en **paysage**, toucher ⛶ pour le plein écran, puis dupliquer l'écran sur la télé (*Smart View* / *Caster l'écran* sur Android, *Recopie de l'écran* AirPlay sur iPhone). L'écran reste allumé tant que la soirée est ouverte.

---

## Bon à savoir

- **Pause Supabase** : un projet gratuit est mis en pause après 7 jours sans aucune utilisation (vacances…). Il suffit de cliquer sur *Restore project* dans le tableau de bord ; aucune donnée n'est perdue.
- **Confidentialité** : la photo d'un enfant est envoyée une seule fois à l'API Claude d'Anthropic pour l'analyse (après consentement du parent), puis oubliée. Seuls les réglages du personnage sont enregistrés. Les données de l'API ne servent pas à entraîner les modèles par défaut.
- **Sauvegarde** : *Espace parent → Réglages → Sauvegarde* télécharge toutes les données en JSON.

---

## Organisation du code

Application statique sans étape de build : HTML + modules JavaScript, bibliothèques embarquées dans `js/vendor/` (Preact + htm, supabase-js, GSAP, canvas-confetti).

```
index.html, manifest.webmanifest, sw.js   page, PWA, cache hors ligne
css/app.css, css/avatar.css                styles et animations
js/main.js, js/router.js                   démarrage et navigation (#/soiree, #/enfant/:id, #/parent)
js/domain.js                               règles du jeu (points, bonus, solde, défis) — fonctions pures
js/lib/actions.js                          actions de l'app + file d'attente d'écriture hors ligne
js/lib/localRepo.js, supabaseRepo.js       stockage démo (localStorage) / cloud (Supabase)
js/avatar/                                 personnage SVG, coiffures, objets, trésors animés
js/anim/                                   ciel du soir, pièces volantes, confettis
js/components/, js/pages/                  interface
supabase/schema.sql                        tables + règles de sécurité RLS
supabase/functions/analyze-photo/          Edge Function photo -> avatar (Claude)
tests/                                     tests unitaires et galerie d'avatars
tools/                                     serveur de dev, génération des icônes
```

### Ajouter un objet à la boutique

Dans [`js/avatar/items.js`](js/avatar/items.js), ajouter une entrée dans la liste du bon emplacement (`hats`, `faces`, `pets`…) avec `id`, `name`, `price` et une fonction `render` qui dessine l'objet en SVG dans le repère de l'avatar (tête centrée en 100, 100). Vérifier le rendu dans `tests/gallery.html?s=items`.
