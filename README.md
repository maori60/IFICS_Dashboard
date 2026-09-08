# IFICS Platform

Plateforme web institutionnelle et de gestion pour l’association IFICS : site public, espace interne, gestion des intervenants, partenaires, projets, documents, finances, R&D, RH, IT et sécurité.

## V1 — périmètre livré

IFICS Platform V1 regroupe dans une même application Nuxt :

- un **site public institutionnel** ;
- un **espace IFICS authentifié** ;
- des parcours sécurisés pour les intervenants et partenaires ;
- un back-office modulaire ;
- une API Nitro ;
- PostgreSQL/Prisma ;
- un déploiement self-hosted Docker sur Debian.

L’application suit un principe important : les données internes ne deviennent jamais publiques automatiquement. Les contenus publics sont projetés via des modèles et workflows de publication dédiés.

## Site public

Le site comprend notamment :

- présentation de l’association, mission et valeurs ;
- domaines d’action ;
- projets publiés ;
- actualités ;
- partenaires et mécénat ;
- Innovation & R&D ;
- catalogue de logiciels et outils gratuits ;
- recrutement / nous rejoindre ;
- formulaire de proposition de projet ;
- contact multi-motifs ;
- profils d’intervenants explicitement autorisés à la publication.

Les projets internes confidentiels, données financières, contrats, pièces administratives, commentaires et documents privés ne sont pas exposés par les API publiques.

## Espace IFICS

Le dashboard couvre :

- pilotage et indicateurs ;
- clients / collectivités ;
- projets et affectations ;
- intervenants ;
- documents et validation administrative ;
- bilans avec versioning et PDF ;
- devis, factures et suivi des statuts ;
- tickets de support ;
- partenaires / CRM ;
- CMS et workflow de publication ;
- R&D et logiciels ;
- parc IT ;
- RH et départements ;
- rôles et permissions ;
- notifications ;
- journal d’audit ;
- recherche globale filtrée par droits ;
- santé système et mode maintenance.

## Sécurité

La V1 inclut :

- mots de passe hashés ;
- sessions serveur révocables et cookies `HttpOnly` ;
- MFA TOTP obligatoire pour les rôles sensibles ;
- codes de récupération MFA hashés ;
- procédure de reset MFA administrée, temporaire et auditée ;
- invitations et tokens one-shot stockés sous forme de hash ;
- limitation des tentatives de connexion ;
- permissions granulaires ;
- classification des projets (`PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`) ;
- séparation des droits de lecture des projets confidentiels ;
- contrôle des accès clients/intervenants ;
- audit des opérations sensibles avec métadonnées expurgées ;
- chiffrement des secrets MFA au repos ;
- pseudonymisation des IP dans les journaux ;
- upload PDF contrôlé, renommage serveur et SHA-256 ;
- échéance/renouvellement des documents prestataires ;
- mode maintenance côté serveur ;
- audit npm bloquant à partir du niveau `high`.

La sécurité applicative ne remplace pas la sécurité de l’hôte : Debian, Docker, reverse proxy, firewall et sauvegardes doivent également être maintenus.

## Stack

- Node.js 22
- Nuxt 4 / Vue 3
- Nitro
- TypeScript
- Prisma 7
- PostgreSQL 17
- Docker / Docker Compose
- ESLint
- Vitest
- Nodemailer 10
- pdf-lib

## Développement local

```bash
git clone https://github.com/maori60/IFICS_Dashboard.git
cd IFICS_Dashboard
cp .env.example .env
# Adapter les secrets et valeurs de développement dans .env
make dev-init
```

Application : `http://localhost:3000` par défaut.

Commandes utiles :

```bash
make dev-up
make dev-down
make dev-logs
make dev-migrate
make dev-seed
npm run quality
npm run security:audit
npm run build
```

## Qualité

Le gate de complétion exécute :

```text
npm ci
prisma validate
prisma generate
eslint --max-warnings=0
nuxt typecheck
vitest --coverage
npm audit --omit=dev --audit-level=high
nuxt build
```

Les migrations V1 ont également été validées en appliquant **tout l’historique** sur une PostgreSQL vierge puis en comparant la base obtenue au schéma Prisma cible.

## Production Debian

La définition `docker-compose.yml` de production :

- n’expose pas PostgreSQL sur l’hôte ;
- lie Nitro uniquement à `127.0.0.1:3000` ;
- attend que PostgreSQL soit sain ;
- possède un healthcheck applicatif sur `/api/ready` ;
- transmet explicitement les secrets/runtime nécessaires ;
- est prévue pour être placée derrière un reverse proxy HTTPS.

Procédure complète :

- [`docs/operations/production-debian.md`](docs/operations/production-debian.md)
- [`docs/operations/backup-restore.md`](docs/operations/backup-restore.md)

Exemple Caddy : [`deploy/Caddyfile.example`](deploy/Caddyfile.example).

## Sauvegarde / restauration

```bash
make backup
```

Une sauvegarde contient PostgreSQL, les uploads, des métadonnées et des checksums SHA-256.

Restauration destructive explicite :

```bash
RESTORE_CONFIRM=YES make restore BACKUP=/chemin/vers/ifics-YYYYMMDDTHHMMSSZ
```

Les backups locaux doivent être recopiés vers un stockage **chiffré hors serveur** et régulièrement restaurés sur un environnement de test.

## Tâches planifiées

Les contrôles d’expiration des documents prestataires sont déclenchables via :

```bash
INTERNAL_JOB_TOKEN='...' sh scripts/run-document-expiry.sh
```

Le runbook Debian fournit un exemple de timer systemd quotidien.

## Structure

```text
app/                 interface Nuxt
server/api/          routes API
server/middleware/   contrôles globaux
server/utils/        sécurité et logique partagée
prisma/              schéma, migrations et seed
scripts/             exploitation / backup / restore
docs/                architecture, développement, sécurité, opérations
deploy/              exemples de configuration de production
tests/               tests automatisés
```

## Variables sensibles

Ne jamais committer :

- `.env` ;
- mots de passe ;
- `APP_ENCRYPTION_KEY` ;
- `IP_HASH_PEPPER` ;
- `INTERNAL_JOB_TOKEN` ;
- identifiants SMTP ;
- uploads ;
- sauvegardes.

`.gitignore` exclut les emplacements locaux correspondants. Utilisez un gestionnaire de secrets pour conserver les clés critiques hors du serveur.

## État du projet

**V1 fonctionnelle et préparée pour livraison self-hosted.**

La suite du projet pourra enrichir les modules sans remettre en cause le socle : permissions plus avancées par périmètre, workflows supplémentaires, observabilité externe, stockage objet, automatisations et montée en charge.

## Auteur

Van BUI — projet développé dans le cadre d’une démarche mêlant expérience métier associative et formation à l’École 42.
