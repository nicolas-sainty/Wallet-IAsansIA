# Manifeste de Sécurité
# Partie 1 : Introduction et Philosophie

## 1.1 Contexte et Responsabilité
En développant **Epicoin Wallet**, nous avons pleinement conscience que gérer l'argent des étudiants (même sous forme de crédits numériques) impose une responsabilité particulière. 

Les associations étudiantes manipulent souvent des flux financiers importants de manière artisanale, ce qui peut engendrer des risques de pertes ou d'erreurs. Notre objectif est de proposer une solution qui utilise des outils modernes et des standards industriels pour protéger ces échanges, en traitant chaque transaction avec la rigueur nécessaire.

## 1.2 Notre approche : Simplicité et Maîtrise de la Stack
En tant qu'étudiants en informatique, notre stratégie n'est pas de multiplier les gadgets de sécurité complexes, mais de nous reposer sur une maîtrise saine de notre **stack technique** :

* **Utilisation du Vanilla JS :** En limitant l'usage de frameworks trop lourds pour le frontend, nous gardons le contrôle total sur notre code. Cela réduit drastiquement le risque d'importer par erreur des failles de sécurité provenant de bibliothèques tierces mal connues ou non maintenues.
* **Protection des secrets avec le `.env` :** Nous avons intégré la gestion rigoureuse des variables d'environnement. Toutes nos clés privées (Stripe et Supabase) sont isolées dans un fichier `.env` non public. Cela garantit que seuls nos serveurs autorisés peuvent communiquer avec ces services, tout en évitant toute fuite de credentials sur les dépôts distants (GitHub).
* **Externalisation intelligente :** Nous reconnaissons nos limites techniques. C'est pourquoi nous déléguons la partie la plus critique et sensible — le paiement par carte bancaire — à **Stripe**. Notre rôle consiste à sécuriser le "pont" entre l'utilisateur et ces services de confiance.

## 1.3 L'authentification par JWT
Pour garantir qu'un utilisateur ne puisse accéder qu'à ses propres données, nous utilisons le système de **JWT (JSON Web Token)** fourni par Supabase :
1.  **Identification :** Une fois connecté, l'étudiant reçoit un jeton (token) signé numériquement.
2.  **Autorisation :** Ce jeton est envoyé à chaque requête vers notre backend Node.js.
3.  **Vérification :** Le serveur vérifie la validité et la signature du jeton avant d'autoriser la moindre action (consulter un solde, effectuer un virement ou s'inscrire à un événement).

## 1.4 Modèle de Menaces (Threat Modeling)
Nous avons identifié les menaces spécifiques à notre environnement scolaire pour y répondre point par point par des mesures techniques :

| Menace | Description | Solution Epicoin |
| :--- | :--- | :--- |
| **Usurpation d'identité** | Vol de compte pour utiliser les crédits d'un autre étudiant. | Authentification robuste via Supabase et gestion de session par JWT. |
| **Injection de soldes** | Tentative de modifier artificiellement son solde via des requêtes API frauduleuses. | Vérification systématique côté serveur et Row Level Security (RLS) sur la base de données. |
| **Interception de données** | Capture d'informations sensibles sur le réseau public de l'école. | Utilisation systématique du protocole

# Partie 2 : Détection de Fraude et KYC

## 2.1 Le "KYC Étudiant" (Vérification d'Identité)
Dans le secteur bancaire, le *Know Your Customer* (KYC) impose la vérification d'une pièce d'identité officielle. Pour **Epicoin Wallet**, nous adaptons cette exigence à notre environnement universitaire :

* **Filtrage par domaine mail :** L'inscription sur la plateforme est restreinte aux adresses e-mail institutionnelles de l'école. Cette mesure garantit que chaque compte utilisateur correspond à une identité réelle et vérifiable dans l'annuaire de l'établissement.
* **Validation des accès sensibles :** Les droits d'administrateur (accès au Dashboard BDE, scan des participants) ne sont pas ouverts par défaut. Ils font l'objet d'une activation manuelle après vérification physique de l'identité de l'étudiant responsable.

## 2.2 Prévention de la Fraude
Nous avons implémenté des barrières logiques et des algorithmes de détection pour garantir l'intégrité des fonds et prévenir les comportements malveillants :

