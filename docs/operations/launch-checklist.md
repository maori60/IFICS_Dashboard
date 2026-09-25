# Checklist de lancement IFICS V1.0

Cette checklist vise une mise en service opérationnelle. Elle ne transforme pas IFICS en logiciel comptable certifié ni en outil de déclaration fiscale automatisée.

## Avant ouverture

1. Sauvegarder la base et les uploads avec `make backup`.
2. Copier la sauvegarde vers un stockage chiffré hors serveur.
3. Exécuter `./scripts/preflight.sh`.
4. Exécuter les migrations de production avec `npm run db:migrate` dans le conteneur applicatif.
5. Vérifier `/api/health` et `/api/ready`.
6. Vérifier HTTPS, MFA administrateur et SMTP.
7. Tester création client → projet → facture → règlement.
8. Tester dépense → justificatif → soumission → validation → paiement.
9. Tester CRA → soumission → revue → document officiel → signature → client.
10. Vérifier une sauvegarde et une restauration sur une base de test.

## Paramètres usine

Le bouton **Restaurer les paramètres usine** réinitialise uniquement la configuration technique et visuelle. Il conserve les données métier, l'identité légale et les coordonnées bancaires. La confirmation `RESTAURER` et une session MFA validée sont obligatoires.

## Après ouverture

- surveiller les logs Docker ;
- vérifier les sauvegardes chaque jour ;
- traiter les alertes de documents expirants ;
- garder Debian, Docker et les images à jour ;
- ne jamais utiliser `prisma db push` en production.
