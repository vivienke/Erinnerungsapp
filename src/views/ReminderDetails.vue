<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Erinnerung</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card v-if="reminder">
        <ion-card-header>
          <ion-card-title>{{ reminder.text }}</ion-card-title>
          <ion-card-subtitle v-if="reminder.date || reminder.time">
            {{ formatDateTime(reminder.date, reminder.time) }}
          </ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-item lines="none">
            <ion-label>
              <h3>Datum</h3>
              <p>{{ formatDateString(reminder.date) || 'Kein Datum' }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <h3>Uhrzeit</h3>
              <p>{{ formatTimeString(reminder.time) || 'Keine Uhrzeit' }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <h3>Beschreibung</h3>
              <p>{{ reminder.description ?? 'Keine Beschreibung' }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <h3>Benachrichtigung</h3>
              <p>{{ reminder.notificationOffsetMinutes !== undefined ? notificationLabel(reminder.notificationOffsetMinutes) : 'Keine' }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <h3>Status</h3>
              <p>{{ reminder.done ? 'Erledigt' : 'Offen' }}</p>
            </ion-label>
          </ion-item>
        </ion-card-content>
        <ion-footer class="detail-actions">
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button color="danger" fill="outline" @click="deleteReminder">Löschen</ion-button>
            </ion-buttons>
            <ion-buttons slot="end">
              <ion-button color="primary" @click="editReminder(reminder.id)">Bearbeiten</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-footer>
      </ion-card>
      <div v-else class="ion-text-center ion-padding-top">
        <p>Erinnerung nicht gefunden.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonPage,
  IonToolbar,
} from '@ionic/vue';
import { getReminder, removeReminder } from '@/services/reminder.service';

interface Reminder {
  id: string;
  text: string;
  date?: string;
  time?: string;
  description?: string;
  done?: boolean;
  notificationOffsetMinutes?: number;
}

const router = useRouter();
const route = useRoute();
const reminder = ref<Reminder | null>(null);

const parseDate = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const formatDateString = (value?: string) => {
  if (!value) {
    return '';
  }
  const date = parseDate(value);
  if (!date) {
    return value.replace('T', ' ').split('.')[0];
  }
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatTimeString = (value?: string) => {
  if (!value) {
    return '';
  }
  const match = value.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : value.replace('T', ' ').split('.')[0];
};

const formatDateTime = (date?: string, time?: string) => {
  if (time) {
    return formatTimeString(time);
  }
  if (date) {
    return formatDateString(date);
  }
  return '';
};

const notificationLabel = (minutes: number) => {
  if (minutes === 10) return '10 Minuten davor';
  if (minutes === 60) return '1 Stunde davor';
  if (minutes === 1440) return '1 Tag davor';
  return `${minutes} Minuten davor`;
};

const editReminder = (id: string) => {
  router.push(`/reminder/${id}/edit`);
};

const deleteReminder = async () => {
  if (!reminder.value) {
    return;
  }

  await removeReminder(reminder.value.id);
  router.replace('/home');
};

onMounted(async () => {
  const id = route.params.id as string;
  reminder.value = id ? await getReminder(id) ?? null : null;
});
</script>

<style scoped>
ion-card {
  min-height: 60vh;
}
</style>
