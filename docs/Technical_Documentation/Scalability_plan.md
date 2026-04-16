# Plan de Scalabilité et Résilience

## 1.1 Introduction : Trajectoire de croissance
Pour concevoir l'architecture d'Epicoin, nous avons défini une stratégie de déploiement en trois étapes. Cette approche progressive nous permet de valider techniquement la solution avant d'engager des frais d'infrastructure importants :

* **Phase Alpha (Cible : 1 Campus) :** Validation du MVP (Minimum Viable Product) auprès de ~500 étudiants. Utilisation des plans "Free Tier" (gratuits) pour minimiser les coûts de développement.
* **Phase Bêta (Cible : Multi-Campus) :** Extension à 5-10 campus (environ 5 000 utilisateurs). Passage aux instances payantes pour absorber la charge et garantir des temps de réponse stables lors des pics de transactions (ex: pauses café, événements BDE).
* **Phase Échelle (Cible : National) :** Déploiement sur tout le réseau Epitech. Optimisation de la base de données (pooling) et automatisation complète de l'infrastructure pour gérer les flux nationaux.

## 1.2 Choix du Cloud et Évolutivité
Nous avons opté pour un modèle **PaaS (Platform as a Service)** avec **Vercel** pour l'hébergement du code et **Supabase** pour la gestion des données. Ce choix nous permet de déléguer la maintenance des serveurs physiques pour nous concentrer sur la logique métier.

* **Scalabilité Verticale (Phase Alpha/Bêta) :** Pour répondre à la hausse du nombre d'utilisateurs par campus, nous pouvons simplement augmenter les ressources (CPU/RAM) de nos instances. C'est la méthode la plus directe pour garantir la performance sans modifier notre code actuel.
* **Scalabilité Horizontale (Phase Échelle) :** Pour le déploiement national, nous prévoyons de multiplier les instances de notre API Node.js. En plaçant ces instances derrière un répartiteur de charge (**Load Balancer**), le trafic sera distribué pour éviter qu'un seul serveur ne soit saturé.
* **Hypothèse Multi-région :** Bien que non prioritaire au début, nous avons anticipé une expansion internationale. En utilisant des **Read Replicas** (copies de la base en lecture seule) placées géographiquement proches des utilisateurs (ex: Asie, USA), nous pourrons réduire la latence d'affichage du solde tout en maintenant une base centrale sécurisée pour les écritures.

## 1.3 Monitoring et Alerting (Focus Phase Alpha)
Pour surveiller la santé de notre application dès le premier campus, nous mettons en place des outils de diagnostic simples mais efficaces :

* **Logs d'erreurs :** Utilisation des journaux (logs) natifs de Vercel et Supabase pour identifier rapidement les crashs serveurs ou les requêtes SQL anormalement lentes.
* **Alerting Critique :** Configuration de notifications automatiques via Email ou Discord en cas de pic d'erreurs (HTTP 500) ou de saturation de la base de données. L'objectif est d'être prévenu en temps réel avant que les étudiants ne remontent un problème d'accès.

## 1.4 CI/CD et Haute Disponibilité
Pour garantir que l'application reste disponible même lors des mises à jour, nous utilisons des processus automatisés :

* **Pipeline CI/CD :** Chaque modification du code sur notre dépôt GitHub déclenche automatiquement une série de tests. Si les tests sont validés, le déploiement vers Vercel se fait de manière autonome. Cela réduit drastiquement le risque d'erreur humaine lors des mises à jour.
* **Disponibilité continue (Zero-Downtime) :** En utilisant des services cloud distribués, notre application est naturellement protégée contre la panne d'un serveur physique unique. Lors d'une mise à jour, l'ancienne version reste en ligne tant que la nouvelle n'est pas totalement opérationnelle, assurant une expérience sans coupure pour l'utilisateur.