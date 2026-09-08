# Docker — développement et validation IFICS V1

## Objectif

Le développement Docker reproduit les composants essentiels de la V1 sans exposer le serveur au réseau :

- Nuxt en mode développement avec hot reload ;
- PostgreSQL 17 ;
- migrations Prisma versionnées ;
- seed explicite ;
- volumes persistants pour DB, dépendances et uploads ;
- secrets de développement fournis par `.env` ;
- ports liés à `127.0.0.1`.

## Fichiers

- `Dockerfile.dev` : image développement ;
- `docker-compose.dev.yml` : stack développement ;
- `Dockerfile` : image de production ;
- `docker-compose.yml` : stack self-hosted de production ;
- `.env.example` : modèle de configuration ;
- `.github/workflows/docker-dev-smoke.yml` : smoke test Docker automatisé.

## Premier démarrage

```bash
cp .env.example .env
```

Pour un environnement local, remplacez toutes les valeurs `CHANGE_ME`. `DATABASE_URL` doit utiliser le hostname Docker `db`.

Puis :

```bash
make dev-init
```

Cette commande :

1. construit l’image dev ;
2. démarre PostgreSQL ;
3. génère Prisma ;
4. applique les migrations commitées ;
5. exécute le seed ;
6. démarre Nuxt.

Aucun seed ni mutation de schéma n’est exécuté automatiquement lors d’un simple restart du conteneur.

## Commandes courantes

```bash
make dev-up
make dev-down
make dev-restart
make dev-logs
make dev-ps
make dev-migrate
make dev-generate
make dev-seed
```

Reset destructif du développement uniquement :

```bash
make dev-reset
```

Suppression complète des conteneurs/volumes dev :

```bash
make dev-clean
```

## Volumes

- `postgres_dev_data` : données PostgreSQL ;
- `node_modules_dev` : dépendances du conteneur ;
- `uploads_dev` : documents uploadés.

Le code source est bind-mounté dans `/app`.

## Réseau

Par défaut :

- Nuxt : `127.0.0.1:3000` ;
- PostgreSQL : `127.0.0.1:5432` en développement seulement.

La stack de production ne publie pas PostgreSQL et publie Nitro uniquement sur `127.0.0.1` derrière le reverse proxy.

## Variables de sécurité en développement

Même en local, les fonctions MFA et sécurité ont besoin de :

- `APP_ENCRYPTION_KEY` ;
- `IP_HASH_PEPPER` ;
- `INTERNAL_JOB_TOKEN` ;
- `APP_BASE_URL`.

Utilisez des valeurs uniques de développement. Ne réutilisez jamais les secrets de production.

## Prisma

Pour appliquer des migrations existantes :

```bash
make dev-migrate
```

`SHADOW_DATABASE_URL` n’est nécessaire que pour des opérations de génération de migration qui utilisent une shadow database. Il n’est pas requis par `prisma migrate deploy`.

En production, ne jamais utiliser `prisma db push`.

## Docker Dev Smoke

Le workflow vérifie :

1. syntaxe Compose dev ;
2. build de l’image dev ;
3. PostgreSQL 17 ;
4. génération Prisma ;
5. application des migrations ;
6. seed explicite ;
7. `/api/ready` ;
8. persistance des uploads après recréation de l’app ;
9. absence de reseed automatique ;
10. syntaxe Compose production ;
11. build de l’image production.

Le Release Gate complète ces tests par un démarrage runtime hors Docker avec PostgreSQL réel et des contrôles HTTP/authentification.

## Vérification locale

```bash
make dev-ps
curl -fsS http://127.0.0.1:${APP_PORT:-3000}/api/ready
```

L’état attendu est `db` sain, `app` sain, migrations appliquées et uploads persistants.

Pour la production Debian, voir `docs/operations/production-debian.md`.
