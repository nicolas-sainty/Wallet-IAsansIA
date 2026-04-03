# ARD-003 - Construire un frontend statique en Vanilla JS avec un design system leger et mobile-first

## Statut

Adopte.

## Date

2026-03-27

## Contexte

Le projet doit proposer rapidement une interface demonstrable pour plusieurs profils :

- etudiants
- BDE / administrateurs

Il faut aussi couvrir plusieurs usages visibles dans le depot :

- consultation du wallet
- historique des transactions
- achat de credits
- inscription aux evenements
- vues d'administration

Le dossier `public/` montre un choix clair :

- pages HTML statiques
- CSS partage via `public/css/*`
- logique interactive en JavaScript natif via `public/js/*`

## Decision

Le projet adopte un frontend sans framework SPA, base sur HTML, CSS et Vanilla JS, avec un design system leger centre sur :

- des variables CSS
- une palette bleu / orange / creme
- une typographie unique (`Outfit`)
- des composants visuels recurrentes de type glassmorphism
- une priorite forte donnee au mobile

## Justification

### Pourquoi du frontend statique ?

- Pas de chaine de build a mettre en place.
- Demarrage tres rapide pour une equipe etudiante.
- Deploiement simple avec Express et `express.static`.
- Cout cognitif faible pour des pages de demonstration.

### Pourquoi un design system leger ?

- Le projet doit garder une identite visuelle commune sans introduire une librairie lourde.
- Les variables CSS permettent de partager les couleurs, rayons, gradients et effets.
- Les composants reutilises (`glass-panel`, `bottom-nav`, `btn-primary`, etc.) donnent une coherence rapide a l'ensemble.

### Pourquoi mobile-first ?

- L'usage wallet / paiement / carte se prete bien au smartphone.
- La page d'accueil prend la forme d'une carte numerique avec navigation basse.
- Le parcours utilisateur principal est pense comme une mini-app mobile.

## Consequences positives

- Le front est leger et rapide a charger.
- L'application est simple a heberger puisqu'elle est servie directement par le backend.
- La direction visuelle est lisible et coherente a travers les pages.
- Le temps de mise en oeuvre est optimise pour un projet de cours.

## Consequences negatives

- L'absence de composants ou de framework rend la maintenance plus difficile a mesure que le JS grossit.
- Certaines vues utilisent beaucoup de HTML injecte ou de styles inline.
- La reutilisation est plus artisanale qu'avec une vraie librairie de composants.
- Le design system existe, mais reste implicite ; il n'est pas documente comme une bibliotheque UI formelle.

## Alternatives ecartees

### React / Vue / Angular

Alternatives plus industrielles, mais plus couteuses a mettre en place.
Pour le niveau de complexite du projet et le contexte de cours, le gain n'etait pas obligatoire.

### UI kit complet ou design system externe

Alternative plus robuste pour une app produit a long terme, mais inutilement lourde ici.
Le projet privilegie la vitesse, la personnalisation et le controle direct du rendu.

### Interface purement desktop

Alternative peu adaptee a l'image d'un wallet etudiant.
Le mobile-first renforce la coherence d'usage.

## Traces dans le depot

- `public/index.html` : interface mobile de type carte / wallet
- `public/wallets.html`, `public/events.html`, `public/profile.html`, `public/admin*.html`
- `public/css/index.css` : variables globales, palette, composants, gradients
- `public/css/mobile.css` : navigation basse et ergonomie mobile
- `public/css/mobile-nav.css` : ajustements mobiles additionnels
- `public/js/app.js` : orchestration des appels API et rendu dynamique
- `src/api/server.js` : exposition des assets statiques via `express.static('public')`

## Conclusion

Le choix frontend est volontairement simple et tres defendable :
il privilegie la rapidite, la demonstrabilite et la coherence visuelle.
Dans un contexte de cours, c'est un choix rationnel.
Dans un contexte produit long terme, il faudrait ensuite formaliser davantage les composants et reduire la duplication d'interface.

