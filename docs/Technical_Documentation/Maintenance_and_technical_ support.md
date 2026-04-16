# Plan de Maintenance et Support

## 1.1 Stratégie de Maintenance
Pour garantir la pérennité d'Epicoin, nous allons mettre en place un cycle de maintenance divisé en trois axes prioritaires :

* **Maintenance Corrective (Bugs) :** Traitement des tickets techniques remontés par les utilisateurs (erreurs d'affichage, problèmes de connexion). Nous utilisons les logs de Vercel pour identifier l'origine des crashs en temps réel.
* **Maintenance Préventive (Sécurité) :** Utilisation de **Dependabot** sur GitHub pour surveiller les vulnérabilités des bibliothèques Node.js. Les mises à jour de sécurité sont testées en environnement de "Staging" (pré-production) avant d'être déployées pour éviter toute régression.
* **Maintenance Évolutive :** Analyse des retours du BDE pour ajouter des fonctionnalités mineures (ex: export de comptabilité en CSV) sans compromettre la structure existante.

## 1.2 Documentation Technique et Transmission
Un projet étudiant doit pouvoir être repris par une nouvelle équipe. Nous allons donc documenté l'intégralité du système :

* **Documentation du Code :** Le README du projet détaille la procédure d'installation locale (`npm install`, configuration des variables d'environnement) pour permettre un déploiement rapide par un tiers.
* **Schéma de Données :** Une documentation des tables Supabase explique les relations entre les profils étudiants, les transactions et les webhooks Stripe pour éviter toute corruption de données lors d'une modification future.
* **Guide API :** Liste des points d'entrée (endpoints) du backend Node.js avec les formats de données attendus pour faciliter le développement de nouvelles interfaces (ex: une application mobile native).

## 1.3 Organisation du Support (SLA)
Nous avons défini une structure de support à trois niveaux pour filtrer les demandes et garantir une réactivité optimale :

| Niveau | Responsable | Type d'intervention |
| :--- | :--- | :--- |
| **Niveau 1** | Bureau des Étudiants (BDE) | Support fonctionnel : aide à l'utilisation, problèmes de compte, perte de mot de passe, questions sur les tarifs. |
| **Niveau 2** | Équipe Technique (Nous) | Support technique : résolution de bugs bloquants, échecs de paiement Stripe, erreurs de calcul de solde. |
| **Niveau 3** | Fournisseurs (Cloud/Paiement) | Incidents externes : panne globale de Stripe, Supabase ou Vercel. Communication de crise auprès des étudiants. |

**Engagement de service (SLA) :** Pour la phase Alpha, nous nous engageons sur un temps de réponse de **24h à 48h ouvrées** pour les tickets de Niveau 2. Les interventions majeures sur la base de données seront planifiées durant les heures creuses (nuit ou week-end) pour minimiser l'impact sur les ventes du BDE.