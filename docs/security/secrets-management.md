# Gestion des secrets — IFICS Platform V1

## Règle fondamentale

Aucun secret réel ne doit être commité dans Git :

- mot de passe PostgreSQL ;
- chaîne de connexion de production ;
- `APP_ENCRYPTION_KEY` ;
- `IP_HASH_PEPPER` ;
- `INTERNAL_JOB_TOKEN` ;
- identifiants SMTP ;
- mot de passe bootstrap ;
- token d’invitation/reset ;
- secret MFA ;
- codes de récupération.

Toute valeur ayant déjà été exposée dans Git, un ticket public, un log ou une conversation non prévue pour stocker des secrets doit être considérée comme compromise et remplacée.

## Configuration locale

```bash
cp .env.example .env
chmod 600 .env
```

`.env` et `.env.*` sont ignorés ; seul `.env.example` est versionné.

## Variables sensibles principales

### Base de données

- `POSTGRES_PASSWORD`
- `DATABASE_URL`

### Application

- `APP_ENCRYPTION_KEY` : exactement 32 octets aléatoires encodés en base64 ;
- `IP_HASH_PEPPER` : valeur indépendante pour pseudonymiser les IP ;
- `INTERNAL_JOB_TOKEN` : bearer token des jobs internes.

### Messagerie

- `SMTP_USER`
- `SMTP_PASSWORD`

### Bootstrap

`ADMIN_PASSWORD` ne doit pas être conservé dans la configuration de production. Le runbook Debian recommande de l’injecter uniquement dans la commande one-shot qui crée le premier administrateur.

## Génération

```bash
openssl rand -base64 32   # APP_ENCRYPTION_KEY
openssl rand -hex 32      # IP_HASH_PEPPER
openssl rand -hex 32      # INTERNAL_JOB_TOKEN
openssl rand -base64 36   # mot de passe d'infrastructure possible
```

Utilisez des valeurs différentes entre développement, staging et production.

## APP_ENCRYPTION_KEY

Cette clé chiffre notamment les secrets TOTP en AES-256-GCM.

**Ne la perdez pas et ne la changez pas brutalement sur une base existante.** Une rotation nécessite une procédure applicative capable de déchiffrer les secrets avec l’ancienne clé puis de les rechiffrer avec la nouvelle.

Conservez une copie de secours de cette clé dans un gestionnaire de secrets sécurisé, distinct du serveur IFICS.

## Tokens applicatifs

Les tokens utilisateurs one-shot (invitations, reset, récupération MFA) sont générés aléatoirement. Le token brut est transmis au destinataire ; la base conserve son hash afin qu’une lecture de PostgreSQL ne suffise pas à réutiliser le lien.

Les codes de récupération MFA sont eux aussi stockés sous forme de hash.

## Logs et audit

Ne jamais journaliser :

- mot de passe ;
- secret TOTP ;
- token brut ;
- cookie/session brut ;
- `Authorization` ;
- IBAN/BIC complets dans les métadonnées d’audit.

L’utilitaire d’audit expurge les clés sensibles connues avant persistance des métadonnées.

## CI

Les secrets nécessaires au Release Gate sont générés dynamiquement par GitHub Actions. Le workflow ne contient pas de mot de passe admin, clé de chiffrement ou job token statique.

L’audit des dépendances de production bloque les niveaux `high` et `critical`.

## Rotation après incident

En cas de soupçon de compromission :

1. isoler l’accès concerné ;
2. conserver les preuves/logs utiles ;
3. révoquer les sessions ;
4. changer le mot de passe du compte concerné ;
5. ré-enrôler le MFA si nécessaire ;
6. régénérer le job token si exposé ;
7. changer les identifiants SMTP s’ils sont concernés ;
8. changer le mot de passe PostgreSQL si nécessaire ;
9. traiter `APP_ENCRYPTION_KEY` avec une procédure de rotation dédiée, jamais par simple remplacement ;
10. vérifier les backups avant remise en ligne.

## Production

Le dépôt reste volontairement indépendant d’un fournisseur de secret management. Sur une infrastructure plus avancée, `.env` pourra être remplacé par Docker secrets, systemd credentials, Vault ou une solution équivalente sans changer la logique métier.

Pour la V1 self-hosted, le minimum est :

- `.env` en permissions restrictives ;
- accès SSH limité ;
- secrets sauvegardés séparément dans un coffre ;
- aucun secret dans Git ;
- rotation après exposition ;
- sauvegarde protégée de la clé de chiffrement MFA.
