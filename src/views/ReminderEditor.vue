<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ isNew ? 'Neue Erinnerung' : 'Erinnerung bearbeiten' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding" :fullscreen="true">
      <ion-list>
        <ion-item>
          <ion-label position="stacked">
            Titel <span class="required-marker" aria-hidden="true">*</span>
          </ion-label>
          <ion-input v-model="text" placeholder="Woran möchtest du erinnert werden?" required></ion-input>
        </ion-item>

        <!-- A new reminder is always open, so the status is only editable for an
             existing one. Setting it back to "Offen" re-arms the notification;
             marking it done cancels it. -->
        <ion-item v-if="!isNew">
          <ion-label position="stacked">Status</ion-label>
          <ion-select v-model="done" interface="popover">
            <ion-select-option :value="false">Offen</ion-select-option>
            <ion-select-option :value="true">Erledigt</ion-select-option>
          </ion-select>
        </ion-item>

        <!-- Date and time are optional per the requirements, so both rows work
             the same way: tap to pick, "×" to clear again. They use the same
             stacked-label layout as the text fields so the card reads as one
             consistent form, and the value is tinted to look tappable. -->
        <ion-item class="picker-item" button :detail="!date" @click="openDatePicker">
          <ion-label position="stacked">Datum</ion-label>
          <div class="picker-value" :class="{ 'is-placeholder': !date }">
            {{ formattedDate || 'Kein Datum' }}
          </div>
          <ion-button
            v-if="date"
            slot="end"
            fill="clear"
            color="medium"
            aria-label="Datum entfernen"
            @click.stop="clearDate"
          >
            <ion-icon slot="icon-only" :icon="close"></ion-icon>
          </ion-button>
        </ion-item>
        <ion-datetime
          v-if="datePickerOpen"
          v-model="date"
          :is-open="datePickerOpen"
          presentation="date"
          locale="de-DE"
          @ionDidDismiss="datePickerOpen = false"
          @ionChange="datePickerOpen = false"
          @ionCancel="datePickerOpen = false"
        ></ion-datetime>

        <ion-item class="picker-item" button :detail="!time" @click="openTimePicker">
          <ion-label position="stacked">Uhrzeit</ion-label>
          <div class="picker-value" :class="{ 'is-placeholder': !time }">
            {{ formattedTime || 'Keine Uhrzeit' }}
          </div>
          <ion-button
            v-if="time"
            slot="end"
            fill="clear"
            color="medium"
            aria-label="Uhrzeit entfernen"
            @click.stop="clearTime"
          >
            <ion-icon slot="icon-only" :icon="close"></ion-icon>
          </ion-button>
        </ion-item>
        <ion-datetime
          v-if="timePickerOpen"
          v-model="time"
          :is-open="timePickerOpen"
          presentation="time"
          locale="de-DE"
          hour-cycle="h23"
          @ionDidDismiss="timePickerOpen = false"
          @ionChange="timePickerOpen = false"
          @ionCancel="timePickerOpen = false"
        ></ion-datetime>

        <ion-item>
          <ion-label position="stacked">Beschreibung</ion-label>
          <ion-textarea
            v-model="description"
            placeholder="Zusätzliche Informationen"
            :auto-grow="true"
            :rows="2"
          ></ion-textarea>
        </ion-item>

        <!-- Only meaningful once a time exists — that is when a notification
             can actually be scheduled. -->
        <ion-item v-if="date && time" lines="none">
          <ion-label position="stacked">Benachrichtigung</ion-label>
          <ion-select
            v-model="notificationOffsetMinutes"
            interface="alert"
            :interface-options="notificationInterfaceOptions"
          >
            <ion-select-option
              v-for="option in notificationOptions"
              :key="option.value"
              :value="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <div
          v-if="notificationStatus"
          class="notification-status"
          :class="{ 'notification-status--invalid': !notificationStatus.valid }"
        >
          <ion-icon
            :icon="notificationStatus.valid ? checkmarkCircleOutline : alertCircleOutline"
            aria-hidden="true"
          ></ion-icon>
          <span>{{ notificationStatus.message }}</span>
        </div>
      </ion-list>
      <p class="required-hint"><span aria-hidden="true">*</span> Pflichtfeld</p>
    </ion-content>

    <!-- The primary action is pinned to the bottom: always reachable, also once
         the form grows or the keyboard covers part of the screen. -->
    <ion-footer class="ion-no-border">
      <ion-toolbar>
        <ion-button
          :disabled="!canSaveReminder"
          expand="block"
          class="ion-margin-horizontal"
          @click="saveReminder"
        >
          <ion-icon slot="start" :icon="checkmark"></ion-icon>
          {{ isNew ? 'Hinzufügen' : 'Speichern' }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter,
  toastController,
} from '@ionic/vue';
import { alertCircleOutline, checkmark, checkmarkCircleOutline, close } from 'ionicons/icons';
import {
  addOrUpdateReminder,
  getReminder,
  reminderNeedsNotificationPermission,
} from '@/services/reminder.service';
import { requestNotificationPermissionWithFeedback } from '@/services/notification-permission.service';
import { isNativePickerAvailable, pickDate, pickTime } from '@/services/datetime.service';

