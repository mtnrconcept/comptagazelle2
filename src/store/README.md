# Store & persistance

Architecture cible retenue pour ce MVP : **persistance locale chiffrée dans IndexedDB**. Cette option évite de perdre les données comptables sans introduire de backend à opérer immédiatement. L'évolution cible reste une API backend avec base SQL lorsque l'application devra gérer plusieurs utilisateurs, des sauvegardes serveur et des contrôles d'accès centralisés.

## Tables persistantes

La migration IndexedDB `gazelle-comptabilite-vault` version 1 crée les object stores suivants, équivalents aux tables demandées :

- `invoices`
- `transactions`
- `suppliers`
- `categories`
- `documents`
- `accounting_entries`

Chaque enregistrement est sérialisé puis chiffré avec AES-GCM avant écriture. Les pages React consomment le store Zustand, qui charge les données au démarrage, applique les changements en mémoire de façon optimiste puis synchronise IndexedDB.

## Sauvegarde

La page Exports propose une **Sauvegarde complète JSON** incluant les six tables persistantes. Cette sauvegarde doit être téléchargée régulièrement et conservée hors de l'appareil pour pouvoir restaurer les données si le navigateur ou le poste est perdu.
