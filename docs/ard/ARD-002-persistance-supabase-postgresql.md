# ARD-002 - Centraliser la persistance sur Supabase/PostgreSQL et deleguer l'atomicite au SQL

## Statut

Adopte.

## Date

2026-03-27

## Contexte

Le projet gere des donnees sensibles et fortement relationnelles :

- utilisateurs
- groupes / BDE
- wallets
- transactions
- evenements
- demandes de paiement
- traces d'audit

Ces donnees ne peuvent pas etre gerees comme de simples documents independants.
Les operations critiques, notamment les debits / credits, demandent en plus de l'atomicite et de l'idempotence.

Le code montre que le client JS Supabase est utilise partout dans l'application, mais aussi que ses limites sont connues :

- `src/config/database.js` indique que les transactions ne doivent pas etre gerees par le client JS
- `database/schema.sql` contient plusieurs fonctions RPC pour securiser les traitements critiques

## Decision

Le projet choisit Supabase/PostgreSQL comme source de verite principale et reserve a PostgreSQL le traitement atomique des operations financieres critiques.

Ce choix se traduit par :

- un schema relationnel riche dans `database/schema.sql`
- des repositories Supabase cote application
- des vues, triggers et fonctions SQL pour les traitements sensibles
- des RPC dediees pour les flux qui ne doivent pas etre executes deux fois ou de maniere partielle

## Justification

### Pourquoi PostgreSQL / Supabase ?

- Le modele de donnees est relationnel par nature.
- Les contraintes SQL sont utiles pour proteger l'integrite des donnees.
- Supabase apporte un acces simple au Postgres distant sans construire toute l'infra soi-meme.
- Le projet beneficie d'un bon compromis entre productivite et robustesse.

### Pourquoi des RPC SQL pour les flux critiques ?

- Le client JS Supabase ne fournit pas de transaction multi-etapes equivalente a une transaction SQL classique.
- Les debits / credits doivent etre executes en bloc.
- Le paiement Stripe doit etre idempotent : une session ne doit pas crediter deux fois le wallet.
- Les demandes de paiement doivent rester coherentes meme en cas d'erreur intermediaire.

## Consequences positives

- Le schema relationnel protege mieux la coherence metier.
- Les contraintes SQL limitent les etats invalides.
- Les vues et triggers apportent audit, historisation et calculs utiles.
- Les RPC rendent les flux financiers plus fiables qu'une simple logique applicative cote Node.

## Consequences negatives

- Une partie de la logique metier critique se deplace dans la base, donc hors du code JavaScript standard.
- Le projet devient plus dependant de PostgreSQL et de Supabase.
- Les developpeurs doivent maintenir a la fois du JS et du SQL.
- Le debug peut etre plus complexe si la logique est repartie entre API et base.

## Alternatives ecartees

### NoSQL / document store

Alternative peu adaptee au besoin transactionnel et aux contraintes d'integrite.
Le projet a besoin de relations, de contraintes et de requetes structurantes.

### Gestion complete des transactions dans Node.js

Alternative insuffisante avec le client JS Supabase seul.
Elle exposerait le projet a des courses critiques et a des mises a jour partielles.

### Driver SQL brut uniquement

Alternative possible, mais moins productive dans un projet de cours.
Supabase fournit une couche pratique tout en laissant PostgreSQL faire le travail critique.

## Traces dans le depot

- `src/config/database.js` : client Supabase et avertissement explicite sur les transactions
- `database/schema.sql` : schema relationnel, vues, triggers et fonctions RPC
- `src/infrastructure/adapters/outbound/repositories/SupabaseWalletRepository.js`
- `src/infrastructure/adapters/outbound/repositories/SupabaseTransactionRepository.js`
- `src/services/transaction.service.js` : usage de `rpc_process_transaction_atomic` et `rpc_respond_payment_request_atomic`
- `src/routes/payment.routes.js` et `src/routes/webhooks.routes.js` : usage de `rpc_fulfill_stripe_checkout_atomic`

## Conclusion

Le choix de persistance est un point fort du projet.
Il ne se contente pas d'utiliser Supabase comme une simple base distante : il s'appuie sur PostgreSQL pour porter l'integrite, l'audit et l'atomicite la ou c'est le plus pertinent.

