import { useEffect } from 'react';

export function AppUpdater() {
  useEffect(() => {
    const runCheck = async () => {
      // Only applies inside the Tauri desktop shell - no-op in a plain
      // browser preview, where these plugins aren't available at all.
      if (!('__TAURI_INTERNALS__' in window)) return;

      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const { relaunch } = await import('@tauri-apps/plugin-process');
        const { ask, message } = await import('@tauri-apps/plugin-dialog');

        const update = await check();
        if (!update) return;

        const shouldInstall = await ask(
          `Une nouvelle version (${update.version}) est disponible. Installer maintenant ?`,
          { title: 'Mise a jour disponible', kind: 'info' }
        );
        if (!shouldInstall) return;

        await update.downloadAndInstall();
        await message('Mise a jour installee. L\'application va redemarrer.', { title: 'Mise a jour', kind: 'info' });
        await relaunch();
      } catch (e) {
        console.error('[AppUpdater] update check failed:', e);
      }
    };

    runCheck();
  }, []);

  return null;
}
