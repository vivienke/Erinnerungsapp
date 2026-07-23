import { AppShortcuts } from '@capawesome/capacitor-app-shortcuts';

const SHORTCUT_ID_NEW = 'new_reminder';

export async function initializeAppShortcuts(onShortcutSelected: () => void) {
  try {
    await AppShortcuts.set({
      shortcuts: [
        {
          id: SHORTCUT_ID_NEW,
          title: 'Neue Erinnerung',
          description: 'Neue Erinnerung hinzufügen',
        },
      ],
    });

    await AppShortcuts.addListener('click', (event) => {
      if (event.shortcutId === SHORTCUT_ID_NEW) {
        onShortcutSelected();
      }
    });
  } catch (error) {
    console.warn('App Shortcuts is not available on this platform.', error);
  }
}
