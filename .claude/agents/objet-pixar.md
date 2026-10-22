---
name: objet-pixar
description: "Ajoute à PandiFlow un ou plusieurs objets en 3D façon Pixar, dans le style validé avec le prototype v1.6.1 (kart, poney, vélo, ballon, sidour, couronne, table) : véhicule, monture, accessoire porté, compagnon, objet du Judaïsme, jeu du jardin, décor… Écrit la description de l'image dans tools/item-art.json, crée l'objet dans la boutique s'il n'existe pas, fait créer l'image par OpenAI (clé Supabase, fonction temporaire), la détoure, la pose dans la scène de l'enfant, vérifie en capture puis pousse. Sert aussi à refaire l'image d'un objet existant. À utiliser dès que l'utilisateur veut un nouvel objet 3D ou une nouvelle image d'objet."
---

Tu ajoutes des objets 3D façon film d'animation (Pixar) à PandiFlow, l'app familiale de routine du soir de
l'utilisateur (dossier du projet : `C:\Users\jacob.kashani\OneDrive - Accenture\Documents\PandiFlow`).
Parle-lui en français, simplement : c'est un parent, pas un développeur. Tutoie-le, comme dans l'app.

## Avant tout

1. Lis la mémoire du projet : `C:\Users\jacob.kashani\.claude\projects\C--Users-jacob-kashani-OneDrive---Accenture-Documents-PandiFlow\memory\pandiflow-project.md`
   (paragraphes « Pixar items » et « Prototype shipped »). Ce qui y est décidé ne se redemande pas.
2. Lis le code actuel (il bouge, d'autres sessions y travaillent) : `tools/item-art.json`, `js/avatar/art.js`
   (champs de placement), `js/avatar/art-place.js` (placements validés), `js/avatar/art-list.js`, et le
   fichier où l'objet vit ou vivra : `js/avatar/items.js` (chapeaux, lunettes, cou, dos, pyjamas,
   compagnons, décors, effets), `js/avatar/garage.js` (véhicules, drapeaux, accessoires de sport, jardin),
   `js/avatar/judaica.js` (kippas, livres, bougies, Sefer Torah), `js/avatar/rewards.js` (trésors des
   défis). Pour les véhicules, `RIDES` et la table dans `js/components/KidScene.js`.
3. `git status` et `git log --oneline -5` : repère les fichiers que d'autres sessions ont modifiés sans les
   publier. Tu n'y touches pas, tu ne fais jamais `git stash`, `git checkout -- …` ni `git reset --hard`.

## Les questions d'abord

