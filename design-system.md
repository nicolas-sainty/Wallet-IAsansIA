# Design System — Student Wallet

> Version 1.0 · Avril 2026

---

## 1. Fondations

### Typographie

| Rôle | Police | Poids |
|------|--------|-------|
| Principale | **Outfit** (Google Fonts) | 300 – 800 |

### Couleurs

#### Surfaces

| Token | Valeur | Usage |
|-------|--------|-------|
| `--surface-base` | `#0b0f1a` | Fond global de l'app |
| `--surface-card` | `rgba(255,255,255,0.04)` | Fond des cartes glass |
| `--surface-card-border` | `rgba(255,255,255,0.08)` | Bordure des cartes |
| `--surface-elevated` | `rgba(255,255,255,0.07)` | Éléments surélevés |

#### Texte

| Token | Valeur |
|-------|--------|
| `--text-primary` | `#f0f0f0` |
| `--text-secondary` | `rgba(240,240,240,0.65)` |
| `--text-muted` | `rgba(240,240,240,0.4)` |

#### Accent & Statut

| Token | Valeur | Usage |
|-------|--------|-------|
| `--accent` | `#ff8c42` | CTA principaux, éléments actifs |
| `--accent-strong` | `#ff7028` | Hover / gradient end |
| `--success` | `#22c55e` | Validations, montants positifs |
| `--warning` | `#f59e0b` | En attente, alertes |
| `--error` | `#ef4444` | Erreurs, montants négatifs |
| `--info` | `#6366f1` | Informationnel |

### Rayons (Border Radius)

| Token | Valeur |
|-------|--------|
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `20px` |
| `--radius-xl` | `28px` |

---

## 2. Orbes animés (Gemini-like)

Chaque page possède 3 orbes (`orb-a`, `orb-b`, `orb-c`) rendus dans un `<div class="orb-canvas">` positionné en `fixed` sous le contenu. Les orbes sont des cercles floutés (`filter: blur(120px)`) qui dérivent lentement avec des animations CSS `alternate` de 18 – 26 s.

### Palette d'orbes par page

| Page | Classe body | Couleur dominante |
|------|-------------|-------------------|
| **wallets.html** | `page-wallets` | Orange (`#ff8c42`) |
| **shop.html** | `page-shop` | Bleu (`#3b82f6`) |
| **events.html** | `page-events` | Violet (`#8b5cf6`) |
| **profile.html** | `page-profile` | Blanc (`#ffffff`) |
| **index.html** | `page-home` | Orange + Indigo |
| **login.html** | `page-login` | Orange + Violet |
| **groups.html** | `page-groups` | Indigo + Violet |
| **admin*.html** | `page-admin` | Orange + Bleu |
| **privacy.html** | `page-privacy` | Indigo + Violet |

La couleur est définie via des custom properties CSS (`--orb-color-a`, `--orb-color-b`, `--orb-color-c`) surchargées par page.

### Markup standard

```html
<div class="orb-canvas" aria-hidden="true">
  <div class="orb orb-a"></div>
  <div class="orb orb-b"></div>
  <div class="orb orb-c"></div>
</div>
```

---

## 3. Composants

### Framework

- **DaisyUI 5** (CDN) — composants : `btn`, `badge`, `input`, `select`, `toggle`, `tabs`, `divider`
- **Tailwind CSS 4** (browser build CDN) — utilitaires
- **Lucide Icons** (CDN `unpkg.com/lucide@latest`) — remplace tous les emojis et SVGs inline

### Shell d'application

```
.app-shell          max-width: 480px, centré, z-index: 1
.app-shell.wide     max-width: 1100px (pages desktop : wallets, groups)
.page-content       padding + flex column + gap
```

### Carte de crédit (Home)

```
.credit-card        aspect-ratio 1.586, glass bg, gradient radial
  .card-header      titre + badge rôle
  .card-balance     solde + devise
  .card-footer      nom + bouton payer
```

### Glass Card

```css
.glass-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-card-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(16px);
  padding: 1.25rem;
}
```

### Bottom Bar (Navigation mobile)

```
.bottom-bar         fixed bottom, 4rem height, blur bg
  a                 flex column, icône Lucide + label
  a.active          couleur accent
```

### Top Nav (Desktop)

