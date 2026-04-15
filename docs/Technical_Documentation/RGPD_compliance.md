# Conformité RGPD et Gouvernance des Données

En tant qu'étudiants en informatique, nous avons intégré les enjeux de protection des données personnelles dès la phase de conception d'**Epicoin Wallet**. Notre démarche vise à respecter l'esprit du Règlement Général sur la Protection des Données (RGPD) de manière pragmatique et responsable.

## 1.1 Principes Fondamentaux appliqués
Conformément à l'**Article 5 du RGPD**, nous avons structuré notre projet autour de trois piliers majeurs :

* **Minimisation des données :** Nous ne collectons que les informations strictement nécessaires au fonctionnement du service (Nom, Prénom, Email institutionnel, Historique des transactions). Aucune donnée superflue ou sensible n'est demandée.
* **Limitation des finalités :** Les données sont traitées exclusivement pour la gestion du portefeuille numérique et l'organisation des événements du BDE. Elles ne font l'objet d'aucune exploitation commerciale ou revente.
* **Transparence :** Nous avons pour objectif de fournir une information claire aux utilisateurs sur l'usage de leurs données dès la création de leur compte.

## 1.2 Gouvernance et Stockage
Notre choix de stack technique a été guidé par une volonté de simplification et de mise en conformité :
* **Hébergement Européen :** Nous avons configuré notre instance **Supabase** pour que l'intégralité des données soit stockée sur des serveurs situés en Europe, garantissant un niveau de protection conforme aux standards européens.
* **Responsabilité du traitement :** Le Bureau des Étudiants (BDE) est désigné comme responsable de traitement. L'accès aux données via le Dashboard d'administration est restreint et réservé aux membres autorisés pour l'exercice de leurs fonctions.

## 1.3 Gestion des Biais et Intégrité
La gouvernance des données ne se limite pas au juridique ; elle concerne aussi l'équité du système :
* **Équité d'accès :** Le système repose sur des règles de code automatiques et transparentes (Smart Contracts simulés ou logique backend stricte). Cela évite tout biais humain ou traitement discriminatoire dans la gestion des crédits.
* **Intégrité et Auditabilité :** Pour prévenir toute erreur d'attribution, chaque transaction est enregistrée avec un identifiant unique (UUID) et un horodatage immuable. Cela rend les données fiables et facilement auditables en cas de litige.

## 1.4 Droits des Utilisateurs (Prévus)
Bien que le projet soit en phase de développement, nous avons prévu les mécanismes permettant de respecter les droits des étudiants (Articles 15 à 21 du RGPD) :
* **Droit d'accès et de rectification :** Chaque utilisateur peut consulter son historique complet et ses informations de profil directement depuis son interface.
* **Droit à l'effacement (Droit à l'oubli) :** Une procédure est prévue pour permettre la suppression définitive des données personnelles d'un utilisateur lors de son départ de l'école ou de la clôture de son compte.