* **Vérification de la signature des Webhooks (Stripe) :** C'est un point critique. Pour éviter qu'un utilisateur ne simule une confirmation de paiement via un outil comme Postman, notre backend Node.js vérifie systématiquement la signature cryptographique envoyée par Stripe. Sans signature valide, l'ajout de crédits est rejeté.
* **Contrôle du solde "Côté Serveur" :** Aucun calcul de solde n'est confié au frontend (Vanilla JS). Toutes les opérations de débit/crédit sont calculées par le serveur et protégées par des contraintes SQL : une transaction est annulée si elle entraîne un **solde négatif (anomalie de solde)**.
* **Plafonds et "Velocity Checks" :** * **Plafond absolu :** Blocage de tout transfert supérieur à 10 000 EPIC par jour pour limiter l'impact d'une compromission de compte.
    * **Contrôle de fréquence :** Détection de trop nombreuses transactions en un temps réduit pour contrer les scripts automatisés.
* **Surveillance des schémas suspects :**
    * **Transferts en boucle :** Blocage des cycles A→B→A en moins d'une heure pour éviter le brassage de monnaie.
    * **Fragmentation (Structuring) :** Surveillance de l'accumulation de nombreux petits transferts vers un même destinataire (technique classique pour contourner les seuils de vigilance).
    * **Auto-transfert :** Interdiction stricte d'envoyer des fonds à son propre compte (émetteur = destinataire).
    * **Transactions rondes anormales :** Alerte sur les montants "trop parfaits" qui peuvent indiquer des tests de fraude ou des échanges suspects.

## 2.3 Chiffrement et Protection des Données Sensibles
* **Zéro stockage bancaire :** En déléguant le paiement à Stripe, nous appliquons le principe de précaution maximale : **aucune donnée de carte bancaire** ne transite ni n'est stockée sur nos serveurs.
* **Données au repos :** Les informations stockées dans notre base Supabase (historique des transactions, profils) sont protégées par un chiffrement AES-256 natif.
* **Données en transit :** L'ensemble des échanges entre l'application et nos serveurs est protégé par le protocole **HTTPS** de notre hébergeur Vercel, rendant les données illisibles en cas d'interception sur le réseau Wi-Fi de l'école.

# Partie 3 : Stratégie de Tests et Validation (Prévus)

Pour valider la robustesse de **Epicoin Wallet**, nous avons défini un protocole de tests pragmatiques que nous prévoyons d'exécuter avant toute mise en production réelle. Cette approche nous permettra de vérifier que nos barrières de sécurité fonctionnent comme prévu.

## 3.1 Tests de logique métier et "Cas limites"
Nous avons identifié des scénarios critiques que nous comptons tester manuellement pour éprouver notre architecture :
* **Validation du solde négatif :** Nous prévoyons de tenter des transactions (achats ou virements) d'un montant supérieur au solde disponible. L'objectif est de confirmer que le backend Node.js bloque systématiquement l'opération.
* **Résistance à la modification Frontend :** Nous testerons la réaction du système face à une modification visuelle du solde via la console du navigateur (F12). Ce test doit prouver que le serveur ignore les données côté client et se base uniquement sur la source de vérité (Supabase).

## 3.2 Maintenance et Santé du Code
La sécurité étant un processus continu, nous avons intégré les étapes suivantes dans notre flux de travail :
* **Audit automatisé des dépendances :** L'utilisation de la commande `npm audit` est prévue de manière régulière. Cela nous permettra de détecter si les bibliothèques que nous utilisons (Express, Stripe SDK, etc.) présentent des vulnérabilités connues afin de les mettre à jour immédiatement.
* **Nettoyage pré-déploiement :** Une phase de revue de code est prévue pour s'assurer qu'aucune donnée sensible (clés de test, commentaires techniques, liens vers des bases privées) ne subsiste dans le code source public.

## 3.3 Simulation d'échecs et Robustesse
Le système doit être capable de gérer les erreurs sans compromettre l'intégrité des comptes :
* **Tests de paiement Stripe :** En utilisant le mode test et les cartes de simulation Stripe, nous prévoyons de tester des scénarios d'échec (paiement refusé, erreur réseau). Le but est de vérifier que le compte de l'étudiant ne subit aucune modification tant que la confirmation de paiement n'est pas 100% valide.
* **Intégrité des Webhooks :** Nous simulerons l'envoi de données corrompues vers notre API pour confirmer que notre système de vérification de signature rejette bien les requêtes suspectes.