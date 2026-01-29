# 🎓 Guide de Préparation à l'Audit Technique

Ce document résume les points clés pour défendre vos choix techniques et répondre aux questions de sécurité lors de votre soutenance.

---

## 1. Justification des Choix d'Architecture

### Pourquoi Node.js & Express ?
*   **Argument** : "Pourquoi ne pas avoir utilisé PHP/Symfony ou Python ?"
*   **Réponse** :
    *   **I/O Non-bloquant** : Node.js est conçu pour gérer de nombreuses requêtes simultanées légères (API), ce qui est idéal pour un système de wallet/transaction.
    *   **Fullstack JS** : Unification du langage (JS) entre le Front et le Back, simplifiant le développement et la maintenance.
    *   **Écosystème** : Express est un standard robuste, minimaliste et très performant.

### Pourquoi Supabase (PostgreSQL) ?
*   **Argument** : "Pourquoi une solution gérée au lieu d'un MySQL local ?"
*   **Réponse** :
    *   **Intégrité des Données** : PostgreSQL est le SGBD open-source le plus fiable pour les données transactionnelles (ACID compliance), crucial pour une appli financière.
    *   **Sécurité** : Supabase offre une couche d'abstraction sécurisée et gère les sauvegardes.
    *   **Fonctionnalités avancées** : Support natif du JSONB (futur-proof) et Row Level Security (RLS) si besoin de migrer la logique vers la DB.

### Pourquoi Vanilla JS (Frontend) ?
*   **Argument** : "Pourquoi ne pas avoir utilisé React, Vue ou Angular ?"
*   **Réponse** :
    *   **Performance Pure** : Aucun "overhead" de framework, temps de chargement instantané, bundle size minimal.
    *   **Pédagogie & Maîtrise** : Démontre une compréhension profonde du DOM et des événements navigateur sans s'appuyer sur la "magie" d'un framework.
    *   **Simplicité** : Pour un dashboard administratif et utilisateur, un framework SPA complexe aurait ajouté une complexité de build inutile.

---

## 2. Sécurité : Questions & Réponses (Q&A)

### "Comment gérez-vous les mots de passe ?"
> **Réponse** : "Je ne stocke **jamais** les mots de passe en clair. J'utilise **bcrypt** avec un salt (10 rounds) pour hasher les mots de passe avant l'insertion en base via `auth.service.js`."

### "Votre application est-elle vulnérable aux injections SQL ?"
> **Réponse** : "Non. J'utilise le client **Supabase/PostgREST** qui utilise des requêtes paramétrées sous le capot. Les entrées utilisateur ne sont jamais concaténées directement dans les chaînes SQL."

### "Comment sécurisez-vous les sessions ?"
> **Réponse** : "J'utilise des **JWT (JSON Web Tokens)**. C'est stateless (pas de stockage serveur de session), ce qui rend l'API scalable. Le token est signé avec une clé secrète serveur et expire après 24h."

### "Stockez-vous les numéros de carte bancaire ?"
> **Réponse** : "Absolument pas (ce serait illégal sans certification PCI-DSS). J'utilise **Stripe Checkout**. L'utilisateur saisit ses infos sur une page sécurisée hébergée par Stripe. Je ne reçois qu'un token de confirmation sécurisé."

### "Un utilisateur peut-il modifier le solde d'un autre ?"
> **Réponse** : "Non. Chaque endpoint critique (`/transfer`) vérifie côté serveur (Backend) que l'utilisateur authentifié (via le JWT) est bien le propriétaire du wallet source."

---

## 3. Points Forts Techniques à Mettre en Avant

1.  **Gestion "Revenue Share" Automatisée** : Expliquez comment un achat étudiant déclenche *simultanément* un crédit en tokens pour l'étudiant et un virement en Euros pour le BDE, le tout validé par Stripe.
2.  **Résilience** : Le système "auto-répare" les comptes mal configurés (création de wallet à la volée si manquant lors d'un paiement).
3.  **Atomicité** : Les transactions (débit/crédit) sont conçues pour ne jamais laisser le système dans un état incohérent (l'argent ne disparaît pas).

---
*Bonne chance pour la soutenance !* 🚀
