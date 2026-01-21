# Epicoin Exchange System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

> Système d'échange d'Epicoins entre groupes et communautés - Simple, transparent, équitable

## 🎯 Vision du Projet

Epicoin est une plateforme d'échange de valeur entre communautés indépendantes, basée sur une monnaie interne (Epicoins). Le système permet des échanges inter-groupes sécurisés, traçables et équitables, avec une logique de confiance et de réputation.

### Principes Fondamentaux

- **Simplicité** : Pas ou peu de création de compte, expérience utilisateur fluide
- **Transparence** : Tous les échanges sont traçables et auditables
- **Scalabilité** : Support de plusieurs groupes avec volumes variables
- **Décentralisation** : Architecture semi-décentralisée évitant les dépendances lourdes
- **Confiance** : Système de réputation basé sur l'historique des transactions

## 🚀 Démarrage Rapide

### Prérequis

- Node.js 18+ et npm 9+
- PostgreSQL 14+
- Git

### Installation

```bash
# Cloner le repository
git clone https://github.com/nicolas-sainty/Wallet-IAsansIA.git
cd Wallet-IAsansIA

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# Initialiser la base de données
psql -U postgres -c "CREATE DATABASE epicoin_db;"
psql -U postgres -d epicoin_db -f database/schema.sql

# Démarrer le serveur
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 📁 Architecture du Projet

```
Wallet-IAsansIA/
├── database/
│   └── schema.sql           # Schéma PostgreSQL complet
├── public/
│   ├── css/
│   │   └── index.css        # Styles modernes avec glassmorphism
│   ├── js/
│   │   └── app.js           # Logique frontend
│   └── index.html           # Interface utilisateur
├── src/
│   ├── api/
│   │   └── server.js        # Serveur Express principal
│   ├── config/
│   │   ├── database.js      # Configuration PostgreSQL
│   │   └── logger.js        # Winston logger
│   ├── routes/
│   │   ├── wallets.routes.js
│   │   ├── transactions.routes.js
│   │   └── groups.routes.js
│   └── services/
│       ├── wallet.service.js
│       ├── transaction.service.js
│       └── group.service.js
├── .env.example             # Template de configuration
├── package.json
└── README.md
```

## 🔧 API Endpoints

### Wallets

- `POST /api/wallets` - Créer un wallet
- `GET /api/wallets/:walletId` - Détails d'un wallet
- `GET /api/wallets/:walletId/balance` - Solde du wallet
- `GET /api/wallets/:walletId/transactions` - Historique des transactions

### Transactions

- `POST /api/transactions` - Initier une transaction
- `GET /api/transactions/:txId` - Détails de la transaction
- `GET /api/transactions/:txId/status` - Statut de la transaction
- `POST /api/transactions/:txId/cancel` - Annuler une transaction (si PENDING)

### Groupes

- `POST /api/groups` - Créer un groupe
- `GET /api/groups` - Liste tous les groupes
- `GET /api/groups/:groupId` - Détails d'un groupe
- `GET /api/groups/:groupId/members` - Membres du groupe
- `GET /api/groups/:groupId/stats` - Statistiques du groupe
- `POST /api/groups/:groupId/rules` - Définir règles d'échange
- `GET /api/groups/:groupId/trust-scores` - Scores de confiance

## 💾 Modèle de Données

### Transactions

Chaque transaction contient :

- **Identifiants** : `transaction_id`, `provider`, `provider_tx_id`
- **Acteurs** : `initiator_user_id`, `source_wallet_id`, `destination_wallet_id`
- **Données financières** : `amount`, `currency`
- **Type** : `transaction_type` (P2P, MERCHANT, CASHIN, CASHOUT)
- **Statut** : `status` (PENDING, SUCCESS, FAILED, CANCELED)
- **Timestamps** : `created_at`, `executed_at`, `provider_created_at`
- **Métadonnées** : `description`, `country`, `city`, `metadata`

### Système de Confiance

Le score de confiance entre groupes est calculé automatiquement basé sur :
- Nombre de transactions réussies
- Volume total échangé
- Taux d'échec
- Ancienneté de la relation

## 🎨 Interface Utilisateur

L'interface web présente :

- **Dashboard** : Vue d'ensemble avec statistiques en temps réel
- **Wallets** : Gestion des wallets avec création en un clic
- **Transferts** : Interface simple pour envoyer des Epicoins
- **Historique** : Liste complète et filtrable des transactions
- **Groupes** : Vue des communautés avec scores de confiance

### Design

- Mode sombre par défaut avec support du mode clair
- Glassmorphism et gradients modernes
- Animations fluides et micro-interactions
- Responsive design pour mobile et desktop
- Typographie premium (Inter font)

## 🔒 Sécurité

- Helmet.js pour les en-têtes HTTP sécurisés
- Rate limiting sur les endpoints API
- Validation des entrées avec express-validator
- Transactions atomiques PostgreSQL
- Logging complet des actions

## 🧪 Tests

```bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration

# Coverage
npm test -- --coverage
```

## 📈 Monitoring

Les logs sont stockés dans `logs/` :
- `error.log` : Erreurs uniquement
- `combined.log` : Tous les événements

Endpoint de santé : `GET /health`

## 🤝 Contribution

Ce projet est en phase de co-construction. Nous cherchons à échanger avec d'autres groupes intéressés par :

- Les monnaies communautaires
- Les systèmes d'échange alternatifs
- Les mécanismes d'incitation inter-communautés

### Roadmap

- [ ] Support multi-devises (conversion Epicoin ↔ Fiat/Crypto)
- [ ] Intégration de providers de paiement externes
- [ ] Application mobile (React Native)
- [ ] Smart contracts pour décentralisation accrue
- [ ] Dashboard analytics avancé
- [ ] API GraphQL

## 📄 License

MIT License - voir le fichier LICENSE pour plus de détails

## 👥 Auteurs

Projet développé par la communauté Epicoin

## 📮 Contact

Pour toute question ou collaboration : [GitHub Issues](https://github.com/nicolas-sainty/Wallet-IAsansIA/issues)

---

**Note** : Ce projet est en développement actif. Les contributions et feedbacks sont les bienvenus !
