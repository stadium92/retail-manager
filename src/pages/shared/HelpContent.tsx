export const HELP_CONTENT: Record<string, string> = {
  fr: `# Guide Complet Djati

Bienvenue dans votre assistant de gestion. Ce document détaille le fonctionnement réel de votre application.

## 🚀 Concept "Offline-First"
Djati est conçu pour ne jamais interrompre votre travail, même sans connexion :
1.  **Saisie Instantanée** : Toutes vos ventes et modifications de stock sont enregistrées immédiatement dans votre base de données locale (LocalBridge).
2.  **File d'Attente** : Si vous êtes hors ligne, les transactions sont mises en attente.
3.  **Auto-Synchro** : Dès qu'une connexion internet est détectée, l'application synchronise automatiquement les données vers le cloud (Supabase).
4.  **Indicateur de Statut** : Surveillez l'icône Wifi en bas à droite pour connaître l'état de synchronisation.

## ⌨️ Maîtrise du Clavier (Interface Sanifère)
L'interface de vente est optimisée pour une saisie ultra-rapide sans souris :
*   **F2** : Valider la ligne actuelle.
*   **F3** : Rechercher un produit par nom (ou Cmd+K).
*   **F4** : Ouvrir la fenêtre de paiement et finaliser la vente.
*   **F8** : Insérer une ligne vide ou un commentaire.
*   **F11** : Imprimer le dernier ticket.
*   **F12** : Accéder rapidement à la fermeture de caisse.
*   **ESC (Échap)** : Annuler l'action en cours ou vider le panier.
*   **ENTRÉE** : Ajouter un produit après avoir saisi son code-barres.

## 📦 Gestion avancée des Stocks
*   **Listing de Stock** : Vue d'ensemble de vos références. Un produit devient **Orange** (Stock Bas) ou **Rouge** (Rupture) selon son "Seuil" (Threshold) configuré.
*   **Régularisation** : Utilisé pour ajuster ponctuellement un stock (ex: casse, vol, don).
*   **Inventaire Physique** : Procédure complète pour compter tous les articles et mettre à jour le système massivement.
*   **Valorisation** : Calcule la valeur totale de votre magasin au prix d'achat et de vente pour estimer votre marge potentielle.

## 💳 Ventes et Rapports
*   **Vente Détail** : Pour les ventes rapides au comptoir.
*   **Facturation** : Permet de lier une vente à un client et de gérer les règlements différés (crédits).
*   **Proforma** : Génère un devis sans déduire les produits du stock.
*   **Situation Client** : Retrouvez l'historique complet des achats et les soldes de vos clients.

## 🛠️ Support & Dépannage
En cas de comportement inhabituel :
1. Vérifiez que l'icône Wifi n'est pas barrée.
2. Utilisez le bouton **"Signaler un Bug"** pour nous transmettre vos journaux techniques.
3. Allez dans **Programme > Synchronisation** pour forcer une mise à jour manuelle des données.

## ⚖️ CONTRAT DE LICENCE ET DE PRESTATION DE SERVICES
*(Réf: JATI-SRL-2026-001)*

---

### 📌 ARTICLE 1 : DÉFINITIONS PRÉALABLES
> * **Logiciel** : L'ensemble de la solution « Djati Djati », incluant le moteur de base de données local, l'interface utilisateur, et les modules de synchronisation cloud.
> * **Services Cloud** : Services d'hébergement et de sauvegarde distante permettant la pérennité des données en cas de panne matérielle.
> * **Intelligence Artificielle (IA)** : Algorithmes de traitement du langage naturel et d'analyse prédictive intégrés au Logiciel pour assister la gestion.
> * **Anomalie** : Tout bug reproductible empêchant l'utilisation normale d'une fonctionnalité majeure du Logiciel.

### 📜 ARTICLE 2 : CONCESSION DE LICENCE
> Djati Tech concède au Client un droit d'utilisation personnel, non-exclusif et non-transférable du Logiciel. Cette licence est limitée à l'usage interne du Client pour son propre commerce. Le Client s'interdit formellement de sous-licencier, déléguer ou céder ce droit à un tiers.

### 🛡️ ARTICLE 3 : PROPRIÉTÉ INTELLECTUELLE ET RESTRICTIONS
> Le Logiciel, son code source, son design graphique et sa documentation sont protégés par les lois sur le droit d'auteur. Le Client s'engage expressément à :
> * Ne pas tenter de copier, modifier, adapter, ou créer des œuvres dérivées.
> * Ne pas effectuer d'ingénierie inverse (Reverse Engineering).
> * Ne pas contourner les mesures techniques de protection (clés d'activation, DRM).

### 💰 ARTICLE 4 : CONDITIONS FINANCIÈRES ET SUSPENSION
> Tout défaut de paiement à l'échéance convenue entraîne de plein droit, après une mise en demeure restée infructueuse pendant 10 jours, la suspension de l'accès aux mises à jour et aux services de synchronisation cloud.

### 🤝 ARTICLE 5 : ACCOMPAGNEMENT, FORMATION ET SUPPORT
> Djati Tech assure la formation initiale et s'efforce de corriger les Anomalies bloquantes dans un délai raisonnable. Le support ne couvre pas les problèmes liés à des logiciels tiers (Système d'exploitation Windows, antivirus) ou à une mauvaise manipulation des données par le Client.

### 💻 ARTICLE 6 : ENVIRONNEMENT TECHNIQUE ET PRÉREQUIS
> Le Client est responsable de la conformité de son matériel informatique. Djati Tech ne peut être tenu responsable d'une lenteur ou d'un dysfonctionnement dû à un matériel obsolète, une infection virale ou une instabilité électrique majeure sans protection (onduleur).

### 🤖 ARTICLE 7 : CLAUSE DE NON-RESPONSABILITÉ RELATIVE À L'IA
> **AVERTISSEMENT** : L'IA peut parfois produire des résultats erronés ou imprévisibles. **Djati Tech ne pourra être tenu responsable des conséquences de décisions commerciales prises uniquement sur la base des suggestions de l'IA.** Le Client conserve la responsabilité finale de valider chaque inventaire, chaque commande fournisseur et chaque prix de vente.

### 🔒 ARTICLE 8 : PROTECTION DES DONNÉES ET CONFIDENTIALITÉ
> * **Propriété des Données** : Le Client reste propriétaire exclusif de ses données commerciales. Djati Tech s'engage à ne pas consulter les listes de prix ou les profits du Client sans son accord explicite.
> * **Données Techniques** : Le Client autorise Djati Tech à collecter des métadonnées anonymisées (désignations produits sans prix, noms de catégories) pour enrichir la base de connaissances globale.
> * **Sécurité** : Djati Tech déploie des protocoles de chiffrement, mais le Client reconnaît qu'aucun système n'est inviolable et accepte les risques liés à l'usage d'internet.

### ⚖️ ARTICLE 9 : LIMITATION DE RESPONSABILITÉ GÉNÉRALE
> En aucun cas Djati Tech ne sera responsable des dommages indirects (perte de revenus, interruption d'activité, perte de données matérielle). **PLAFOND DE DÉDOMMAGEMENT** : La responsabilité totale de Djati Tech ne pourra excéder le montant net payé par le Client au titre de la licence pour l'année en cours.

### ⏱️ ARTICLE 10 : DURÉE ET RÉSILIATION
> Le Contrat est conclu pour 12 mois, renouvelable par tacite reconduction. Résiliation possible avec préavis de 30 jours. En cas de résiliation pour faute du Client, aucun remboursement ne sera effectué.

### 🤫 ARTICLE 11 : CONFIDENTIALITÉ RÉCIPROQUE
> Le Client s'interdit de divulguer à des tiers les méthodes de travail, l'interface d'administration ou les tarifs préférentiels accordés par Djati Tech.

### ⚡ ARTICLE 12 : FORCE MAJEURE
> Djati Tech ne pourra être tenu responsable des retards ou inexécutions résultant de cas de force majeure (coupures d'électricité, de réseau internet national ou troubles civils).

### 🇲🇱 ARTICLE 13 : DROIT APPLICABLE ET LITIGES
> Le présent contrat est régi par le droit de la République du Mali. En cas de contestation, compétence exclusive est attribuée aux tribunaux de Bamako.`,

  en: `# Djati Complete Guide

Welcome to your management assistant. This document details the actual operations of your application.

## 🚀 "Offline-First" Concept
Djati is designed to never interrupt your work, even without a connection:
1.  **Instant Entry**: All your sales and stock changes are saved immediately to your local database (LocalBridge).
2.  **Queue System**: If you are offline, transactions are queued.
3.  **Auto-Sync**: As soon as an internet connection is detected, the app automatically syncs data to the cloud (Supabase).
4.  **Status Indicator**: Monitor the Wifi icon at the bottom right to check sync status.

## ⌨️ Keyboard Mastery (Sanifere Interface)
The sales interface is optimized for ultra-fast entry without a mouse:
*   **F2**: Validate current line.
*   **F3**: Search for a product by name (or Cmd+K).
*   **F4**: Open the payment window and finalize the sale.
*   **F8**: Insert a blank line or a comment.
*   **F11**: Print the last receipt.
*   **F12**: Quick access to cash closing.
*   **ESC**: Cancel current action or clear the cart.
*   **ENTER**: Add a product after entering its barcode.

## 📦 Advanced Inventory Management
*   **Stock Listing**: Overview of your items. A product turns **Orange** (Low Stock) or **Red** (Out of Stock) based on its configured "Threshold".
*   **Regularization**: Used for one-off stock adjustments (e.g., breakage, theft, gift).
*   **Physical Inventory**: Complete procedure to count all items and perform a mass system update.
*   **Valuation**: Calculates the total value of your store at cost and retail prices to estimate your potential margin.

## 💳 Sales and Reports
*   **Retail Sale**: For fast counter sales.
*   **Invoicing**: Link a sale to a customer and manage deferred payments (credits).
*   **Proforma**: Generates a quote without deducting products from stock.
*   **Customer Status**: Find complete purchase history and balances for your customers.

## 🛠️ Support & Troubleshooting
In case of unusual behavior:
1. Check that the Wifi icon is not crossed out.
2. Use the **"Report a Bug"** button to send us your technical logs.
3. Go to **Program > Synchronization** to force a manual data update.

---

## ⚖️ License Terms & Agreement
*(Version Djati-SRL-2026-001)*

### 🛡️ Ownership
> The software remains the exclusive property of **Djati Technologies SARL**. Any copying, reverse engineering, or resale is strictly prohibited.

### ⚖️ Liability & AI
> Djati Technologies is not responsible for lost revenue or calculation errors made by the AI. You must verify all outputs. Total liability is limited to the amount you paid for the license.

### 🔒 Privacy Guarantee
> We **never** collect your purchase prices, selling prices, profits, or sales figures. Only product names and categories are synced to optimize the system's global intelligence.`,

  bm: `# Djati Baara Gafɛ

I bisimila. Nin gafɛ in bɛna baara kɛcogo bɛɛ jira i ye.

## 🚀 "Offline-First" (Internet tɛ)
Djati dilara ka baara kɛ waati bɛɛ, hali ni internet tɛ yen:
1.  **Sɔrɔ Teliya**: I ka sɔrɔ ni i ka bɛnɛ yɛlɛmali bɛ mara i ka masini kɔnɔ teliya la (LocalBridge).
2.  **Kɔnɔni**: Ni internet tɛ yen, baara bɛ kɔnɔ.
3.  **Yɛlɛmali**: Ni internet sɔrɔra, app b'a yɛrɛ yɛlɛma ka taa cloud la (Supabase).
4.  **Wifi Ja**: I bɛ se ka Wifi ja lajɛ duguma fɛ k'a dɔn ni yɛlɛmali bɛ kɛ.

## ⌨️ Clavier Baara (Sanifere Interface)
Sɔrɔ yɔrɔ dilara k'a teliya ni clavier ye:
*   **F2** : Ka sɔn fɛn kan.
*   **F3** : Ka fɛn ɲini ni a tɔgɔ ye.
*   **F4** : Ka wari sara yɔrɔ dayɛlɛ ani ka sɔrɔ da.
*   **F8** : Ka fɛn dɔ fara a kan.
*   **F11** : Ka papye bɔ.
*   **F12** : Ka caisse da.
*   **ESC** : Ka baara dabila.
*   **ENTER** : Ka fɛn fara a kan ni i ye code-barres sɛbɛ.

## 📦 Bɛnɛ Ɲɛnabɔli
*   **Bɛnɛ Lajɛ**: I ka fɛnw bɛɛ jira. A bɛ ja **Orange** (A dɔgɔyara) wala **Rouge** (A banna) n'a dɔgɔyara kojuguman.
*   **Inventaire**: Ka i ka fɛnw jatɛ ka masini kunnafoniw yɛlɛma.
*   **Valorisation**: Ka i ka magasin fɛnw bɛɛ sɔngɔ dɔn.`
};
