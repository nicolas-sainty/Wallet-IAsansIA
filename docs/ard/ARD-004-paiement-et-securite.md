# ARD-004 - Confier le paiement a Stripe et proteger l'API avec une base de securite solide

## Statut

Adopte.

## Date

2026-03-27

## Contexte

Le projet manipule des comptes, des wallets et des flux financiers.
Il doit donc repondre a deux exigences :

- ne pas reinventer un systeme de paiement bancaire
- proteger correctement les routes et les traitements sensibles

Le depot montre un choix net :

- Stripe est utilise pour les achats de credits
- l'API applique des middleware de securite au niveau Express
- l'authentification repose sur JWT
- les paiements sont verifies cote serveur, puis executes dans la base de maniere idempotente

## Decision

Le projet externalise le paiement en ligne a Stripe, tout en gardant le controle metier sur le backend.
En parallele, il met en place une securisation applicative reposant sur :

- JWT pour les appels proteges
- separation access token / refresh token dans la v2
- middleware `helmet`, `cors`, `compression` et `express-rate-limit`
- logs structures avec redaction partielle des donnees personnelles
- verification serveur des paiements avant credit effectif

## Justification

### Pourquoi Stripe ?

- Stripe est un standard reconnu pour les paiements en ligne.
- Le projet evite de gerer lui-meme la carte bancaire et la conformite associee.
- La creation de session Checkout et les webhooks couvrent bien le besoin du wallet.

### Pourquoi verifier et finaliser cote backend ?

- Le frontend ne doit jamais etre la source de verite d'un paiement.
- La verification de session et les webhooks permettent de confirmer le statut reel du paiement.
- La logique metier de credit doit rester serveur, avec idempotence.

### Pourquoi une securite middleware "defense de base" ?

- L'API expose des donnees et des actions sensibles.
- `helmet` durcit les en-tetes HTTP.
- `cors` maitrise les origines autorisees.
- le rate limiting reduit le risque d'abus.
- le logger limite une partie de l'exposition des emails.

## Consequences positives

- Le projet s'appuie sur un prestataire de paiement fiable.
- Les flux de paiement sont plus surs grace aux verifications serveur et aux RPC SQL.
- L'API dispose d'une base de securite credible pour un projet de cours avance.
- Le modele access token + refresh token prepare une meilleure gestion de session.

## Consequences negatives

- Le projet depend d'un service externe et de ses cles de configuration.
- Les tests end-to-end de paiement sont plus complexes.
- La coexistence entre routes historiques et routes `v2` demande une harmonisation continue.
- La strategie de refresh token doit rester parfaitement alignee avec le middleware HTTP et la configuration serveur.

## Alternatives ecartees

### Simuler integralement le paiement sans prestataire reel

Alternative plus simple, mais moins credible pour un wallet.
Le choix Stripe rend la demonstration beaucoup plus realiste.

### Gerer le paiement "maison"

Alternative a proscrire : trop risquee et hors perimetre pour une equipe etudiante.

### Securite minimale sans middleware dedies

Alternative plus rapide, mais trop fragile pour une application qui touche aux soldes et aux paiements.

## Traces dans le depot

- `src/services/stripe.service.js` : creation des sessions Stripe
- `src/routes/payment.routes.js` : verification de session et fulfillment
- `src/routes/webhooks.routes.js` : webhook Stripe
- `src/infrastructure/adapters/outbound/external-services/StripePaymentProcessor.js`
- `src/core/application/use-cases/CreateCheckoutSession.js`
- `src/api/server.js` : `helmet`, `cors`, `compression`, rate limiting, logs et healthcheck
- `src/config/logger.js` : logs JSON et redaction PII
- `src/config/jwt.js` et `src/middleware/auth.middleware.js` : gestion JWT
- `public/payment/success.html` : retour utilisateur apres paiement

## Conclusion

Le projet fait ici un choix mature :
deleguer le paiement a un acteur specialise, tout en gardant la verification et l'ecriture metier sous controle backend.
Pour un wallet, c'est le bon niveau de responsabilite technique et securitaire.
