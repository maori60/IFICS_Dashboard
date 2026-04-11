#  Histoire de ce projet

En 2021, suite à la crise du COVID-19, de nombreuses structures — associations, entreprises et indépendants — ont été confrontées à une forte instabilité économique et organisationnelle.

Dans ce contexte, j’ai identifié un besoin concret : disposer d’un outil centralisé pour structurer et piloter efficacement les activités associatives.

J’ai alors développé une première version de cet outil en local, avec pour objectif de répondre à des besoins essentiels :

gestion des contrats et conventions
suivi des projets et rédaction de bilans
gestion des clients et partenaires
gestion des prestataires externes
facturation

Aujourd’hui, dans le cadre de ma formation à l’école 42, je reprends ce projet avec une approche plus professionnelle et scalable.

👉 IFICS Dashboard est donc l’évolution de cet outil initial, repensé comme une application web moderne, avec une architecture solide et des objectifs clairs de montée en charge.

# 📊 IFICS Dashboard

Application web moderne de gestion pour associations, mairies et établissements.

---

## 🚀 Stack Technique

- **Frontend** : Nuxt 4 (Vue 3 + Vite)
- **Backend** : Nitro (API routes)
- **ORM** : Prisma
- **Base de données** : PostgreSQL (configurable)

---

## ✨ Fonctionnalités

### 👥 Clients
- Liste des clients
- Création de clients
- Types gérés :
  - Mairie
  - Établissement scolaire
  - Association
  - Autre

### 📁 Projets
- Liste des projets
- Création de projets
- Association à des clients
- Statuts :
  - `DRAFT`
  - `VALIDATED`
  - `IN_PROGRESS`
  - `COMPLETED`
  - `CANCELLED`

---

## 🎨 UI / UX

- Design moderne en thème clair
- Interface professionnelle
- Cartes avec ombres et animation au survol
- Badges dynamiques selon le statut
- Boutons réutilisables
- Layout structuré
- Responsive mobile

---

## 📱 Responsive

- Sidebar desktop
- Menu burger mobile
- Pages adaptées smartphone
- Formulaires optimisés mobile

---

## 🧩 Architecture du projet

```text
association-dashboard/
│
├── app/
│   ├── components/
│   │   ├── BaseButton.vue
│   │   └── PageHeader.vue
│   │
│   ├── layouts/
│   │   └── default.vue
│   │
│   ├── pages/
│   │   ├── clients/
│   │   │   ├── index.vue
│   │   │   └── create.vue
│   │   │
│   │   ├── projects/
│   │   │   ├── index.vue
│   │   │   └── create.vue
│   │   │
│   │   └── intervenors/
│   │       └── index.vue
│   │
│   └── app.vue
│
├── generated/
│
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
│
├── public/
│
├── server/
│   ├── api/
│   │   ├── clients/
│   │   │   ├── index.get.ts
│   │   │   └── create.post.ts
│   │   │
│   │   └── projects/
│   │       ├── index.get.ts
│   │       └── create.post.ts
│   │
│   └── utils/
│       └── prisma.ts
│
├── .env
├── .gitignore
├── nuxt.config.ts
├── package.json
├── package-lock.json
├── prisma.config.ts
├── README.md
├── tsconfig.app.json
└── tsconfig.json
```

---

## 🔌 API Endpoints

### Clients
- `GET /api/clients`
- `POST /api/clients/create`

### Projects
- `GET /api/projects`
- `POST /api/projects/create`

---

## 🧠 Concepts utilisés

- Composition API (`<script setup>`)
- `useFetch` pour le chargement des données
- Architecture modulaire
- Composants réutilisables
- Gestion des états `pending`, `error`, `refresh`
- Relations Prisma entre projets et clients

---

## ⚙️ Installation

```bash
npm install
```

---

## ▶️ Lancer le projet

```bash
npm run dev
```

Application disponible sur :

```text
http://localhost:3000
```

---

## 🗄️ Base de données

Le projet utilise Prisma avec PostgreSQL.

Exemple de variable d’environnement :

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/association_dashboard?schema=public"
```

Exécuter les migrations :

```bash
npx prisma migrate dev
```

Seeder la base :

```bash
npx tsx prisma/seed.ts
```

---

## 🧪 Fonctionnalités déjà réalisées

- Initialisation complète du projet Nuxt
- Configuration Prisma
- Connexion PostgreSQL fonctionnelle
- Création d’une API clients
- Création d’une API projets
- Création de clients via interface
- Création de projets via interface
- Lien projet ↔ client
- Design refactorisé en version claire
- Responsive mobile fonctionnel
- Création de composants réutilisables :
  - `BaseButton`
  - `PageHeader`

---

## 🔜 Roadmap

- Authentification (login / rôles)
- Gestion des intervenants complète
- Dashboard analytics
- Filtres / recherche
- Pagination
- Export PDF
- Notifications
- Édition / suppression des entités

---

## 👨‍💻 Auteur

**Van BUI**  
Étudiant à l’école 42  
Développeur Full Stack  

---

## 🚀 Vision

Créer une application professionnelle pour centraliser la gestion
des projets éducatifs et associatifs avec une expérience fluide,
moderne et scalable, dans une logique de produit SaaS.

---

## 📦 Git

Initialisation du dépôt à la racine du projet :

```bash
cd /media/van/vbui_42/Projets_dev/IFICS/Dashboard/association-dashboard
git init
git add .
git commit -m "feat: initial IFICS dashboard with responsive UI and reusable components"
git branch -M main
git remote add origin git@github.com:maori60/IFICS_Dashboard.git
git push -u origin main
```

---

## 📝 Commit message conseillé

```text
feat: initial IFICS dashboard with responsive UI and reusable components
```

---

## 📌 Résumé rapide

Le projet IFICS Dashboard est une base solide de dashboard SaaS construite avec Nuxt 4, Prisma et PostgreSQL.  
Il permet déjà de gérer des clients et des projets, de les relier entre eux, d’utiliser une interface claire, responsive et modulaire, et constitue une fondation propre pour les prochaines évolutions métier.
