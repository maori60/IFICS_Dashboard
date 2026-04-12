# IFICS Dashboard

> Dashboard de gestion associative dédié aux structures éducatives, collectivités et intervenants.

---

## Contexte

Ce projet est directement issu de mon expérience professionnelle.

De 2021 à 2026, j’ai travaillé en tant que **Responsable Projets et Solutions Digitales** au sein de l’association **IFICSI**, spécialisée dans l’éducation et les projets avec les collectivités territoriales.

Au quotidien, j’ai été confronté à des problématiques concrètes :

- gestion complexe des projets
- multiplicité des interlocuteurs (collectivités, établissements scolaires, partenaires)
- suivi des intervenants
- organisation des documents (bilans, conventions, contrats)
- gestion des devis et factures
- absence d’un outil centralisé réellement adapté aux associations

En novembre 2023, j’intègre **l’école 42** afin de me reconvertir dans le développement.

👉 Ce projet est donc la fusion entre :
- mon expérience métier terrain
- mes compétences techniques en cours d’acquisition

---

## Objectif

Créer une application web permettant de :

- centraliser la gestion d’une association
- structurer les projets et les acteurs
- simplifier la gestion administrative et documentaire
- sécuriser les accès aux données sensibles
- proposer un outil réutilisable par d’autres structures

---

## Vision produit

Le projet est conçu comme :

- une **web application**
- **auto-hébergée**
- **une association = une instance**
- **responsive / mobile-first**
- **évolutive et personnalisable**

Objectif long terme :

- outil métier robuste
- solution réutilisable
- produit scalable et distribuable

---

## ⚙️ Fonctionnalités principales

### 👥 Gestion des utilisateurs
- rôles (admin, client, intervenant)
- permissions
- accès temporaires

### Gestion des clients
- collectivités
- établissements scolaires
- associations
- multi-contacts

### Gestion des projets
- statuts (brouillon, validé, en cours, terminé…)
- clients associés
- intervenants
- partenaires
- suivi global

### Gestion des intervenants
- affectation aux projets
- acceptation / refus de mission
- dépôt de documents

### Gestion documentaire
- upload de fichiers (PDF)
- consultation sécurisée
- gestion des accès
- traçabilité

### Devis & Factures *(en cours)*
- génération
- suivi
- export PDF

### Bilans *(en cours)*
- rédaction libre
- versioning
- export

### 🔔 Notifications
- actions importantes
- activité récente

---

## Stack technique

- **Frontend** : Nuxt 3 / Vue 3
- **Backend** : Node.js (Nitro)
- **ORM** : Prisma
- **Base de données** : PostgreSQL
- **Gestion PDF** : serveur (upload + visualisation)
- **Déploiement** : Docker (prévu)

---

## 📂 Structure du projet
app/ → Frontend Nuxt (pages, composants)
server/ → API backend (routes, logique métier)
prisma/ → schéma + migrations base de données
public/ → assets statiques


---

## 🔐 Sécurité

- gestion des rôles et permissions
- accès restreints aux documents
- traçabilité des actions
- séparation des données

---

## 🚧 État du projet

⚠️ Projet en développement actif

### Fonctionnel actuellement :
- gestion des projets
- gestion des documents (upload + visualisation PDF)
- API backend structurée
- routing dynamique Nuxt

### En cours :
- amélioration UI/UX
- gestion avancée des rôles
- devis / factures
- notifications

---

## 🚀 Roadmap

### V1 (MVP)
- authentification
- clients / projets
- intervenants
- documents
- devis / factures
- dashboard

### V2
- signature électronique
- statistiques avancées
- recherche globale
- relances automatiques

---

## 💡 Vision

Créer un outil métier basé sur une vraie expérience terrain, capable d’aider les associations à structurer leur activité et à gagner en efficacité.

---

## 👨‍💻 Auteur

**Van BUI**

- Étudiant à l’école 42
- Responsable Projets & Solutions Digitales


---

## ⚠️ Disclaimer

Projet en développement actif.  
Certaines fonctionnalités sont encore en cours d’implémentation.
