import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import { Capacitor } from '@capacitor/core';
import { IonicVue } from '@ionic/vue';
import { initializeReminderService } from '@/services/reminder.service';
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

const app = createApp(App).use(IonicVue).use(router);

router.isReady().then(() => {
  app.mount('#app');
});

async function initNativeServices() {
  if (Capacitor.getPlatform() === 'web') {
    return;
  }

  try {
    await initializeReminderService((id) => {
      window.dispatchEvent(new CustomEvent('reminderDeleted', { detail: id }));
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
