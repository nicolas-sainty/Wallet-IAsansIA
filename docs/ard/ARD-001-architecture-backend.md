# ARD-001 - Adopter un monolithe modulaire avec migration vers une architecture hexagonale

## Statut

Adopte, avec migration en cours.

## Date

2026-03-27

## Contexte

Le projet doit livrer rapidement une application de wallet etudiant tout en gardant une base assez propre pour evoluer.
Le depot montre deux couches qui coexistent :

- une structure historique autour de `src/routes`, `src/services` et `src/middleware`
- une structure plus recente autour de `src/core` et `src/infrastructure`

Cette coexistence apparait clairement dans `src/api/server.js`, qui expose a la fois :

- des routes historiques sur `/api/...`
- des routes plus recentes sur `/api/v2/...`

Le besoin architectural est donc double :

- conserver un produit executable sans casser les flux existants
- preparer une separation plus nette entre logique metier et details techniques

## Decision

Le projet adopte un monolithe modulaire base sur Node.js + Express, et fait evoluer ce monolithe vers une architecture hexagonale.

Concretement :

- Express reste le point d'entree unique
- les cas d'usage metier sont places dans `src/core/application/use-cases`
- les entites metier sont placees dans `src/core/domain/entities`
- les dependances techniques sont encapsulees dans `src/infrastructure/adapters`
- le cablage des dependances est gere manuellement dans `src/infrastructure/di.js`

## Justification

### Pourquoi un monolithe modulaire ?

- Le projet reste simple a lancer, a comprendre et a deployer.
- L'equipe evite la complexite organisationnelle et technique des microservices.
- Les fonctionnalites sont fortement couplees entre elles : auth, wallet, transactions, groupes, evenements et paiements.
- Pour un projet de cours, ce choix maximise la vitesse de livraison.

### Pourquoi viser une architecture hexagonale ?

- La logique metier devient moins dependante d'Express, de Supabase ou de Stripe.
- Les cas d'usage sont plus faciles a tester de maniere isolee.
- Le remplacement d'un adaptateur est plus simple que dans une architecture purement centree framework.
- La structure du code devient plus lisible pour distinguer le metier, l'infrastructure et les interfaces d'entree.

## Consequences positives

- Le serveur garde un point d'entree unique et reste facile a deployer.
- La structure `core / infrastructure` prepare une meilleure maintenabilite.
- L'injection de dependances manuelle dans `src/infrastructure/di.js` rend les dependances explicites.
- La version `v2` permet de migrer progressivement sans interrompre les flux existants.

## Consequences negatives

- La coexistence entre `v1` et `v2` cree de la duplication fonctionnelle.
- Une partie de la logique reste encore dans les services historiques.
- La dette technique augmente tant que la migration n'est pas terminee.
- Le projet reste un monolithe : si la charge ou l'organisation produit explose, il faudra peut-etre redecouper plus tard.

## Alternatives ecartees

### Microservices

Alternative rejetee car disproportionnee pour la taille du projet.
Elle aurait ajoute du cout de deploiement, de supervision et de communication inter-services.

### MVC classique unique

Alternative simple, mais moins interessante pour isoler la logique metier.
Elle aurait laisse le coeur du projet trop proche d'Express et de Supabase.

### Big refactor en une seule fois

Alternative plus "propre" sur le papier, mais plus risquee.
Le choix de migration progressive est plus realiste et moins dangereux.

## Traces dans le depot

- `src/api/server.js` : coexistence des routes historiques et des routes `/api/v2`
- `src/infrastructure/di.js` : bootstrap et injection de dependances
- `src/core/application/use-cases/*` : cas d'usage metier
- `src/core/domain/entities/*` : entites metier
- `src/infrastructure/adapters/*` : repositories, controllers et services externes
- `src/services/*` : couche historique encore active

## Conclusion

Le choix architectural principal est pertinent : le projet reste pragmatique, executable et adaptee a un contexte de cours, tout en montrant une vraie intention de conception logicielle.
Le point a assumer dans le rapport est que l'architecture hexagonale est une cible deja engagee, mais pas encore totalement generalisee a tout le code.

