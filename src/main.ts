import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonicVue, alertController } from '@ionic/vue';
import { ensureNotificationPermission, initializeReminderService } from '@/services/reminder.service';
import { initializeAppShortcuts } from '@/services/shortcut.service';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/* Theme variables */
import './theme/variables.css';
import './theme/global.css';

const app = createApp(App).use(IonicVue).use(router);

router.isReady().then(() => {
  app.mount('#app');
});

let permissionHintShown = false;

/**
 * Android only shows its permission dialog while the state is still "prompt".
 * After a denial the app can no longer re-ask programmatically, so the user is
 * told once how to re-enable it manually instead of silently getting no
 * notifications at all.
 */
async function checkNotificationPermission() {
  const permission = await ensureNotificationPermission();

  if (permission === 'granted') {
    // Reset so the hint can appear again if the user revokes it again later.
    permissionHintShown = false;
    return;
  }

  if (permission === 'denied' && !permissionHintShown) {
    permissionHintShown = true;
    const alert = await alertController.create({
      header: 'Benachrichtigungen deaktiviert',
      message:
        'Ohne die Benachrichtigungs-Berechtigung können keine Erinnerungen zugestellt werden. ' +
        'Du kannst sie in den Systemeinstellungen unter "Apps → Erinnerungsapp → Benachrichtigungen" wieder aktivieren.',
      buttons: ['Verstanden'],
    });
    await alert.present();
  }
}

async function initNativeServices() {
  if (Capacitor.getPlatform() === 'web') {
    return;
  }

  try {
    await initializeReminderService({
      onReminderCompleted: (id) => {
        window.dispatchEvent(new CustomEvent('reminderUpdated', { detail: id }));
      },
      onReminderOpened: (id) => {
        router.push(`/reminder/${id}`);
      },
    });
    await checkNotificationPermission();

    // Re-check when returning from the system settings, so granting the
    // permission there takes effect without restarting the app.
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkNotificationPermission();
      }
    });
  } catch (error) {
    console.warn('Reminder service initialization failed', error);
  }

  try {
    await initializeAppShortcuts(() => {
      router.push('/reminder/new');
    });
  } catch (error) {
    console.warn('App shortcuts initialization failed', error);
  }
}

initNativeServices();