const router = useRouter();
const route = useRoute();
const isNew = ref(true);
const text = ref('');
const date = ref<string | undefined>();
const time = ref<string | undefined>();
const description = ref('');
const notificationOffsetMinutes = ref<number | 'none'>(0);
const reminderId = ref('');
const datePickerOpen = ref(false);
const timePickerOpen = ref(false);
const done = ref(false);
const validationNow = ref(new Date());
let validationTimer: ReturnType<typeof setInterval> | undefined;

const startValidationClock = () => {
  validationNow.value = new Date();
  if (validationTimer) {
    clearInterval(validationTimer);
  }
  // Date/time fields only have minute precision, but checking every second
  // closes the small race around the exact notification boundary.
  validationTimer = setInterval(() => {
    validationNow.value = new Date();
  }, 1000);
};

const loadReminder = async () => {
  const id = route.params.id as string | undefined;
  if (id && id !== 'new') {
    isNew.value = false;
    reminderId.value = id;
    const existing = await getReminder(id);
    if (existing) {
      text.value = existing.text;
      date.value = existing.date;
      time.value = existing.time;
      description.value = existing.description ?? '';
      notificationOffsetMinutes.value = existing.notificationOffsetMinutes === null
        ? 'none'
        : existing.notificationOffsetMinutes ?? 0;
      done.value = existing.done ?? false;
    } else {
      router.replace('/home');
    }
  } else {
    isNew.value = true;
    text.value = '';
    date.value = undefined;
    time.value = undefined;
    description.value = '';
    notificationOffsetMinutes.value = 0;
    done.value = false;
    reminderId.value = `r-${Date.now()}`;
  }
};

onMounted(() => {
  loadReminder();
  startValidationClock();
});

onUnmounted(() => {
  if (validationTimer) {
    clearInterval(validationTimer);
  }
});

// Ionic reuses pages from its navigation stack, so re-entering this view would
// otherwise keep whatever was loaded the first time. Re-reading on every entry
// also makes sure a freshly opened "new reminder" form starts empty.
onIonViewWillEnter(() => {
  loadReminder();
  startValidationClock();
});

const showToast = async (message: string, color: 'success' | 'danger' = 'success') => {
  const toast = await toastController.create({
    message,
    duration: 2000,
    position: 'bottom',
    color,
  });
  // Intentionally not awaited: presenting is an animation that runs
  // independently of navigation, and awaiting it here would block (or on some
  // setups indefinitely stall) the router.replace() that follows.
  toast.present();
};

// ion-datetime's value for presentation="time" is a full ISO datetime string
// (e.g. "2026-08-07T15:03:00"), not bare "HH:mm" — normalize once here so
// everything downstream (storage, display, notification scheduling) can rely
// on a clean "HH:mm".
const normalizeTime = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const match = value.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
};

