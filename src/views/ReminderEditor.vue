<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ isNew ? 'Neue Erinnerung' : 'Erinnerung bearbeiten' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-item>
        <ion-label position="stacked">Bezeichnung</ion-label>
        <ion-input v-model="text" placeholder="Erinnerungstext" required></ion-input>
      </ion-item>

      <ion-item>
        <ion-label position="stacked">Datum</ion-label>
        <ion-datetime
          v-model="date"
          presentation="date"
          display-format="DD.MM.YYYY"
          placeholder="Datum wählen"
        ></ion-datetime>
      </ion-item>

      <ion-item>
        <ion-label>Uhrzeit hinzufügen</ion-label>
        <ion-toggle slot="end" v-model="hasTime" />
      </ion-item>

      <ion-item v-if="hasTime">
        <ion-label position="stacked">Uhrzeit</ion-label>
        <ion-datetime
          v-model="time"
          presentation="time"
          display-format="HH:mm"
          picker-format="HH:mm"
          placeholder="Uhrzeit wählen"
        ></ion-datetime>
      </ion-item>

      <ion-item>
        <ion-label position="stacked">Beschreibung</ion-label>
        <ion-textarea
          v-model="description"
          placeholder="Zusätzliche Informationen"
        ></ion-textarea>
      </ion-item>

      <ion-item>
        <ion-label position="stacked">Benachrichtigung</ion-label>
        <ion-select v-model="notificationOffsetMinutes" interface="popover">
          <ion-select-option :value="null">Keine</ion-select-option>
          <ion-select-option :value="10">10 Minuten davor</ion-select-option>
          <ion-select-option :value="60">1 Stunde davor</ion-select-option>
          <ion-select-option :value="1440">1 Tag davor</ion-select-option>
        </ion-select>
      </ion-item>

      <ion-button
        :disabled="!text.trim() || !date"
        expand="block"
        class="ion-margin-top"
        @click="saveReminder"
      >
        {{ isNew ? 'Hinzufügen' : 'Speichern' }}
      </ion-button>

      <ion-button
        v-if="!isNew"
        color="danger"
        fill="outline"
        expand="block"
        class="ion-margin-top"
        @click="deleteReminder"
      >
        Löschen
      </ion-button>
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
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { addOrUpdateReminder, getReminder, removeReminder } from '@/services/reminder.service';

const router = useRouter();
const route = useRoute();
const isNew = ref(true);
const text = ref('');
const date = ref<string | undefined>();
const time = ref<string | undefined>();
const hasTime = ref(false);
const description = ref('');
const notificationOffsetMinutes = ref<number | null>(null);
const reminderId = ref('');

onMounted(async () => {
  const id = route.params.id as string | undefined;
  if (id && id !== 'new') {
    isNew.value = false;
    reminderId.value = id;
    const existing = await getReminder(id);
    if (existing) {
      text.value = existing.text;
      date.value = existing.date;
      time.value = existing.time;
      hasTime.value = !!existing.time;
      description.value = existing.description ?? '';
      notificationOffsetMinutes.value = existing.notificationOffsetMinutes ?? null;
    } else {
      router.replace('/home');
    }
  } else {
    isNew.value = true;
    reminderId.value = `r-${Date.now()}`;
  }
});

const saveReminder = async () => {
  const reminder = {
    id: reminderId.value,
    text: text.value.trim(),
    date: date.value,
    time: hasTime.value ? time.value : undefined,
    description: description.value.trim(),
    notificationOffsetMinutes: notificationOffsetMinutes.value ?? undefined,
  };

  await addOrUpdateReminder(reminder);
  router.replace('/home');
};

const deleteReminder = async () => {
  if (!isNew.value) {
    await removeReminder(reminderId.value);
    router.replace('/home');
  }
};
</script>
