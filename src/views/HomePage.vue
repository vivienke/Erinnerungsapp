<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Erinnerungen</ion-title>
        <ion-buttons slot="end">
          <img src="/forgetMeNot.jpeg" alt="Logo" class="header-logo" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
        <ion-item>
          <ion-segment v-model="statusFilter">
            <ion-segment-button value="all">Alle</ion-segment-button>
          <ion-segment-button value="open">Offen</ion-segment-button>
          <ion-segment-button value="done">Erledigt</ion-segment-button>
        </ion-segment>
      </ion-item>

      <ion-item>
        <ion-select v-model="dateFilter" interface="popover">
          <ion-select-option value="all">Alle</ion-select-option>
          <ion-select-option value="today">Heute</ion-select-option>
          <ion-select-option value="week">Diese Woche</ion-select-option>
          <ion-select-option value="custom">Individuell</ion-select-option>
          <ion-select-option v-for="option in monthOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </ion-select-option>
        </ion-select>
      </ion-item>

      <ion-item v-if="dateFilter === 'custom'">
        <ion-label>
          {{ customRangeStart && customRangeEnd ? `Von ${formatDateString(customRangeStart)} bis ${formatDateString(customRangeEnd)}` : 'Von / Bis wählen' }}
        </ion-label>
      </ion-item>

      <ion-modal :is-open="customModalOpen" backdrop-dismiss="false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Individueller Filter</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-item button :detail="false" @click="startPickerOpen = true">
            <ion-label>Von</ion-label>
            <ion-note slot="end">{{ tempCustomRangeStart ? formatDateString(tempCustomRangeStart) : 'Wählen' }}</ion-note>
          </ion-item>
          <ion-item button :detail="false" @click="endPickerOpen = true">
            <ion-label>Bis</ion-label>
            <ion-note slot="end">{{ tempCustomRangeEnd ? formatDateString(tempCustomRangeEnd) : 'Wählen' }}</ion-note>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Bezeichnung</ion-label>
            <ion-input v-model="tempCustomFilterText" placeholder="Suchbegriff"></ion-input>
          </ion-item>
          <ion-datetime
            v-if="startPickerOpen"
            v-model="tempCustomRangeStart"
            :is-open="startPickerOpen"
            presentation="date"
            display-format="DD.MM.YYYY"
            @ionDidDismiss="startPickerOpen = false"
            @ionChange="startPickerOpen = false"
            @ionCancel="startPickerOpen = false"
          ></ion-datetime>
          <ion-datetime
            v-if="endPickerOpen"
            v-model="tempCustomRangeEnd"
            :is-open="endPickerOpen"
            presentation="date"
            display-format="DD.MM.YYYY"
            @ionDidDismiss="endPickerOpen = false"
            @ionChange="endPickerOpen = false"
            @ionCancel="endPickerOpen = false"
          ></ion-datetime>
        </ion-content>
        <ion-footer>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button fill="outline" @click="cancelCustomFilter">Abbrechen</ion-button>
            </ion-buttons>
            <ion-buttons slot="end">
              <ion-button @click="applyCustomFilter">Speichern</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-footer>
      </ion-modal>

      <template v-if="filteredReminders.length">
        <ion-list>
          <ion-item
            v-for="reminder in filteredReminders"
            :key="reminder.id"
            :class="{ done: reminder.done }"
          >
            <ion-checkbox slot="start" :checked="reminder.done" @ionChange="toggleDone(reminder)"></ion-checkbox>
            <ion-label @click="viewReminder(reminder.id)">
              <h2>{{ reminder.text }}</h2>
              <p v-if="reminder.date || reminder.time">
                {{ formatDateTime(reminder.date, reminder.time) }}
              </p>
            </ion-label>
            <ion-button slot="end" fill="clear" @click.stop="openActions(reminder.id)">
              <ion-icon name="ellipsis-vertical"></ion-icon>
            </ion-button>
          </ion-item>
        </ion-list>
      </template>
      <div v-else class="empty-state ion-text-center ion-padding-top">
        <p>Keine Erinnerungen gefunden.</p>
      </div>

      <ion-action-sheet
        :is-open="actionSheetOpen"
        :buttons="actionButtons"
        @didDismiss="actionSheetOpen = false"
      />

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button class="fab-button-plus" @click="createReminder">
          +
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { IonActionSheet, IonButton, IonCheckbox, IonContent, IonDatetime, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonModal, IonNote, IonPage, IonSelect, IonSelectOption, IonSegment, IonSegmentButton, IonTitle, IonToolbar, IonButtons } from '@ionic/vue';
import { loadReminders, removeReminder, addOrUpdateReminder } from '@/services/reminder.service';

interface Reminder {
  id: string;
  text: string;
  date?: string;
  time?: string;
  description?: string;
  done?: boolean;
}

const router = useRouter();
const route = useRoute();
const reminders = ref<Reminder[]>([]);
const statusFilter = ref<'all' | 'done' | 'open'>('all');
const dateFilter = ref<'all' | 'today' | 'week' | 'custom' | `month-${number}`>('all');
const customRangeStart = ref<string | undefined>();
const customRangeEnd = ref<string | undefined>();
const customFilterText = ref<string>('');
const tempCustomRangeStart = ref<string | undefined>();
const tempCustomRangeEnd = ref<string | undefined>();
const tempCustomFilterText = ref<string>('');
const customModalOpen = ref(false);
const startPickerOpen = ref(false);
const endPickerOpen = ref(false);
const previousDateFilter = ref<'all' | 'today' | 'week' | 'custom' | `month-${number}`>('all');
const reminderDeletedHandler = ref<EventListener | null>(null);
const actionSheetOpen = ref(false);
const selectedReminderId = ref('');