```
.top-nav            sticky top, blur bg
  .brand            logo texte
  .nav-links        liens navigation (hidden < 768px)
```

### Event Tile

```
.event-tile
  .event-banner     gradient bg + icône calendrier
  .event-body
    .event-date     accent, uppercase
    .event-title    bold
    .event-desc     secondary text
    .event-foot     badge reward + actions
```

### Shop Tile

```
.shop-tile          text-center, glass bg
.shop-tile.featured border-color bleu
  .icon-wrap        icône Lucide (sparkles, rocket, gem)
  h3                nom du pack
  .price            accent, bold
  .credits          muted
  btn btn-primary   acheter
```

### Badges

| Classe | Usage |
|--------|-------|
| `.badge-reward` | Points d'événement (`+50 pts`) |
| `.badge-status` | Statut (OPEN, FULL, etc.) |
| DaisyUI `badge badge-success/warning/error/ghost` | Statuts d'inscription |

### Toast

```css
.toast-container    fixed bottom-right, z-1000
.toast              glass bg, border-left colorée
.toast.success      border-left verte
.toast.error        border-left rouge
```

### Modal

```css
.modal-overlay       fixed inset, bg noir + blur, z-200
.modal-overlay.hidden
.modal-box           surface-base, border, border-radius-lg
```

---

## 4. Icônes

Toutes les icônes utilisent **Lucide Icons** via la balise `<i data-lucide="nom">`.

| Contexte | Icône |
|----------|-------|
| Shop / Boutique | `shopping-bag` |
| Events / Calendrier | `calendar` |
| Carte / Wallet | `credit-card` |
| Profil | `user` |
| Accueil | `home` |
| Associations | `users` |
| Dashboard admin | `layout-dashboard` |
| Finances | `wallet` |
| Ajouter | `plus` |
| Fermer | `x` |
| Retour | `arrow-left` |
| Paramètres | `settings` |
| Déconnexion | `log-out` |
| BDE | `graduation-cap` |
| Notifications | `bell` |
| Historique | `history` |
| Envoyer | `send` |
| En attente | `clock` |
| Liste | `list` |
| Statistiques | `bar-chart-3` |
| Pack Découverte | `sparkles` |
| Pack Standard | `rocket` |
| Pack Premium | `gem` |
| Lune (thème) | `moon` |
| Succès paiement | `party-popper` |
| Valider | `check` |

Après injection de HTML dynamique, appeler `lucide.createIcons()` pour hydrater les nouvelles icônes.

---

## 5. Conventions

- **Aucun emoji** dans le rendu HTML – remplacer par des icônes Lucide.
- **Pas de background bleu** – le fond global est `#0b0f1a` (quasi-noir), l'ambiance colorée vient exclusivement des orbes.
- Les boutons principaux utilisent la classe DaisyUI `btn btn-primary` avec un override gradient orange.
- Les inputs utilisent `bg-white/5 border-white/10` pour rester cohérents sur fond sombre.
- Le backend (dossier `src/`) ne doit **jamais** être modifié par des changements UI.

---

## 6. Dépendances CDN

| Lib | URL |
|-----|-----|
| DaisyUI 5 | `https://cdn.jsdelivr.net/npm/daisyui@5` |
| Tailwind CSS 4 (browser) | `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4` |
| Lucide Icons | `https://unpkg.com/lucide@latest` |
| Outfit Font | `https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800` |

---

## 7. Structure des fichiers UI

```
public/
├── css/
│   └── theme.css          ← Design tokens, orbes, layout, composants custom
├── js/
│   ├── app.js             ← Logique principale (routes, API, events, shop)
│   ├── auth.js            ← Authentification (login/register)
│   └── admin.js           ← Dashboard BDE admin
├── index.html             ← Home (carte de crédit)
├── login.html             ← Connexion / Inscription
├── wallets.html           ← Mes points (desktop layout)
├── shop.html              ← Boutique crédits
├── events.html            ← Événements
├── profile.html           ← Profil utilisateur
├── groups.html            ← Associations (desktop layout)
├── admin.html             ← Dashboard admin
├── admin-students.html    ← Gestion étudiants
├── admin-events.html      ← Gestion événements
├── admin-finances.html    ← Finances BDE
├── privacy.html           ← Politique de confidentialité
└── payment/
    └── success.html       ← Confirmation paiement Stripe
```
