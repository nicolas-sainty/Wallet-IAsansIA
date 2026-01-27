# Student Wallet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

> Système de wallet étudiant pour gérer des crédits et des paiements au sein d'associations étudiantes

## 🚀 Installation Rapide

### Prérequis

- [Node.js](https://nodejs.org/) 18+ et npm
- [PostgreSQL](https://www.postgresql.org/) 14+
- Git

### Setup

```bash
# 1. Cloner le projet
git clone https://github.com/nicolas-sainty/Wallet-IAsansIA.git
cd Wallet-IAsansIA

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres PostgreSQL

# 4. Créer la base de données
psql -U postgres -c "CREATE DATABASE student_wallet_db;"
psql -U postgres -d student_wallet_db -f database/schema.sql

# 5. Démarrer l'application
npm run dev
```

L'application sera accessible sur **http://localhost:3000** 🎉

## 🔧 Configuration

### Fichier `.env`

```env
# Database
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=student_wallet_db
DB_PASSWORD=your_password
DB_PORT=5432

# Server
PORT=3000
NODE_ENV=development
```

## 📁 Structure du Projet

```
Wallet-IAsansIA/
├── database/
│   └── schema.sql           # Schéma de la base de données
├── public/
│   ├── css/                 # Styles CSS
│   ├── js/                  # Scripts frontend
│   ├── index.html           # Page principale
│   ├── shop.html            # Boutique de crédits
│   ├── events.html          # Événements
│   ├── profile.html         # Profil utilisateur
│   └── login.html           # Authentification
├── src/
│   ├── api/
│   │   └── server.js        # Serveur Express
│   ├── config/
│   │   ├── database.js      # Configuration PostgreSQL
│   │   └── logger.js        # Logger Winston
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── wallets.routes.js
│   │   ├── payment.routes.js
│   │   └── transactions.routes.js
│   └── services/
│       ├── auth.service.js
│       ├── wallet.service.js
│       ├── payment.service.js
│       └── transaction.service.js
└── package.json
```

## 🎯 Fonctionnalités

- ✅ **Authentification** : Inscription et connexion sécurisées
- ✅ **Wallets** : Gestion de wallets multi-devises (CREDITS, EUR)
- ✅ **Achats de crédits** : Simulation d'achat avec packs prédéfinis
- ✅ **Transactions** : Historique complet des transactions
- ✅ **Profil utilisateur** : Gestion du compte et des informations

## 🎨 Interface

L'interface utilise un design moderne avec :
- Mode sombre avec palette navy blue, bright blue, coral orange et cream
- Glassmorphism et effets de transparence
- Animations fluides
- Interface responsive mobile-first

## 🔒 Sécurité

- Mots de passe hashés avec bcrypt
- Sessions sécurisées
- Validation des entrées
- Protection CORS
- Logging des événements

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `POST /api/auth/logout` - Se déconnecter

### Wallets
- `GET /api/wallets/user/:userId` - Wallets d'un utilisateur
- `GET /api/wallets/:walletId/transactions` - Historique des transactions

### Payment
- `POST /api/payment/simulate` - Simuler un achat de crédits

## 🐛 Dépannage

### La base de données ne se connecte pas
- Vérifiez que PostgreSQL est démarré
- Vérifiez les identifiants dans `.env`
- Vérifiez que la base de données existe

### Erreur au démarrage du serveur
```bash
# Vérifier que le port 3000 n'est pas déjà utilisé
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux
```

### Les transactions ne fonctionnent pas
- Assurez-vous que le schéma SQL est bien appliqué
- Vérifiez les logs dans `logs/error.log`

## 📄 License

MIT License - Voir le fichier LICENSE pour plus de détails

## 👥 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

---

**Développé avec ❤️ pour les associations étudiantes**
