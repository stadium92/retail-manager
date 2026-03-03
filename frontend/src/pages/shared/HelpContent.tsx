export const HELP_CONTENT: Record<string, string> = {
  fr: `# Guide Complet Retail Manager

Bienvenue dans votre assistant de gestion. Ce document détaille le fonctionnement réel de votre application.

## 🚀 Concept "Offline-First"
Retail Manager est conçu pour ne jamais interrompre votre travail, même sans connexion :
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
3. Allez dans **Programme > Synchronisation** pour forcer une mise à jour manuelle des données.`,

  en: `# Retail Manager Complete Guide

Welcome to your management assistant. This document details the actual operations of your application.

## 🚀 "Offline-First" Concept
Retail Manager is designed to never interrupt your work, even without a connection:
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
3. Go to **Program > Synchronization** to force a manual data update.`,

  bm: `# Retail Manager Baara Gafɛ

I bisimila. Nin gafɛ in bɛna baara kɛcogo bɛɛ jira i ye.

## 🚀 "Offline-First" (Internet tɛ)
Retail Manager dilara ka baara kɛ waati bɛɛ, hali ni internet tɛ yen:
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
