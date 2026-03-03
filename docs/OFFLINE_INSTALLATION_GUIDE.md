# 🛠️ Guide d'Installation Hors-Ligne (Offline Installation Guide)

Ce guide explique comment installer **Retail Manager** sur des ordinateurs qui n'ont pas d'accès à Internet ou qui utilisent d'anciennes versions de Windows.

---

## 1. WebView2 (Microsoft Edge Runtime)
Le problème le plus courant est l'absence de **WebView2**. C'est le moteur qui permet d'afficher l'interface de l'application.

### ⚠️ Note Importante :
L'installeur de Retail Manager n'inclut **pas** WebView2 pour rester léger. Vous devez l'installer manuellement depuis votre clé USB.

### Solution (Clé USB) :
Vous devez avoir ce fichier sur votre clé USB :
- **Installeur Standalone WebView2 (Evergreen Standalone)**
- Lien de téléchargement (à faire depuis un PC connecté) : [Microsoft WebView2 Fixed Version](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section) (Choisissez "Evergreen Standalone Installer").

---

## 2. Microsoft Visual C++ Redistributable (TRÈS IMPORTANT)
Les anciens ordinateurs (Windows 7, 8, ou Windows 10 non mis à jour) manquent souvent des bibliothèques C++. Sans cela, le moteur de base de données (SQLite) et le code Rust ne pourront pas démarrer.

**À mettre impérativement sur votre clé USB :**
- **Fichier :** `VC_redist.x64.exe` et `VC_redist.x86.exe` (Version 2015-2022).
- **Lien :** [Derniers téléchargements VC++ Redistributable](https://learn.microsoft.com/fr-fr/cpp/windows/latest-supported-vc-redist?view=msvc-170)

---

## 3. Universal C Runtime (CRT)
Sur les très vieux PC (Windows 7 ou 8), Windows peut demander la mise à jour "Universal C Runtime".
- Généralement incluse dans le pack Visual C++ ci-dessus, mais parfois nécessite une mise à jour Windows spécifique (KB2999226).

---

## 4. .NET Framework
Tauri n'en a pas besoin directement, mais certaines fonctions système de Windows peuvent le demander lors de l'installation des dépendances ci-dessus. 
- Avoir le **.NET Framework 4.8 Offline Installer** sur la clé USB est une bonne sécurité.

---

## 🏗️ Checklist pour votre clé USB d'installation :
1.  **`retail-manager_setup.msi`** (L'application)
2.  **`MicrosoftEdgeWebview2Setup.exe`** (Evergreen Standalone - **À installer en premier**)
3.  **`VC_redist.x64.exe`** (Visual C++ 2015-2022 - **À installer en premier**)
4.  **`VC_redist.x86.exe`** (Pour les vieux systèmes 32 bits)
5.  **`NDP48-x86-x64-AllOS-ENU.exe`** (.NET 4.8 Offline)

---

## 💡 Conseil Pro :
Avant d'installer Retail Manager sur un PC client "propre" (offline), installez toujours **Visual C++ Redistributable** et **WebView2 Standalone** en premier, puis lancez l'installeur de Retail Manager. Cela évite 100% des erreurs au premier lancement.