// Same story for the date: ion-datetime hands back a full ISO datetime even
// for presentation="date", so it is reduced to a plain "YYYY-MM-DD".
const normalizeDate = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const match = value.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value;
};

const formattedDate = computed(() => {
  if (!date.value) {
    return '';
  }
  const parsed = new Date(date.value);
  if (Number.isNaN(parsed.getTime())) {
    return date.value;
  }
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
});

const formattedTime = computed(() => normalizeTime(time.value) ?? '');

const notificationDate = (offsetMinutes: number) => {
  const normalizedDate = normalizeDate(date.value);
  const normalizedTime = normalizeTime(time.value);
  if (!normalizedDate || !normalizedTime) {
    return undefined;
  }

  const [year, month, day] = normalizedDate.split('-').map(Number);
  const [hours, minutes] = normalizedTime.split(':').map(Number);
  const moment = new Date(year, month - 1, day, hours, minutes);
  moment.setMinutes(moment.getMinutes() - offsetMinutes);
  return moment;
};

const formatMoment = (moment?: Date) => {
  if (!moment) {
    return '';
  }
  const formattedDay = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(moment);
  const formattedMomentTime = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(moment);
  return `${formattedDay}, ${formattedMomentTime} Uhr`;
};

const eventMomentLabel = computed(() => formatMoment(notificationDate(0)));

const notificationInterfaceOptions = computed(() => ({
  header: 'Benachrichtigung',
  subHeader: `Termin: ${eventMomentLabel.value}`,
}));

const notificationOptions = computed(() => {
  const now = validationNow.value;
  const timedOptions = [
    { minutes: 0, prefix: 'Zum Termin' },
    { minutes: 10, prefix: '10 Minuten früher' },
    { minutes: 60, prefix: '1 Stunde früher' },
    { minutes: 1440, prefix: '1 Tag früher' },
  ].map((option) => {
    const moment = notificationDate(option.minutes);
    const disabled = !moment || moment <= now;
    return {
      value: option.minutes as number | 'none',
      disabled,
      label: `${option.prefix} · ${formatMoment(moment)}${disabled ? ' · nicht mehr möglich' : ''}`,
    };
  });
  return [
    { value: 'none' as const, disabled: false, label: 'Keine' },
    ...timedOptions,
  ];
});

const notificationStatus = computed(() => {
  if (!date.value || !time.value || done.value || notificationOffsetMinutes.value === 'none') {
    return null;
  }

  const moment = notificationDate(notificationOffsetMinutes.value);
  if (!moment || moment <= validationNow.value) {
    return {
      valid: false,
      message: 'Der gewählte Benachrichtigungszeitpunkt ist bereits vorbei.',
    };
  }

  return {
    valid: true,
    message: `Benachrichtigung möglich: ${formatMoment(moment)}`,
  };
});

const hasInvalidNotification = computed(() => notificationStatus.value?.valid === false);
const canSaveReminder = computed(() => !!text.value.trim() && !hasInvalidNotification.value);

// On a device the native Capawesome picker is used; the browser preview has no
// native layer, so it falls back to the inline ion-datetime below.
const openDatePicker = async () => {
  if (!isNativePickerAvailable()) {
    datePickerOpen.value = true;
    return;
  }
  const picked = await pickDate(date.value);
  if (picked) {
    date.value = picked;
  }
};

const openTimePicker = async () => {
  if (!isNativePickerAvailable()) {
    timePickerOpen.value = true;
    return;
  }
  const picked = await pickTime(time.value);
  if (picked) {
    time.value = picked;
  }
};

const clearDate = () => {
  date.value = undefined;
};

// Without a time there is nothing to schedule, so the notification offset is
// reset along with it to avoid a stale value being saved.
const clearTime = () => {
  time.value = undefined;
  notificationOffsetMinutes.value = 0;
};