const monthOptions = computed(() => {
  const formatter = new Intl.DateTimeFormat('de-DE', { month: 'long' });
  const monthList = [] as Array<{ value: string; label: string }>;
  const today = new Date();

  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    monthList.push({
      value: `month-${d.getMonth() + 1}`,
      label: formatter.format(d),
    });
  }

  return monthList;
});

const loadData = async () => {
  reminders.value = await loadReminders();
};

const createReminder = () => {
  router.push('/reminder/new');
};

const viewReminder = (id: string) => {
  router.push(`/reminder/${id}`);
};

const editReminder = (id: string) => {
  router.push(`/reminder/${id}/edit`);
};

const deleteItem = async (id: string) => {
  await removeReminder(id);
  await loadData();
};

const parseDate = (date?: string) => {
  if (!date) return undefined;

  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const isSameWeek = (date: Date, compareTo: Date) => {
  const oneJan = new Date(compareTo.getFullYear(), 0, 1);
  const compareWeek = Math.ceil(((compareTo.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  const dateWeek = Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return compareTo.getFullYear() === date.getFullYear() && compareWeek === dateWeek;
};

const filteredReminders = computed(() => {
  const today = new Date();
  return reminders.value.filter((reminder) => {
    if (statusFilter.value === 'done' && !reminder.done) {
      return false;
    }
    if (statusFilter.value === 'open' && reminder.done) {
      return false;
    }

    const reminderDate = parseDate(reminder.date);
    if (!reminderDate) {
      return dateFilter.value === 'all';
    }

    if (dateFilter.value === 'today') {
      return reminderDate.toDateString() === today.toDateString();
    }

    if (dateFilter.value === 'week') {
      return isSameWeek(reminderDate, today);
    }

    if (dateFilter.value === 'custom') {
      if (!customRangeStart.value || !customRangeEnd.value) {
        return false;
      }

      const start = parseDate(customRangeStart.value);
      const end = parseDate(customRangeEnd.value);
      if (!start || !end) {
        return false;
      }

      const matchesRange = reminderDate >= start && reminderDate <= end;
      const searchText = customFilterText.value.trim().toLowerCase();
      if (!searchText) {
        return matchesRange;
      }

      const textMatch = reminder.text.toLowerCase().includes(searchText) || (reminder.description ?? '').toLowerCase().includes(searchText);
      return matchesRange && textMatch;
    }

    if (dateFilter.value.startsWith('month-')) {
      const month = Number(dateFilter.value.split('-')[1]);
      return reminderDate.getMonth() + 1 === month && reminderDate.getFullYear() === today.getFullYear();
    }

    return true;
  });
});

const toggleDone = async (reminder: Reminder) => {
  await addOrUpdateReminder({
    id: reminder.id,
    text: reminder.text,
    date: reminder.date,
    time: reminder.time,
    done: !reminder.done,
  });
  await loadData();
};

const openActions = (id: string) => {
  selectedReminderId.value = id;
  actionSheetOpen.value = true;
};

watch(dateFilter, (newValue, oldValue) => {
  if (newValue === 'custom') {
    tempCustomRangeStart.value = customRangeStart.value;
    tempCustomRangeEnd.value = customRangeEnd.value;
    tempCustomFilterText.value = customFilterText.value;
    previousDateFilter.value = oldValue;
    customModalOpen.value = true;
  }
});

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
  return match ? match[1] : value;
};

const formatDateTime = (date?: string, time?: string) => {
  if (date && time) {
    return `${formatDateString(date)}   ${formatTimeString(time)}`;
  }
  if (time) {
    return formatTimeString(time);
  }
  if (date) {
    return formatDateString(date);
  }
  return '';
};

const applyCustomFilter = () => {
  if (!tempCustomRangeStart.value || !tempCustomRangeEnd.value) {
    return;
  }
  customRangeStart.value = tempCustomRangeStart.value;
  customRangeEnd.value = tempCustomRangeEnd.value;
  customFilterText.value = tempCustomFilterText.value;
  customModalOpen.value = false;
};

const cancelCustomFilter = () => {
  customModalOpen.value = false;
  dateFilter.value = previousDateFilter.value || 'all';
};

const actionButtons = computed(() => [
  {
    text: 'Bearbeiten',
    handler: () => editReminder(selectedReminderId.value),
  },
  {
    text: 'Löschen',
    role: 'destructive',
    handler: () => deleteItem(selectedReminderId.value),
  },
  {
    text: 'Abbrechen',
    role: 'cancel',
  },
]);

onMounted(() => {
  loadData();
  reminderDeletedHandler.value = () => {
    loadData();
  };
  window.addEventListener('reminderDeleted', reminderDeletedHandler.value as EventListener);
});

onUnmounted(() => {
  if (reminderDeletedHandler.value) {
    window.removeEventListener('reminderDeleted', reminderDeletedHandler.value as EventListener);
  }
});

watch(route, () => {
  loadData();
});
</script>

<style scoped>
.header-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 6px;
  margin-right: 0.5rem;
}

.fab-button-plus {
  font-size: 1.5rem;
  font-weight: bold;
}

.done h2,
.done p {
  text-decoration: line-through;
  opacity: 0.6;
}
</style>
