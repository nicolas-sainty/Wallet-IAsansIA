# ARD - Dossier de decisions d'architecture

Date d'analyse : 2026-03-27

Ce dossier a ete redige a partir d'une lecture du depot `Wallet-IAsansIA`.
Le terme standard est souvent `ADR` (Architecture Decision Record), mais je garde ici `ARD` pour coller a la consigne du cours.

## Objectif

Tracer, expliquer et justifier les principaux choix :

- d'architecture backend
- de stack technique
- de persistance des donnees
- de frontend et de design system
- de paiement et de securite

## Perimetre analyse

Les decisions ci-dessous s'appuient notamment sur :

- `src/api/server.js`
- `src/services/*`
- `src/core/*`
- `src/infrastructure/*`
- `database/schema.sql`
- `public/*`
- `tests/unit/wallet.service.test.js`
- `README.md`
- `TECHNICAL.md`

## Vue d'ensemble

| ID | Sujet | Statut | Idee principale |
|---|---|---|---|
| ARD-001 | Architecture backend | Adopte, migration en cours | Monolithe modulaire Node/Express avec transition vers une architecture hexagonale |
| ARD-002 | Persistance | Adopte | Supabase/PostgreSQL comme source de verite, avec logique critique deleguee a des fonctions SQL/RPC |
| ARD-003 | Frontend et design system | Adopte | Frontend statique en HTML/CSS/Vanilla JS, mobile-first, avec design system leger base sur variables CSS |
| ARD-004 | Paiement et securite | Adopte | Stripe pour le paiement, JWT et middleware Express pour proteger les flux sensibles |

## Lecture conseillee

1. Lire ce `README.md` pour la synthese.
2. Lire ensuite les ARD 001 a 004.
3. Reprendre la conclusion de chaque fichier pour alimenter le rendu final du cours.

## Synthese transversale

Le projet fait le choix d'un compromis tres coherent pour un contexte etudiant :
un backend simple a deployer, mais deja structure pour evoluer vers une architecture plus propre.

La decision la plus importante est la coexistence de deux niveaux de maturite :

- un socle historique base sur `src/routes` et `src/services`
- une cible plus robuste basee sur `src/core` et `src/infrastructure`

Ce n'est pas une contradiction. C'est une strategie de transition :
le projet continue a fonctionner pendant que la logique metier est progressivement decouplee des details techniques.

## Points de vigilance a mentionner dans le rendu

- La coexistence `v1` / `v2` reduit le risque de refonte brutale, mais cree de la duplication.
- Les transactions financieres ne doivent pas reposer uniquement sur le client JS Supabase ; le projet a donc correctement deplace l'atomicite vers PostgreSQL via RPC.
- Le frontend est rapide a produire et a deployer, mais devient plus difficile a maintenir quand le nombre de pages et de comportements augmente.
- La securite applicative est prise en compte, mais l'harmonisation finale entre anciennes routes et nouvelle architecture reste une etape de stabilisation importante.

## Proposition d'usage dans le rapport

Si un seul document est attendu, ce dossier peut servir de base de travail :

- le `README.md` fournit la synthese generale
- chaque ARD detaille une decision precise avec contexte, justification, alternatives et consequences

