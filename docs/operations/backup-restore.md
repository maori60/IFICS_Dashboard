# Sauvegarde et restauration — IFICS Platform V1

Une sauvegarde IFICS n’est complète que si elle contient **la base PostgreSQL et le volume des fichiers uploadés**. Une copie située uniquement sur le disque du serveur ne constitue pas une stratégie de reprise après sinistre.

## Contenu d’un backup

`scripts/backup.sh` produit un dossier horodaté :

```text
backups/ifics-YYYYMMDDTHHMMSSZ/
├── database.dump
├── uploads.tar.gz
├── metadata.txt
└── SHA256SUMS
```

- `database.dump` : `pg_dump` au format custom ;
- `uploads.tar.gz` : documents et fichiers stockés ;
- `metadata.txt` : date UTC et commit Git ;
- `SHA256SUMS` : contrôle d’intégrité.

## Créer un backup

```bash
cd /opt/ifics
make backup
```

Variables optionnelles :

```bash
BACKUP_DIR=/srv/ifics-backups BACKUP_RETENTION_DAYS=21 make backup
```

Le script supprime les dossiers locaux dépassant la rétention demandée. Cela ne doit pas supprimer automatiquement vos copies externes selon la même politique sans validation.

## Stratégie recommandée

Pour une petite infrastructure self-hosted :

- backup local quotidien ;
- réplication quotidienne chiffrée vers un autre stockage/machine ;
- plusieurs générations historiques ;
- au moins une copie inaccessible en écriture permanente depuis l’application ;
- test de restauration périodique sur un environnement isolé.

L’objectif est d’éviter qu’une panne disque, un ransomware, une erreur humaine ou un compte serveur compromis puisse détruire simultanément la production et toutes ses sauvegardes.

## Vérifier un backup

```bash
cd /srv/ifics-backups/ifics-YYYYMMDDTHHMMSSZ
sha256sum -c SHA256SUMS
```

Tous les fichiers doivent être `OK`.

## Restauration

**Cette opération remplace les données courantes.** Commencez par faire un backup de l’état actuel lorsque c’est encore possible.

```bash
cd /opt/ifics
RESTORE_CONFIRM=YES make restore BACKUP=/srv/ifics-backups/ifics-YYYYMMDDTHHMMSSZ
```

Le script :

1. vérifie les checksums ;
2. arrête l’application pour empêcher les écritures ;
3. attend PostgreSQL ;
4. recrée le schéma `public` ;
5. restaure le dump PostgreSQL ;
6. restaure le volume des uploads ;
7. applique les migrations plus récentes éventuellement présentes dans le code ;
8. redémarre l’application.

Contrôle final :

```bash
curl -fsS http://127.0.0.1:3000/api/ready
```

Puis vérifiez manuellement un échantillon de projets, documents, comptes et pièces jointes.

## Test de restauration sans toucher à la production

Le test de reprise doit idéalement être réalisé sur une seconde machine ou une VM isolée :

1. cloner le même tag/commit IFICS ;
2. utiliser un `.env` de test et un nom de projet Compose différent ;
3. démarrer une base vide ;
4. restaurer le backup ;
5. lancer `npm run db:migrate` dans le conteneur ;
6. contrôler `/api/ready` et plusieurs données métier ;
7. détruire l’environnement de test.

Un backup qui n’a jamais été restauré avec succès doit être considéré comme **non vérifié**.

## Rotation des secrets après incident

Si la restauration fait suite à une compromission :

- régénérer le mot de passe PostgreSQL ;
- régénérer `APP_ENCRYPTION_KEY` uniquement avec une procédure de migration des secrets MFA chiffrés — ne jamais la changer brutalement sur une base contenant des MFA actifs ;
- régénérer `IP_HASH_PEPPER` si nécessaire ;
- régénérer `INTERNAL_JOB_TOKEN` ;
- changer les identifiants SMTP ;
- révoquer les sessions actives ;
- imposer les resets de comptes concernés ;
- examiner les audits avant remise en ligne.

### Attention à APP_ENCRYPTION_KEY

Cette clé protège notamment les secrets MFA stockés. La perdre peut empêcher le déchiffrement des facteurs existants. Conservez-en une copie dans un gestionnaire de secrets sécurisé distinct du serveur et des backups applicatifs ordinaires.
