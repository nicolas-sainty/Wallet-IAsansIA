# Roadmap Produit : Stratégie de Déploiement

## Phase 1 : Alpha – Validation du MVP (T1 - Actuel)
**Objectif :** Établir une preuve de concept technique et fonctionnelle sur un périmètre restreint.
* **Core Features :** Finalisation du module de paiement par QR Code et intégration du rechargement via l'API Stripe.
* **Infrastructure :** Déploiement sur Vercel et structuration de la base de données transactionnelle sur Supabase.
* **Test Terrain :** Lancement pilote avec un BDE partenaire unique pour identifier les frictions utilisateurs.
* **Sécurité :** Mise en place des Webhooks pour la validation automatique des flux financiers.

## Phase 2 : Bêta – Expansion & Professionnalisation (T2)
**Objectif :** Transformer l'outil en une plateforme multi-campus robuste.
* **Multi-tenancy :** Adaptation de l'architecture pour isoler les données de plusieurs BDE sur une instance unique.
* **Dashboard Admin :** Création d'une interface de gestion pour les associations (suivi des stocks, historique des ventes, statistiques).
* **Support & Maintenance :** Activation du plan de support à 3 niveaux (BDE / Équipe Tech / Fournisseurs).
* **Optimisation :** Passage aux instances payantes (Scaling vertical) pour garantir la performance lors des pics d'affluence.

## Phase 3 : Échelle – Écosystème Global (T3 - T4)
**Objectif :** Devenir la solution de référence pour l'ensemble de la vie étudiante nationale.
* **Application Native :** Développement d'une version mobile (PWA avancée ou React Native) avec notifications push de solde.
* **Module Billetterie :** Intégration d'un système d'achat et de contrôle de billets pour les événements étudiants (Soirées, Galas).
* **Réseau de Partenaires :** Ouverture du moyen de paiement aux commerces de proximité (Food-trucks, cafétérias universitaires).
* **Data Intelligence :** Rapports analytiques prédictifs pour aider les BDE à optimiser leur trésorerie et leurs achats.