# Déploiement de production — Debian

Ce document décrit le déploiement self-hosted recommandé d’IFICS Platform V1 sur un serveur Debian avec Docker Compose et un reverse proxy TLS.

## 1. Architecture réseau

```text
Internet
   |
80/443
   |
Caddy (hôte Debian, TLS)
   |
127.0.0.1:3000
   |
IFICS / Nuxt-Nitro (Docker)
   |
réseau Docker privé
   |
PostgreSQL 17 (aucun port publié sur l’hôte)
```

Ne publiez jamais PostgreSQL sur Internet. Le port applicatif 3000 reste lié à `127.0.0.1`; seuls 80/443 sont exposés via le reverse proxy.

## 2. Pré-requis

- Debian à jour ;
- Docker Engine et plugin Docker Compose ;
- Git ;
- un nom de domaine pointant vers le serveur ;
- Caddy ou un reverse proxy équivalent ;
- SMTP transactionnel recommandé pour invitations, reset de mot de passe et notifications de sécurité ;
- une destination de sauvegarde chiffrée située hors du serveur.

Vérifications :

```bash
docker --version
docker compose version
git --version
```

## 3. Installation

```bash
sudo mkdir -p /opt/ifics
sudo chown "$USER":"$USER" /opt/ifics
git clone https://github.com/maori60/IFICS_Dashboard.git /opt/ifics
cd /opt/ifics
git checkout main
cp .env.example .env
chmod 600 .env
```

Éditez `.env`. Remplacez toutes les valeurs `CHANGE_ME` et `ifics.example.org`.

Générez les secrets :

```bash
openssl rand -base64 32   # APP_ENCRYPTION_KEY
openssl rand -hex 32      # IP_HASH_PEPPER
openssl rand -hex 32      # INTERNAL_JOB_TOKEN
openssl rand -base64 36   # exemple de mot de passe PostgreSQL
```

`APP_BASE_URL` doit être l’origine HTTPS finale, par exemple `https://ifics.fr`.

## 4. Build, migration et association

```bash
cd /opt/ifics
docker compose build
docker compose up -d db
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run db:seed
```

Le seed sans `ADMIN_*` synchronise l’association IFICS et les rôles système sans créer de compte administrateur.

## 5. Création one-shot du premier administrateur

N’enregistrez pas le mot de passe bootstrap dans `.env`. Injectez-le uniquement pour cette commande :

```bash
read -r -p 'Email administrateur: ' ADMIN_EMAIL
read -r -s -p 'Mot de passe administrateur (16+ caractères): ' ADMIN_PASSWORD
echo

docker compose run --rm \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_FIRST_NAME="Administrateur" \
  -e ADMIN_LAST_NAME="IFICS" \
  app npm run db:seed

unset ADMIN_EMAIL ADMIN_PASSWORD
```

À la première connexion, le rôle administrateur doit configurer son MFA TOTP.

## 6. Démarrage et contrôle

```bash
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/ready
```

`/api/health` vérifie le processus HTTP. `/api/ready` vérifie aussi PostgreSQL.

## 7. Reverse proxy TLS avec Caddy

Installez Caddy sur l’hôte et partez de `deploy/Caddyfile.example`.

Exemple après remplacement du domaine :

```bash
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudoedit /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Une fois HTTPS actif, testez :

```bash
curl -I https://votre-domaine.example/
curl -fsS https://votre-domaine.example/api/ready
```

## 8. Pare-feu

Avec un accès SSH déjà testé, une politique simple peut n’autoriser publiquement que SSH, HTTP et HTTPS. N’ouvrez ni 3000 ni 5432 sur l’interface publique.

Adaptez les règles au firewall déjà utilisé sur la machine (nftables/UFW). Ne changez jamais les règles SSH sans disposer d’un accès de secours.

## 9. Job quotidien d’expiration documentaire

L’endpoint interne est protégé par `INTERNAL_JOB_TOKEN`. Créez un fichier root-only :

```bash
sudo install -m 600 /dev/null /etc/ifics-jobs.env
sudo sh -c 'printf "%s\n" "INTERNAL_JOB_TOKEN=VOTRE_TOKEN" > /etc/ifics-jobs.env'
```

Créez `/etc/systemd/system/ifics-document-expiry.service` :

```ini
[Unit]
Description=IFICS document expiry processing
After=docker.service

[Service]
Type=oneshot
EnvironmentFile=/etc/ifics-jobs.env
Environment=INTERNAL_BASE_URL=http://127.0.0.1:3000
WorkingDirectory=/opt/ifics
ExecStart=/bin/sh /opt/ifics/scripts/run-document-expiry.sh
```

Puis `/etc/systemd/system/ifics-document-expiry.timer` :

```ini
[Unit]
Description=Run IFICS document expiry daily

[Timer]
OnCalendar=*-*-* 06:15:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

Activez :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ifics-document-expiry.timer
systemctl list-timers | grep ifics
```

## 10. Sauvegardes

Effectuez au minimum une sauvegarde quotidienne de PostgreSQL et des uploads :

```bash
cd /opt/ifics
make backup
```

Le résultat local n’est qu’une première copie. Répliquez ensuite chaque dossier de backup vers une destination chiffrée hors machine. Voir `docs/operations/backup-restore.md`.

## 11. Mise à jour applicative

Avant toute mise à jour : sauvegarde + contrôle de l’espace disque.

```bash
cd /opt/ifics
make backup
git fetch --tags origin
git checkout main
git pull --ff-only
docker compose build
docker compose up -d db
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run db:seed
docker compose up -d app
make ready
```

Le seed est idempotent et resynchronise les rôles système. Aucun administrateur supplémentaire n’est créé sans injection explicite de `ADMIN_*`.

## 12. Contrôles après déploiement

- page publique accessible en HTTPS ;
- `/api/ready` retourne 200 ;
- login administrateur fonctionnel ;
- MFA obligatoire ;
- e-mail d’invitation/reset fonctionnel si SMTP configuré ;
- upload puis lecture d’un PDF de test ;
- accès `/dashboard/system` ;
- activation/désactivation du mode maintenance ;
- `make backup` réussi ;
- copie hors serveur confirmée ;
- logs Docker sans erreurs récurrentes.

## 13. Principes d’exploitation

- ne jamais exécuter `prisma db push` en production ;
- ne jamais exposer PostgreSQL ;
- ne jamais committer `.env`, uploads ou backups ;
- ne pas utiliser le serveur IFICS comme serveur SMTP ;
- garder Docker, Debian et les images à jour ;
- tester périodiquement une restauration complète ;
- conserver le MFA pour tous les comptes sensibles ;
- examiner les journaux d’audit et les échecs de connexion depuis le centre système.
