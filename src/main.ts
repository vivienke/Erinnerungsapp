import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonicVue } from '@ionic/vue';
import {
  hasRemindersNeedingNotificationPermission,
  initializeReminderService,
} from '@/services/reminder.service';
import { requestNotificationPermissionWithFeedback } from '@/services/notification-permission.service';
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

async function initServices() {
  try {
    await initializeReminderService({
      onReminderCompleted: (id) => {
        window.dispatchEvent(new CustomEvent('reminderUpdated', { detail: id }));
      },
      onReminderOpened: (id) => {
        router.push(`/reminder/${id}`);
      },
    });
    // Do not ask on an empty first launch. A startup prompt is only justified
    // when at least one open, future reminder actually expects a notification.
    if (await hasRemindersNeedingNotificationPermission()) {
      await requestNotificationPermissionWithFeedback();
    }

    // Re-check when returning from the system settings, so granting the
    // permission there takes effect without restarting the app.
    CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        if (await hasRemindersNeedingNotificationPermission()) {
          requestNotificationPermissionWithFeedback();
        }
      }
    });
  } catch (error) {
    console.warn('Reminder service initialization failed', error);
  }

  if (Capacitor.getPlatform() !== 'web') {
    try {
      await initializeAppShortcuts(() => {
        router.push('/reminder/new');
      });
    } catch (error) {
      console.warn('App shortcuts initialization failed', error);
    }
  }
}

initServices();
