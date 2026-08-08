<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Erinnerung</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding" :fullscreen="true">
      <ion-card v-if="reminder">
        <!-- Date and time already have their own rows below, so repeating them
             as a subtitle here was duplication. -->
        <ion-card-header>
          <ion-card-title>{{ reminder.text }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item lines="none">
            <ion-label>
              <h3>Status</h3>
              <p>{{ reminder.done ? 'Erledigt' : 'Offen' }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <h3>Datum</h3>
              <p>{{ formatDateString(reminder.date) || 'Kein Datum' }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <h3>Uhrzeit</h3>
              <p>{{ reminder.time ? `${formatTimeString(reminder.time)} Uhr` : 'Keine Uhrzeit' }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <h3>Beschreibung</h3>
              <!-- The editor stores a trimmed string, so an omitted description
                   arrives as "" — which ?? would let through as a blank line. -->
              <p>{{ reminder.description || 'Keine Beschreibung' }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <h3>Benachrichtigung</h3>
              <!-- Without both a date and a time nothing is ever scheduled, so
                   showing a stored offset here would claim a notification that
                   does not exist. -->
              <p>{{ reminder.date && reminder.time ? notificationLabel(reminder.notificationOffsetMinutes, reminder.date, reminder.time) : 'Keine' }}</p>
            </ion-label>
          </ion-item>
        </ion-card-content>
        <div class="detail-actions">
          <ion-button expand="block" color="primary" @click="editReminder(reminder.id)">
            <ion-icon slot="start" :icon="create"></ion-icon>
            Bearbeiten
          </ion-button>
          <ion-button expand="block" color="danger" fill="outline" @click="deleteReminder">
            <ion-icon slot="start" :icon="trash"></ion-icon>
            Löschen
          </ion-button>
        </div>
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
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonPage,
  IonToolbar,
  onIonViewWillEnter,
} from '@ionic/vue';
import { create, trash } from 'ionicons/icons';
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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const formatTimeString = (value?: string) => {
  if (!value) {
    return '';
  }
  // Not anchored to the start: handles both a clean "HH:mm" and a full ISO
  // datetime string like "2026-08-07T15:03:00" (older/unnormalized data).
  const match = value.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value.replace('T', ' ').split('.')[0];
};

const notificationLabel = (minutes: number | undefined, date: string, time: string) => {
  // An absent offset means the reminder was stored before the field existed;
  // scheduling then falls back to "at the reminder time".
  const offset = minutes ?? 0;
  const parsedDate = parseDate(date);
  const parsedTime = formatTimeString(time).match(/^(\d{2}):(\d{2})$/);
  if (!parsedDate || !parsedTime) {
    return offset === 0 ? 'Zum Zeitpunkt' : `${offset} Minuten vorher`;
  }

  const moment = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    Number(parsedTime[1]),
    Number(parsedTime[2]),
  );
  moment.setMinutes(moment.getMinutes() - offset);
  const formattedDay = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(moment);
  const formattedMomentTime = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(moment);
  const offsetLabel = offset === 0
    ? 'Zum Zeitpunkt'
    : offset === 60
      ? '1 Stunde vorher'
      : offset === 1440
        ? '1 Tag vorher'
        : `${offset} Minuten vorher`;
  return `${offsetLabel} · ${formattedDay}, ${formattedMomentTime} Uhr`;
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

const loadReminder = async () => {
  const id = route.params.id as string;
  reminder.value = id ? (await getReminder(id)) ?? null : null;
};

onMounted(loadReminder);

// Ionic keeps visited pages in its navigation stack, so returning to this view
// reuses the existing instance and onMounted does not run again — which meant a
// reminder edited in between was still shown with its old date and time.
// onIonViewWillEnter fires on every entry, including restores from the stack.
onIonViewWillEnter(loadReminder);
</script>

<style scoped>
ion-card {
  min-height: 60vh;
}

.detail-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding: 0 1rem 1rem;
}

.detail-actions ion-button {
  margin: 0;
}
</style>