const saveReminder = async () => {
  // Re-check at the exact click time as a final guard. The visible status and
  // disabled button update live, but this also covers a click on the boundary.
  validationNow.value = new Date();
  if (hasInvalidNotification.value) {
    showToast('Dieser Benachrichtigungszeitpunkt ist nicht mehr möglich', 'danger');
    return;
  }

  const reminder = {
    id: reminderId.value,
    text: text.value.trim(),
    date: normalizeDate(date.value),
    time: normalizeTime(time.value),
    description: description.value.trim(),
    notificationOffsetMinutes: notificationOffsetMinutes.value === 'none'
      ? null
      : notificationOffsetMinutes.value,
    // The editor is now authoritative for the status: switching back to "Offen"
    // lets the service schedule a notification again, marking it done cancels it.
    done: done.value,
  };

  // The initial app launch no longer asks without a reason. If this reminder
  // needs a notification, request permission immediately before it is saved.
  // Choosing "Keine", marking it done, or omitting date/time skips this path.
  if (reminderNeedsNotificationPermission(reminder, validationNow.value)) {
    const permission = await requestNotificationPermissionWithFeedback(true);
    if (permission !== 'granted') {
      return;
    }
  }

  try {
    const saved = await addOrUpdateReminder(reminder);
    window.dispatchEvent(new CustomEvent('reminderUpdated', { detail: saved.id }));
    // Navigate immediately; the toast is a nice-to-have and must never be able
    // to delay or block returning to the list, so it is intentionally not awaited.
    router.replace('/home');

    // Date and time were given but nothing got scheduled — on a device that
    // means the computed notification time already passed. Say so instead of
    // letting the user believe a reminder is armed when it never fires.
    const expectedNotification =
      !reminder.done &&
      !!reminder.date &&
      !!reminder.time &&
      reminder.notificationOffsetMinutes !== null;
    if (expectedNotification && !saved.notificationId) {
      showToast('Gespeichert, aber der Benachrichtigungszeitpunkt liegt bereits in der Vergangenheit', 'danger');
    } else {
      showToast(isNew.value ? 'Erinnerung hinzugefügt' : 'Erinnerung gespeichert');
    }
  } catch (error) {
    console.error('Failed to save reminder', error);
    showToast('Erinnerung konnte nicht gespeichert werden', 'danger');
  }
};

</script>

<style scoped>
/* Ionic positions stacked labels with a transform that is tied to their own
   height, so enlarging the font shifts them out of place. Weight and colour are
   raised instead — they strengthen the label without touching that geometry. */
ion-label.label-stacked {
  font-weight: 600;
  color: var(--ion-color-step-750);
}

.required-marker,
.required-hint span {
  color: var(--ion-color-danger);
}

.required-hint {
  position: relative;
  z-index: 1;
  margin: 0.4rem 0.35rem 0.25rem;
  padding-left: 0.25rem;
  color: var(--ion-color-medium-shade);
  font-size: 0.78rem;
}

.notification-status {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0 1rem 0.9rem;
  color: var(--ion-color-success-shade);
  font-size: 0.8rem;
  line-height: 1.35;
}

.notification-status--invalid {
  color: var(--ion-color-danger);
}

.notification-status ion-icon {
  flex: 0 0 auto;
  margin-top: 0.08rem;
  font-size: 1rem;
}

/* Blue is reserved for an actual chosen value, so it reads as content. Slightly
   smaller than before, which narrows the gap to the label above it. */
.picker-value {
  color: var(--ion-color-primary);
  font-size: 0.95rem;
  padding: 10px 0 8px;
  width: 100%;
}

/* Nothing chosen yet: describes the state ("Kein Datum") in placeholder grey
   instead of shouting an instruction in blue. */
.picker-value.is-placeholder {
  color: var(--ion-color-medium);
}

/* Ionic's stacked labels make the end slot look slightly top-heavy. Keep both
   the detail chevron and the clear action centred against the complete row. */
.picker-item::part(detail-icon),
.picker-item ion-button[slot='end'] {
  align-self: center;
  margin-top: 0;
  margin-bottom: 0;
}
</style>