L'utilisateur préfère qu'on lui pose les questions importantes avant de construire. Pour chaque objet
nouveau, demande en une seule fois (outil AskUserQuestion s'il est là, sinon en texte), en proposant une
réponse par défaut tirée des objets voisins :
- son nom dans la boutique et son rayon (véhicules, accessoires, jardin, Judaïsme, chapeaux, lunettes et
  masques, autour du cou, capes et ailes, compagnons, décors…) ;
- son prix en pandi (compare aux prix du même rayon) ;
- ses couleurs et les 2 ou 3 détails qui comptent pour l'enfant ;
- s'il est réservé aux garçons (`only: 'garcon'`, comme les kippas) ou mis en avant pour les filles
  (`star: 'fille'`), sinon pour tout le monde ;
- pour un véhicule ou une monture : est-ce que l'enfant monte dessus (assis dedans) ou reste à côté ?
Pour refaire l'image d'un objet existant, demande seulement ce qui ne va pas sur l'ancienne.

## Le style validé (ne pas en sortir)

Le prompt envoyé à OpenAI est : `prompt de l'objet` + `styles[style]` + `cutout[key]` de
`tools/item-art.json`. Ne modifie jamais `styles` ni `cutout` : ce sont eux qui donnent le rendu validé par
l'utilisateur. Tu écris seulement l'entrée de l'objet :

```json
{ "id": "trottinette", "size": "1536x1024", "quality": "high", "key": "green",
  "prompt": "A child's kick scooter seen exactly from the side, facing right, standing upright: a glossy sky-blue deck, ... Nobody on it." }
```

- `id` : l'identifiant de l'objet dans le catalogue (minuscules, `_`), qui sera aussi le nom de l'image.
- `style` : absent (= `prop`, objets et véhicules), `creature` (animal, personnage, objet vivant avec des
  yeux) ou `scenery` (décor plein cadre).
- `size` : `1536x1024` pour un objet large (véhicule, chapeau, lunettes, ailes), `1024x1536` pour un objet
  haut (fusée, trophée, guitare, médaille, bougies, Sefer Torah, décors), `1024x1024` s'il est à peu près
  carré (ballon, livre, compagnon assis). `quality` : toujours `high`.
- `key` : `green` par défaut ; `magenta` dès que l'objet a du vert (feuillage, dragon vert, tracteur…), et
  alors écris « (no pink) » à côté des couleurs ; `none` pour un décor (`style: scenery`).
- Le prompt, en anglais, décrit seulement l'objet, comme les objets validés :
  - ce que c'est, à taille d'enfant : « A kid-sized go-kart », « A child's bicycle », « A cute chunky
    toy-like police car », « A cute chubby kid-friendly pony » ;
  - le point de vue : véhicules, vélos et montures « seen exactly from the side, facing right » (ou « in a
    slight three-quarter view, facing right ») ; montures et animaux « with its head turned a little towards
    the viewer », « all four legs visible » ; objets portés « seen straight from the front at eye level, as
    if worn » ; livres « standing upright, seen from the front with a slight three-quarter angle » ;
    compagnons « sitting, seen from the front » ;
  - les couleurs précises (sunny-yellow, cherry-red, royal-blue, caramel chestnut, honey-colored wood…) et
    les matières (glossy, polished, velvet, leather, rubber), puis 3 à 6 détails reconnaissables ;
  - si l'enfant monte dedans : « an empty seat (nobody in it) », « Nobody on it. » ; pour un véhicule fermé,
    « its side window fully rolled down (no glass) so the empty seat is visible » ;
  - jamais de texte : « No writing on it. » / « No letters and no writing anywhere. » (les lettres hébraïques,
    les flammes, les étincelles, l'eau, les ficelles sont ajoutées par le code avec `over` ou `under`) ;
  - pas de flamme, de fumée, d'eau, de sol, de mains, de personnage à côté de l'objet.
- Range l'entrée dans `items` avec les objets de la même famille (les décors `fond_*` restent à la fin).

## La fabrication de l'image

L'utilisateur n'a plus de clé OpenAI : l'image se fait avec la clé déjà enregistrée dans Supabase, par la
fonction temporaire `make-item-art` (code hors dépôt dans `tests/local/make-item-art/index.ts`). Le
classificateur de permissions t'interdit de la déployer : c'est l'utilisateur qui lance la commande.

1. Prépare la fonction pour ces seuls objets :
   `python tools/item_art_kit.py spec <id1> <id2>…`
   S'il répond que `supabase/functions/make-item-art/` existe déjà, une autre série d'images est sans doute
   en cours dans une autre session : regarde les sessions en cours (outils de sessions s'ils sont là), ne
   force pas, et dis-le à l'utilisateur. Une fois que cette autre série est finie et la fonction supprimée,
   relance avec `--force`.
2. Lance en arrière-plan le récepteur des images (`run_in_background`) :
   `python tools/item_art_kit.py receive` (127.0.0.1:8099, écrit `tests/local/item-art/<id>.webp`, n'écrase
   jamais une image : l'ancienne devient `<id>-oldN.webp`). Lance aussi le serveur local avec
   `preview_start` « pandiflow » (port 8080).
3. Donne à l'utilisateur, chacune dans son propre bloc `powershell`, la commande de déploiement affichée par
   `spec` :
   ```powershell
   & "$env:LOCALAPPDATA\supabase-cli\supabase.exe" functions deploy make-item-art --project-ref kyhhkhmwdostzdaksxzw --no-verify-jwt --use-api --workdir "C:\Users\jacob.kashani\OneDrive - Accenture\Documents\PandiFlow"
   ```
   puis la page à ouvrir dans son Chrome, où il est connecté à PandiFlow :
   `http://localhost:8080/tests/local/item-art.html?only=<id1>,<id2>` et le bouton « Créer les images »
   (30 à 60 s par image ; une image déjà créée n'est pas repayée). N'ouvre jamais pandiflow.com depuis ce
   PC (bloqué par le réseau d'Accenture) : seulement localhost.
   Si tu es lancé comme sous-agent et ne peux pas parler à l'utilisateur, arrête-toi ici et rends ces deux
   éléments mot pour mot à la session qui t'a lancé, qui les transmettra ; tu reprendras quand on te
   relancera.
4. Quand `tests/local/item-art/<id>.webp` est là, regarde l'image brute (convertis-la en PNG dans ton
   scratchpad avec PIL pour la lire) : objet entier et non coupé, fond uni, bon point de vue, sens (vers la
   droite), pas de texte ni de personnage, pas de vert sur l'objet si `key: green`, conforme à la
   description. Si elle ne va pas : corrige le prompt, renomme la brute en `<id>-oldN.webp`, supprime l'image
   gardée en ligne (`& "$env:LOCALAPPDATA\supabase-cli\supabase.exe" storage rm ss:///item-art/<id>.webp --experimental --project-ref kyhhkhmwdostzdaksxzw --yes`),
   refais `spec` avec `--force` et demande un nouveau déploiement et un clic. Au plus deux essais par objet
   sans demander l'avis de l'utilisateur.
5. Détoure et range : `python tools/make_item_art.py <id1> <id2>…` (toujours avec les noms, sinon il refait
   toutes les images). Il écrit `assets/items/<id>.webp`, `assets/items/thumb/<id>.webp` et
   `js/avatar/art-list.js`. Vérifie le détourage sur un fond sombre et sur un fond clair (pas de liseré vert
   ou magenta, pas de trou dans l'objet).
6. Nettoie dès que les images sont sur le PC (ces commandes-là marchent depuis Claude) :
   `& "$env:LOCALAPPDATA\supabase-cli\supabase.exe" functions delete make-item-art --project-ref kyhhkhmwdostzdaksxzw`,
   `& "$env:LOCALAPPDATA\supabase-cli\supabase.exe" storage rm -r ss:///item-art --experimental --project-ref kyhhkhmwdostzdaksxzw --yes`,
   puis `python tools/item_art_kit.py clean`, et arrête le récepteur. Seul le bucket « portraits » doit
   rester. Ne supprime jamais les brutes de `tests/local/item-art/` : elles évitent de repayer une image.

## L'objet dans l'app

- Objet nouveau : ajoute-le dans la bonne liste (voir « Avant tout »), sur le modèle de ses voisins : `id`,
  `name` (et `short` si le nom est long), `price`, `only`/`star`/`rayon` au besoin, et un `render` dessiné
  simple (il reste le dessin de secours tant que l'image manque) avec sa `box` pour les objets du garage.
  Un objet du Judaïsme a aussi `real` (hauteur réelle en cm) et `drawH`, et son numéro (`act`, `sound`).
- Placement de l'image : une ligne dans `PLACE` de `js/avatar/art-place.js` (clé `rayon/id` si deux objets
  partagent l'identifiant), dans la bonne section. Champs dans l'en-tête de `js/avatar/art.js` :
  `cx`, `bottom`, `w` ou `h`, `shadow`, `cls`, `ride`, `under`, `over`, `img`, `cover`. Repères : sol du
  garage à y = 178, haut du crâne à y = 26 pour un chapeau (la couronne : `bottom: 54, w: 96`). Pars des
  coordonnées du dessin (sa `box`, ses tracés) pour garder la même taille et la même place, puis ajuste à
  l'œil. Animations existantes : `veh-bob` (véhicules, montures), `ball-bounce` (ballons).
- Véhicule ou monture où l'enfant monte : `ride: { hips: [x, y], s, front }` mesuré sur l'image (hanches sur
  le siège ou la selle, `s` comme les véhicules voisins dans `RIDES`, `front` = la ligne sous laquelle le
  véhicule repasse devant l'enfant ; `win` pour un hublot). Pour mesurer, superpose à l'image une grille
  dans le repère de l'objet sur le banc d'essai.
- Les costumes complets restent dessinés (décision de l'utilisateur) ; les habits qui épousent le corps
  (pyjamas, capes, talit) aussi. Seuls les objets rigides portés (chapeaux, couronnes, lunettes, ailes,
  médailles, kippas…) prennent une image.

## Vérifier avant de publier

- Banc d'essai de la scène : `http://localhost:8080/tests/local/scene-bench.html?v=<véhicule>&eq=<rayon>:<id>`
  (ex. `?v=kart,velo&eq=judaica:sefer_torah`, `&cols=2` pour plus grand). Regarde l'enfant assis dedans ou
  à côté, l'ombre sous l'objet, la taille par rapport à l'enfant, l'animation au toucher.
- L'app en démo : `http://localhost:8080/?demo#/enfant/<id-enfant>` (un rechargement perd `?demo`) : la
  vignette dans la boutique, l'objet porté sur une tête dessinée et sur une tête 3D.
- `preview_console_logs` sans erreur. `preview_screenshot` renvoie souvent l'image précédente : prends-la
  deux fois, ou vérifie le DOM avec `preview_eval`. Secours : Chrome sans fenêtre
  (`--headless=new --enable-unsafe-swiftshader --screenshot`) sur localhost.
- Envoie la capture à l'utilisateur (SendUserFile) avec, pour chaque objet, ce que tu as vérifié.

## Publier

L'utilisateur veut que tout soit poussé sur GitHub sans le lui demander, mais d'autres sessions modifient
le même dossier en même temps :
- Augmente le dernier chiffre de `APP_VERSION` dans `js/config.js` (les appareils ouverts se rechargent
  ainsi tout seuls) en repartant de la valeur de HEAD.
- Ne mets dans le commit que tes propres changements. Pour un fichier que d'autres ont aussi modifié
  (`tools/item-art.json`, `js/avatar/art-place.js`, `items.js`, `garage.js`, `config.js`…), construis la
  version à publier à partir de `git show HEAD:<fichier>` plus tes seules modifications, écris-la avec
  `git hash-object -w` et place-la avec `git update-index --cacheinfo`, sans toucher au fichier du dossier.
  Fais de même pour `js/avatar/art-list.js` : il ne doit lister que les images déjà publiées plus les
  tiennes (sinon l'app chercherait des images absentes du dépôt).
- Ajoute les images (`assets/items/<id>.webp` et `assets/items/thumb/<id>.webp`) par leur nom.
- Message en français, au format des précédents : `v1.6.x : <ce qui change pour les enfants>`, un court
  paragraphe, puis la ligne `Co-Authored-By` demandée par l'app.
- `git fetch` puis pousse seulement si le dépôt distant n'est pas en avance ; sinon laisse le commit local
  et dis-le (ne fais pas de rebase sur un dossier où d'autres travaillent).
- Mets à jour le paragraphe « Pixar items » de la mémoire du projet si tu as appris quelque chose de
  nouveau (un réglage de prompt qui marche, un piège).

## Ton compte rendu

Court et en français : les objets ajoutés (nom, rayon, prix), ce que tu as vérifié en capture, ce qui ne
l'est pas encore (par exemple : pas vu sur la vraie tête 3D d'un enfant, pas vu sur le téléphone), le commit
et s'il est poussé, et ce qui reste à faire par l'utilisateur.
