# Gazelle Comptabilité - La Gazelle d'Or

Application web professionnelle de comptabilité automatique pour le restaurant "La Gazelle d'Or" situé à Genève.

## Informations projet

- **Nom** : Gazelle Comptabilité
- **Client** : Restaurant La Gazelle d'Or, Genève
- **Langue** : Français
- **Devise** : CHF (Franc suisse)
- **Stack** : React 18, TypeScript, Vite, Tailwind CSS, Zustand, Recharts, React Router DOM
- **Build** : `pnpm run build`

## Design

- Palette : Doré (#d4932a), Noir (#1a1a1a), Blanc cassé (#FAF8F5)
- Typographie : Inter
- Interface sobre, professionnelle, adaptée restaurateur

## Architecture

```
src/
├── App.tsx              # Routes principales
├── layouts/Layout.tsx   # Sidebar + contenu
├── pages/
│   ├── Dashboard.tsx         # Tableau de bord
│   ├── Transactions.tsx      # Transactions bancaires + import CSV
│   ├── Invoices.tsx          # Liste des factures
│   ├── InvoiceScan.tsx       # Scan/import OCR de factures
│   ├── Suppliers.tsx         # Fournisseurs
│   ├── Categories.tsx        # Plan comptable
│   ├── IncomeStatement.tsx   # Compte de résultat automatique
│   ├── BalanceSheetPage.tsx  # Bilan simplifié
│   ├── VATPage.tsx           # Gestion TVA suisse
│   ├── Exports.tsx           # Exports CSV/PDF
│   └── Settings.tsx          # Paramètres & connexion bancaire
├── store/index.ts       # State Zustand avec données démo
└── types/index.ts       # Types TypeScript
```

## Fonctionnalités MVP implémentées

1. **Tableau de bord** — CA, dépenses, résultat net, TVA, solde, alertes, graphiques
2. **Import CSV** — Import manuel de transactions bancaires
3. **Factures** — Liste, filtrage, statut de paiement
4. **Scan OCR** — Upload + extraction simulée avec correction manuelle
5. **Catégorisation** — Classification automatique par mots-clés
6. **Compte de résultat** — Génération automatique (CA → marge → EBITDA → résultat)
7. **Bilan** — Actifs/Passifs avec mise à jour automatique
8. **TVA suisse** — Collectée, récupérable, nette à payer
9. **Exports** — CSV transactions, CSV factures, compte de résultat
10. **Paramètres** — Config restaurant, connexion bancaire, sécurité

## État des données

- Les données de démonstration (transactions, factures, fournisseurs, alertes, graphiques mensuels) ont été supprimées.
- L'application démarre avec un état vide, prête à recevoir de vraies données.
- Le plan comptable (catégories) est conservé comme référentiel structurel.

## Contraintes

- L'application ne remplace pas une fiduciaire
- Mention obligatoire sur toutes les pages de résultats financiers
- Données soumises à validation humaine avant déclaration

## OCR Engine

- **Tesseract.js v7** (open source, exécution navigateur)
- Langues supportées : français, allemand, anglais (fra+deu+eng)
- Parseur intelligent pour extraction : fournisseur, n° facture, dates, montants HT/TVA/TTC, devise, IBAN, catégorie
- Catégorisation automatique par mots-clés détectés dans le texte OCR
- Affichage de la confiance OCR + texte brut pour vérification
- Fichier : `src/utils/ocrEngine.ts`
- **Pré-traitement image v2 (29.05.2026)** — Pipeline amélioré :
  - Correction orientation EXIF (photos smartphone)
  - Balance des blancs automatique (gray-world)
  - Upscaling progressif (cible 2000px, étapes 2x)
  - Auto-crop des bordures sombres (documents photographiés)
  - Binarisation Sauvola adaptative (éclairage inégal)
  - Binarisation adaptative locale (alternative)
  - Débruitage multi-passes (médian 3x3)
  - Netteté réglable (unsharp mask paramétrable)
  - Nettoyage morphologique (ouverture + fermeture, bruit sel/poivre)
  - Nouveau contraste perceptuel (ITU-R BT.709)
  - Fichier : `src/utils/imagePreprocess.ts`
- **Optimisation performance v3 (29.05.2026)** :
  - Boucle pixel fusionnée : WB + grayscale + brightness + contrast en 1 seul passage (vs 5 avant)
  - Filtre médian par réseau de tri (25 compare-swap, zéro allocation par pixel)
  - Buffers ping-pong (denoise/morphologie) : réutilisation mémoire au lieu de 6 allocations
  - Travail en buffer mono-canal Uint8 (pas de surcharge RGBA)
  - Résolution de travail plafonnée (1600px) pour les opérations lourdes
  - Upscale nearest-neighbor du binaire final pour l'OCR (bords nets)
  - Un seul getImageData/putImageData (pas d'allers-retours canvas)
  - URL.createObjectURL au lieu de toDataURL (évite l'encodage base64)
  - Support Web Worker (OffscreenCanvas) — traitement non-bloquant du thread principal
  - LUT pré-calculée pour brightness+contrast
  - Morphologie séparable : sommes horizontales par ligne au lieu de boucles 3×3 imbriquées
- **Améliorations parseur (28.05.2026)** :
  - Fournisseur : nettoyage IBAN/compte du nom, ignore sections QR-bill
  - N° Facture : exclut GLN (76...), supporte "Facture - Patient", "No Concordat"
  - Dates : validation année 2000-2030, pattern suisse "Ville, le DD.MM.YYYY"
  - Montants : priorité "Total Facture CHF", gestion solde, plus grand montant en fallback
  - Devise : détection contextuelle (Total Facture, Monnaie QR, localités suisses), CHF par défaut
  - Catégorie : ajout "Santé / Médical" pour factures cliniques/hospitalières

## IA Vision OCR (29.05.2026)

- **GPT-4o / Gemini 2.5 Flash** via OpenAI API ou Youware AI proxy
- Packages : `ai`, `@ai-sdk/openai`, `zod`
- Fichier : `src/utils/aiVisionOCR.ts`
- Utilise `generateObject` avec schéma Zod typé (supplier, invoiceNumber, date, dueDate, amountHT, tva, amountTTC, currency, iban, paymentTerms, category)
- Méthode principale dans InvoiceScan.tsx, Tesseract.js gardé en repli hors-ligne
- **Configuration locale** : clé API OpenAI stockée dans `.env` (`VITE_OPENAI_API_KEY`)
- Le code détecte automatiquement l'environnement (local vs Youware) et route vers la bonne API
- Fichier `.env.example` fourni comme template

## Évolutions futures

- Connexion API bancaire réelle (Bridge, Salt Edge, Plaid, Open Banking)
- Rapprochement bancaire intelligent
- Authentification multi-rôles
- Export PDF natif avec jsPDF
- Base de données backend (Supabase/Youbase)
