# IFICS Platform V1 — architecture actuelle

Date de référence : 8 septembre 2026.

Ce document décrit l’état **après** construction de la V1. L’ancien inventaire pré-Milestone a été remplacé afin de ne plus présenter comme absents des contrôles désormais implémentés.

## Architecture générale

IFICS est un **monolithe modulaire** Nuxt/Nitro. Ce choix garde un déploiement simple pour une infrastructure self-hosted tout en séparant les domaines métier dans le code et les permissions.

```text
Navigateur
├── Site public
├── Espace IFICS
├── Espace intervenants
└── Espace partenaires
        |
        v
Nuxt 4 / Vue 3
        |
        v
Nitro API / middleware
├── Auth / MFA / sessions
├── Permissions / classifications
├── Projets / clients / intervenants
├── Documents / bilans / facturation
├── Tickets / CRM
├── CMS / publications
├── R&D / logiciels
├── RH / départements
├── IT / actifs
├── Audit / notifications
└── Santé / maintenance / recherche
        |
        v
Prisma 7 + PostgreSQL 17
        |
        +--> volume uploads
```

## Séparation public / interne

Un objet interne n’est jamais considéré comme publiable parce qu’il existe dans PostgreSQL.

Les API publiques ne doivent exposer que des modèles/projections explicitement destinés à la publication. Les données suivantes restent internes :

- budgets et marges ;
- factures et devis internes ;
- commentaires internes ;
- contrats et conventions non partagés ;
- IBAN/BIC ;
- pièces d’identité et justificatifs administratifs ;
- journaux d’audit ;
- données RH ;
- projets classifiés non autorisés.

## Authentification

Le socle comprend :

- mots de passe scrypt avec sel aléatoire ;
- sessions opaques persistées côté serveur ;
- stockage uniquement du hash du token de session ;
- cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production ;
- révocation d’une session ou de toutes les sessions utilisateur ;
- date d’expiration d’accès utilisateur ;
- limitation des tentatives de login ;
- journalisation des succès/échecs pertinents.

## MFA

Les rôles sensibles imposent le TOTP.

- secret TOTP chiffré en AES-256-GCM avec `APP_ENCRYPTION_KEY` ;
- codes de récupération stockés sous forme de hash ;
- vérification MFA liée à la session ;
- réinitialisation MFA distincte du reset de mot de passe ;
- reset MFA nécessitant une permission dédiée et un administrateur MFA-validé ;
- token de récupération à durée courte et usage unique ;
- révocation de l’ancien secret, des anciens recovery codes et des sessions lors du reset ;
- ré-enrôlement obligatoire après récupération.

## Autorisation

Le contrôle d’accès est basé sur des permissions atomiques associées aux rôles. Les routes sensibles appellent explicitement les gardes d’autorisation.

Les projets possèdent en plus une classification :

- `PUBLIC` ;
- `INTERNAL` ;
- `CONFIDENTIAL` ;
- `RESTRICTED`.

La possession de `project:read` ne suffit pas à ouvrir un projet classifié. Une permission spécifique de lecture confidentielle est requise.

Les utilisateurs de type client/intervenant sont en outre limités aux ressources qui leur sont effectivement liées.

## Documents

- fichiers PDF stockés hors des sources de l’application ;
- noms de stockage générés côté serveur ;
- taille limitée ;
- empreinte SHA-256 ;
- versionnement ;
- visibilité ;
- validation administrative ;
- date d’émission et d’expiration pour les pièces prestataires ;
- statuts de renouvellement/expiration ;
- rappels programmés à l’approche des échéances.

La validation IFICS constitue une validation administrative interne et ne doit pas être présentée comme une garantie absolue d’authenticité du document.

## Audit

Les actions sensibles alimentent `AuditLog` avec :

- utilisateur ;
- association ;
- action et résultat ;
- type/id de ressource ;
- request ID ;
- IP pseudonymisée ;
- user-agent ;
- métadonnées expurgées des clés sensibles.

L’audit applicatif est append-only du point de vue de l’interface. Un administrateur root de la base reste techniquement capable d’altérer PostgreSQL ; une immutabilité forte nécessiterait un stockage externe/WORM.

## Publication

Les contenus publics disposent d’états de workflow distincts du contenu interne, par exemple brouillon, revue, approbation, planification, publication et archivage selon le module.

Le CMS couvre les contenus institutionnels et actualités. Les publications de projets, partenaires, profils d’intervenants et logiciels sont explicitement contrôlées.

## Exploitation

La V1 fournit :

- `/api/health` : vie du processus ;
- `/api/ready` : disponibilité avec PostgreSQL ;
- centre système authentifié ;
- statistiques hôte/process ;
- sessions actives / échecs login récents ;
- état stockage ;
- mode maintenance ;
- recherche globale filtrée par permissions ;
- job interne d’expiration documentaire protégé par token ;
- scripts de backup et restore ;
- runbook Debian ;
- reverse proxy Caddy d’exemple.

## Déploiement

Production recommandée :

- Debian ;
- Docker Compose ;
- PostgreSQL 17 dans un réseau Docker privé ;
- Nitro exposé uniquement sur `127.0.0.1:3000` ;
- Caddy/Nginx devant l’application ;
- TLS public ;
- SMTP transactionnel externe ;
- sauvegardes chiffrées hors serveur.

Voir `docs/operations/production-debian.md`.

## Qualité et CI

Deux niveaux de contrôle sont utilisés :

### Completion Gate

- installation déterministe ;
- validation/génération Prisma ;
- ESLint sans warning ;
- Nuxt typecheck ;
- tests avec couverture ;
- audit des dépendances de production bloquant à partir de `high` ;
- build production.

### Release Gate

- PostgreSQL 17 réel ;
- application de l’historique complet de migrations ;
- seed ;
- Completion Gate complet ;
- validation syntaxique des scripts d’exploitation ;
- validation Docker Compose ;
- démarrage réel du serveur ;
- smoke tests pages/API ;
- login et obligation de configuration MFA ;
- refus d’un endpoint sensible avant MFA ;
- exécution du job interne protégé.

## Migrations

L’historique de migrations existant et le schéma V1 ont été réconciliés par une migration de rattrapage générée via Prisma. Le résultat a été testé sur une base PostgreSQL vierge puis comparé au schéma cible avec un diff nul.

En production, utiliser exclusivement :

```bash
npm run db:migrate
```

Ne pas utiliser `prisma db push`.

## Limites conscientes de V1

- monolithe et une instance d’association par déploiement ;
- fichiers sur volume local plutôt que stockage objet ;
- métriques intégrées simples plutôt qu’une stack Prometheus/Grafana ;
- audit stocké dans PostgreSQL et non dans un WORM externe ;
- aucune prétention à détecter automatiquement tous les faux documents ;
- montée en charge horizontale non activée par défaut.

Ces choix réduisent la complexité d’exploitation aujourd’hui sans bloquer une évolution ultérieure vers stockage S3-compatible, Redis/queue, observabilité externe ou plusieurs réplicas.
