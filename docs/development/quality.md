# Qualité, tests et gates CI — IFICS Platform V1

## Runtime supporté

- Node.js 22
- Nuxt 4.5+
- Prisma 7.10+
- PostgreSQL 17 pour la validation des migrations et la production recommandée
- installation déterministe avec `npm ci`

Le lockfile fait foi pour une livraison donnée.

## Commandes locales

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run quality
npm run security:audit
npm run build
npm run ci
```

`npm run ci` enchaîne le gate qualité, l’audit des dépendances de production et le build.

## ESLint

Le lint est bloquant avec :

```text
eslint . --max-warnings=0
```

La dette historique de warnings tolérés pendant le socle M1 a été supprimée. La V1 n’accepte plus de nouveau warning ESLint.

## TypeScript

La vérification utilise :

```bash
nuxt typecheck
```

Elle est bloquante dans le Completion Gate et dans le Release Gate.

## Tests unitaires

Vitest/V8 couvre notamment :

- validation des variables d’environnement requises ;
- politique de mot de passe ;
- hash/vérification scrypt ;
- chiffrement/déchiffrement AES-256-GCM ;
- génération/vérification TOTP ;
- hash des tokens opaques.

Les tests unitaires ne remplacent pas les smoke tests avec PostgreSQL réel.

## Sécurité des dépendances

Le gate exécute :

```bash
npm audit --omit=dev --audit-level=high
```

Les vulnérabilités de production **high** et **critical** bloquent la livraison.

La V1 a été durcie sans `npm audit fix --force` :

- Nodemailer a été migré sur la branche 10 avec types TypeScript intégrés ;
- `@types/nodemailer` a été retiré ;
- les dépendances transitives vulnérables `deepmerge-ts` et `mysql2` utilisées par l’outillage Prisma sont contraintes vers des versions corrigées ;
- Prisma reste sur la branche 7 afin d’éviter une migration majeure non nécessaire à la V1.

Toute modification de ces overrides doit repasser l’ensemble du gate Prisma + lint + typecheck + tests + audit + build.

## Completion Gate

`.github/workflows/completion-gate.yml` s’exécute sur la branche de finalisation, sur `main` et sur les pull requests vers `main`.

Étapes :

1. `npm ci` ;
2. `prisma validate` ;
3. `prisma generate` ;
4. ESLint zéro warning ;
5. Nuxt typecheck ;
6. tests avec couverture ;
7. audit production high/critical ;
8. build Nuxt/Nitro.

## Release Gate

`.github/workflows/release-gate.yml` ajoute une preuve d’exécution :

1. PostgreSQL 17 réel ;
2. génération Prisma ;
3. application de **tout l’historique** des migrations avec `prisma migrate deploy` ;
4. `prisma migrate status` ;
5. seed association/rôles/admin CI ;
6. Completion Gate complet ;
7. validation syntaxique des scripts backup/restore/job ;
8. validation Docker Compose ;
9. démarrage du serveur Nitro ;
10. `/api/ready` ;
11. rendu de la page publique ;
12. API publique ;
13. login admin ;
14. confirmation que le MFA doit être configuré ;
15. confirmation qu’un endpoint sensible reste refusé avant MFA ;
16. exécution du job interne avec token éphémère.

Les secrets utilisés dans ce workflow sont générés à la volée et ne sont pas stockés dans le dépôt.

## Docker Dev Smoke

Le workflow Docker vérifie séparément :

- construction de l’image de développement ;
- PostgreSQL ;
- migrations ;
- seed explicite ;
- démarrage HTTP ;
- persistance des uploads lors d’une recréation du conteneur app ;
- absence de reseed automatique ;
- validation du Compose de production ;
- construction de l’image production.

## Règles de livraison

Une livraison ne doit pas être déclarée validée si le commit final n’a pas passé les gates applicables.

Ne pas :

- réduire un seuil pour masquer une régression ;
- utiliser `npm audit fix --force` sans revue ;
- utiliser `prisma db push` en production ;
- modifier manuellement une migration déjà appliquée ;
- ignorer un échec de Release Gate sous prétexte que le build passe.
