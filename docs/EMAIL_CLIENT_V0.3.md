# Objet : Mise à jour Retail Manager v0.3.x - Correction des bugs et nouvelles options

Bonjour Aguibe,

Je t'envoie en pièce jointe la nouvelle version de l'application. Cette mise à jour est cruciale car elle règle enfin les problèmes de calcul et d'affichage qui bloquaient l'utilisation fluide du système.

## Corrections de bugs majeurs :
- **Stabilisation des prix :** Nous avons éliminé le "jittering" (sauts de prix). Les prix ne changent plus de manière imprévisible lors du passage entre les unités (Carton/Pièce).
- **Calcul des totaux :** Correction du bug des "totaux bizarres". Le système garantit désormais des calculs exacts à 100%.
- **Synchronisation & Recherche :** L'inventaire Master est maintenant fiable en temps réel et la fenêtre de recherche (F3) affiche correctement tous les articles.

## Améliorations et nouvelles options :
- **Nouvelles Unités :** Vous pouvez désormais gérer vos articles en **Paquets** et **Sachets**. (Note : la gestion du sous-conditionnement arrivera dans une version prochaine).
- **Rapidité de saisie :** Nouveau mode "Ajout Multiple" pour enregistrer des lots d'articles et fonction "Importer" pour dupliquer rapidement un article existant.
- **Contrôle :** Les vendeurs peuvent maintenant supprimer les commandes générées par erreur pour garder un historique propre.

## ⚠️ Étapes importantes pour l'installation :
1. **Autorisation Backend :** Au lancement, Windows peut vous demander d'autoriser le composant **"Node.js"** ou **"Local Backend"**. Il est **impératif d'accepter** cette autorisation, sinon l'application ne pourra pas communiquer avec la base de données.
2. **Nouvelle Activation :** Suite aux renforcements de sécurité, l'ancienne clé est obsolète. Envoyez-moi **l'ID qui s'affiche sur la page d'activation** de l'app ; je vous générerai une nouvelle clé personnalisée (ce sera l'occasion de recueillir vos premiers retours).

## Instructions de connexion :
- **Initialisation :** Sur l'écran de connexion (Sign-in), attendez 10 secondes avant de valider pour la synchronisation initiale.
- **Sécurité :** Votre mot de passe doit faire 8 caractères minimum (1 majuscule, 1 chiffre, 1 spécial). Exemple : Retail2026@

J'attends ton ID pour t'envoyer ta nouvelle clé !

Cordialement,

Mohamed N Coulibaly