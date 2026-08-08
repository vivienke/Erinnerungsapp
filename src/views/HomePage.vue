<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Erinnerungen</ion-title>
        <ion-buttons slot="end">
          <img :src="logoUrl" alt="Logo" class="header-logo" />
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="statusFilter">
          <ion-segment-button value="all">Alle</ion-segment-button>
          <ion-segment-button value="open">Offen</ion-segment-button>
          <ion-segment-button value="done">Erledigt</ion-segment-button>
        </ion-segment>
      </ion-toolbar>
      <ion-toolbar>
        <!-- Date range as chips rather than a second segment row: a different
             control shape makes it obvious that this filters something else
             than the status tabs above. -->
        <div class="filter-chips">
          <ion-chip
            v-for="option in dateFilterChips"
            :key="option.value"
            :outline="dateFilter !== option.value"
            :color="dateFilter === option.value ? 'primary' : 'medium'"
            @click="setDateFilter(option.value)"
          >
            <ion-label>{{ option.label }}</ion-label>
          </ion-chip>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding" :fullscreen="true">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <ion-modal :is-open="customModalOpen" backdrop-dismiss="false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Individueller Filter</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="range-block">
            <h3>Von</h3>
            <ion-item button :detail="false" @click="openRangeStartPicker">
              <ion-label>Datum</ion-label>
              <ion-note slot="end">{{ tempCustomRangeStart ? formatDateString(tempCustomRangeStart) : 'Wählen' }}</ion-note>
            </ion-item>
            <ion-item button :detail="false" @click="openRangeStartTimePicker">
              <ion-label>Uhrzeit</ion-label>
              <ion-note slot="end">{{ formatTimeString(tempCustomRangeStartTime) }}</ion-note>
            </ion-item>
          </div>
          <div class="range-block">
            <h3>Bis</h3>
            <ion-item button :detail="false" @click="openRangeEndPicker">
              <ion-label>Datum</ion-label>
              <ion-note slot="end">{{ tempCustomRangeEnd ? formatDateString(tempCustomRangeEnd) : 'Wählen' }}</ion-note>
            </ion-item>
            <ion-item button :detail="false" @click="openRangeEndTimePicker">
              <ion-label>Uhrzeit</ion-label>
              <ion-note slot="end">{{ formatTimeString(tempCustomRangeEndTime) }}</ion-note>
            </ion-item>
          </div>
          <ion-item>
            <ion-label position="stacked">Textsuche</ion-label>
            <ion-input v-model="tempCustomFilterText" placeholder="Titel oder Beschreibung"></ion-input>
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
          <ion-datetime
            v-if="startTimePickerOpen"
            v-model="tempCustomRangeStartTime"
            :is-open="startTimePickerOpen"
            presentation="time"
            locale="de-DE"
            hour-cycle="h23"
            @ionDidDismiss="startTimePickerOpen = false"
            @ionChange="startTimePickerOpen = false"
            @ionCancel="startTimePickerOpen = false"
          ></ion-datetime>
          <ion-datetime
            v-if="endTimePickerOpen"
            v-model="tempCustomRangeEndTime"
            :is-open="endTimePickerOpen"
            presentation="time"
            locale="de-DE"
            hour-cycle="h23"
            @ionDidDismiss="endTimePickerOpen = false"
            @ionChange="endTimePickerOpen = false"
            @ionCancel="endTimePickerOpen = false"
          ></ion-datetime>
        </ion-content>
        <ion-footer class="custom-filter-footer ion-no-border">
          <div class="custom-filter-actions">
            <ion-button expand="block" fill="outline" color="medium" @click="cancelCustomFilter">
              Abbrechen
            </ion-button>
            <ion-button
              expand="block"
              :disabled="!canApplyCustomFilter"
              @click="applyCustomFilter"
            >
              Speichern
            </ion-button>
          </div>
        </ion-footer>
      </ion-modal>

      <template v-if="filteredReminders.length">
        <section
          v-for="group in groupedReminders"
          :key="group.key"
          class="reminder-group"
          :class="`reminder-group--${group.tone}`"
        >
          <div v-if="group.label" class="group-heading">
            <span class="group-icon" aria-hidden="true">
              <ion-icon :icon="group.icon"></ion-icon>
            </span>
            <h2>{{ group.label }}</h2>
            <span class="group-count" :aria-label="`${group.items.length} Erinnerungen`">
              {{ group.items.length }}
            </span>
          </div>
          <ion-list>
            <ion-item-sliding v-for="reminder in group.items" :key="reminder.id">
              <ion-item :class="{ done: reminder.done }">
                <ion-checkbox slot="start" :checked="reminder.done" @ionChange="toggleDone(reminder)"></ion-checkbox>
                <ion-label class="reminder-content" @click="viewReminder(reminder.id)">
                  <h3 class="reminder-title">{{ reminder.text }}</h3>
                  <p v-if="reminder.date || reminder.time" class="reminder-date">
                    <ion-icon :icon="timeOutline" aria-hidden="true"></ion-icon>
                    {{ formatDateTime(reminder.date, reminder.time) }}
                  </p>
                </ion-label>
              </ion-item>
              <ion-item-options side="end">
                <ion-item-option color="primary" @click="editReminder(reminder.id)">
                  <ion-icon slot="icon-only" :icon="create"></ion-icon>
                </ion-item-option>
                <ion-item-option color="danger" @click="deleteItem(reminder.id)">
                  <ion-icon slot="icon-only" :icon="trash"></ion-icon>
                </ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          </ion-list>
        </section>
      </template>
      <div v-else class="empty-state ion-text-center ion-padding-top">
        <ion-icon :icon="notificationsOffOutline" class="empty-state-icon"></ion-icon>
        <p>Keine Erinnerungen gefunden.</p>
      </div>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button aria-label="Neue Erinnerung" @click="createReminder">
          <ion-icon :icon="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { IonButton, IonCheckbox, IonChip, IonContent, IonDatetime, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonModal, IonNote, IonPage, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonTitle, IonToolbar, IonButtons, onIonViewWillEnter } from '@ionic/vue';
import type { RefresherCustomEvent } from '@ionic/vue';
import { add, alertCircleOutline, calendar, calendarOutline, create, notificationsOffOutline, removeCircleOutline, timeOutline, todayOutline, trash } from 'ionicons/icons';
import { loadReminders, removeReminder, addOrUpdateReminder } from '@/services/reminder.service';
import { isNativePickerAvailable, pickDate, pickTime } from '@/services/datetime.service';

interface Reminder {
  id: string;
  text: string;
  date?: string;
  time?: string;
  description?: string;
  done?: boolean;
}

type DateFilter = 'all' | 'today' | 'week' | 'overdue' | 'custom';

// Bound rather than written as a literal src: the Vue compiler would otherwise
// try to resolve "/forgetMeNot.jpeg" as a build asset, which broke the unit
// tests. It lives in public/ and is served from the root at runtime either way.
const logoUrl = '/forgetMeNot.jpeg';

const router = useRouter();
const route = useRoute();
const reminders = ref<Reminder[]>([]);
const statusFilter = ref<'all' | 'done' | 'open'>('all');
const dateFilter = ref<DateFilter>('all');
const customRangeStart = ref<string | undefined>();
const customRangeEnd = ref<string | undefined>();
const customRangeStartTime = ref('00:00');
const customRangeEndTime = ref('23:59');
const customFilterText = ref<string>('');
const tempCustomRangeStart = ref<string | undefined>();
const tempCustomRangeEnd = ref<string | undefined>();
const tempCustomRangeStartTime = ref('00:00');
const tempCustomRangeEndTime = ref('23:59');
const tempCustomFilterText = ref<string>('');
const customModalOpen = ref(false);
const startPickerOpen = ref(false);
const endPickerOpen = ref(false);
const startTimePickerOpen = ref(false);
const endTimePickerOpen = ref(false);
const reminderUpdatedHandler = ref<EventListener | null>(null);
const currentTime = ref(new Date());
let refreshTimer: ReturnType<typeof setInterval> | undefined;

/** Short "01.08. – 15.08." label shown once a custom range is active. */
const customRangeLabel = computed(() => {
  if (!customRangeStart.value || !customRangeEnd.value) {
    return 'Individuell';
  }
  const short = (value: string) => {
    const date = parseDate(value);
    if (!date) {
      return value;
    }
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(date);
  };
  return `${short(customRangeStart.value)} ${formatTimeString(customRangeStartTime.value)} – ${short(customRangeEnd.value)} ${formatTimeString(customRangeEndTime.value)}`;
});

const dateFilterChips = computed<Array<{ value: DateFilter; label: string }>>(() => [
  { value: 'all', label: 'Alle' },
  { value: 'overdue', label: 'Überfällig' },
  { value: 'today', label: 'Heute' },
  { value: 'week', label: 'Diese Woche' },
  {
    value: 'custom',
    label: dateFilter.value === 'custom' ? customRangeLabel.value : 'Individuell',
  },
]);

const openCustomFilter = () => {
  tempCustomRangeStart.value = customRangeStart.value;
  tempCustomRangeEnd.value = customRangeEnd.value;
  tempCustomRangeStartTime.value = customRangeStartTime.value;
  tempCustomRangeEndTime.value = customRangeEndTime.value;
  tempCustomFilterText.value = customFilterText.value;
  customModalOpen.value = true;
};

const setDateFilter = (value: DateFilter) => {
  // "Individuell" opens the range dialog instead of switching directly — and it
  // does so even when it is already the active chip, so the range stays editable.
  if (value === 'custom') {
    openCustomFilter();
    return;
  }
  dateFilter.value = value;
};

// Same native-picker-with-web-fallback pattern as the reminder editor, so date
// entry works identically everywhere in the app.
const openRangeStartPicker = async () => {
  if (!isNativePickerAvailable()) {
    startPickerOpen.value = true;
    return;
  }
  const picked = await pickDate(tempCustomRangeStart.value);
  if (picked) {
    tempCustomRangeStart.value = picked;
  }
};

const openRangeEndPicker = async () => {
  if (!isNativePickerAvailable()) {
    endPickerOpen.value = true;
    return;
  }
  const picked = await pickDate(tempCustomRangeEnd.value);
  if (picked) {
    tempCustomRangeEnd.value = picked;
  }
};

const loadData = async () => {
  reminders.value = await loadReminders();
};

const openRangeStartTimePicker = async () => {
  if (!isNativePickerAvailable()) {
    startTimePickerOpen.value = true;
    return;
  }
  const picked = await pickTime(tempCustomRangeStartTime.value);
  if (picked) {
    tempCustomRangeStartTime.value = picked;
  }
};

const openRangeEndTimePicker = async () => {
  if (!isNativePickerAvailable()) {
    endTimePickerOpen.value = true;
    return;
  }
  const picked = await pickTime(tempCustomRangeEndTime.value);
  if (picked) {
    tempCustomRangeEndTime.value = picked;
  }
};

const refreshView = async () => {
  currentTime.value = new Date();
  await loadData();
};

const handleRefresh = async (event: RefresherCustomEvent) => {
  await refreshView();
  event.target.complete();
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

/** Monday 00:00 of the week the given date belongs to. */
const startOfWeek = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay() returns 0 for Sunday; treated as 7 so weeks run Monday..Sunday.
  const dayOfWeek = result.getDay() === 0 ? 7 : result.getDay();
  result.setDate(result.getDate() - (dayOfWeek - 1));
  return result;
};

/**
 * Compares against a real Monday..Sunday window. The previous implementation
 * derived a week number from January 1st, which had two bugs: weeks started on
 * Sunday (so on a Sunday the entire running week vanished and the next one
 * appeared), and its same-year check made the last and first week of a year
 * never match even when they are the same calendar week.
 */
const isSameWeek = (date: Date, compareTo: Date) => {
  const weekStart = startOfWeek(compareTo);
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return day >= weekStart && day < nextWeekStart;
};

const dateWithTime = (date: Date, time: string) => {
  const result = new Date(date);
  const match = time.match(/(\d{2}):(\d{2})/);
  if (!match) {
    return undefined;
  }
  result.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return result;
};

const isReminderOverdue = (reminder: Reminder, now: Date) => {
  const reminderDate = parseDate(reminder.date);
  if (!reminderDate) {
    return false;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (reminderDate < startOfToday) {
    return true;
  }
  if (reminderDate.toDateString() !== now.toDateString() || !reminder.time) {
    return false;
  }

  const reminderMoment = dateWithTime(reminderDate, reminder.time);
  return !!reminderMoment && reminderMoment < now;
};

const customRangeBounds = () => {
  const startDate = parseDate(tempCustomRangeStart.value ?? customRangeStart.value);
  const endDate = parseDate(tempCustomRangeEnd.value ?? customRangeEnd.value);
  const startTime = tempCustomRangeStart.value
    ? tempCustomRangeStartTime.value
    : customRangeStartTime.value;
  const endTime = tempCustomRangeEnd.value
    ? tempCustomRangeEndTime.value
    : customRangeEndTime.value;
  if (!startDate || !endDate) {
    return undefined;
  }
  const start = dateWithTime(startDate, startTime);
  const end = dateWithTime(endDate, endTime);
  return start && end ? { start, end } : undefined;
};

const canApplyCustomFilter = computed(() => {
  if (!tempCustomRangeStart.value || !tempCustomRangeEnd.value) {
    return false;
  }
  const bounds = customRangeBounds();
  return !!bounds && bounds.start <= bounds.end;
});

const filteredReminders = computed(() => {
  const today = currentTime.value;
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

    if (dateFilter.value === 'overdue') {
      return isReminderOverdue(reminder, today);
    }

    if (dateFilter.value === 'custom') {
      if (!customRangeStart.value || !customRangeEnd.value) {
        return false;
      }

      const startDate = parseDate(customRangeStart.value);
      const endDate = parseDate(customRangeEnd.value);
      if (!startDate || !endDate) {
        return false;
      }

      const start = dateWithTime(startDate, customRangeStartTime.value);
      const end = dateWithTime(endDate, customRangeEndTime.value);
      if (!start || !end) {
        return false;
      }

      // Date-only reminders are all-day entries. They stay visible whenever
      // their calendar day is inside the selected range, independent of the
      // chosen boundary times.
      const reminderMoment = reminder.time ? dateWithTime(reminderDate, reminder.time) : undefined;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const matchesRange = reminderMoment
        ? reminderMoment >= start && reminderMoment <= end
        : reminderDate >= startDay && reminderDate <= endDay;
      const searchText = customFilterText.value.trim().toLowerCase();
      if (!searchText) {
        return matchesRange;
      }

      const textMatch = reminder.text.toLowerCase().includes(searchText) || (reminder.description ?? '').toLowerCase().includes(searchText);
      return matchesRange && textMatch;
    }

    return true;
  });
});

// Groups the list into clearly named time sections. Each group also carries its
// own visual tone and icon so the sections are recognisable at a glance.
// but only when no more specific date filter is active — otherwise the grouping
// would be redundant with (or contradict) the user's explicit filter choice.
const groupedReminders = computed(() => {
  if (dateFilter.value !== 'all') {
    const groupMeta: Record<Exclude<DateFilter, 'all'>, {
      label: string;
      icon: string;
      tone: string;
    }> = {
      today: { label: 'Heute', icon: todayOutline, tone: 'primary' },
      week: { label: 'Diese Woche', icon: calendarOutline, tone: 'week' },
      overdue: { label: 'Überfällig', icon: alertCircleOutline, tone: 'danger' },
      custom: { label: 'Individueller Zeitraum', icon: calendarOutline, tone: 'neutral' },
    };
    const meta = groupMeta[dateFilter.value];
    return [{
      key: dateFilter.value,
      label: meta.label,
      icon: meta.icon,
      tone: meta.tone,
      items: [...filteredReminders.value].sort(compareRemindersChronologically),
    }];
  }

  const today = currentTime.value;
  const buckets: Array<{
    key: string;
    label: string;
    icon: string;
    tone: string;
    items: Reminder[];
  }> = [
    { key: 'overdue', label: 'Überfällig', icon: alertCircleOutline, tone: 'danger', items: [] },
    { key: 'today', label: 'Heute', icon: todayOutline, tone: 'primary', items: [] },
    { key: 'week', label: 'Diese Woche', icon: calendarOutline, tone: 'week', items: [] },
    { key: 'upcoming', label: 'Zukünftig', icon: calendar, tone: 'upcoming', items: [] },
    { key: 'unscheduled', label: 'Ohne Termin', icon: removeCircleOutline, tone: 'neutral', items: [] },
  ];

  for (const reminder of filteredReminders.value) {
    const reminderDate = parseDate(reminder.date);
    if (!reminderDate) {
      buckets[4].items.push(reminder);
    } else if (isReminderOverdue(reminder, today)) {
      buckets[0].items.push(reminder);
    } else if (reminderDate.toDateString() === today.toDateString()) {
      // A date-only reminder applies to the whole day and therefore remains
      // under "Heute" until the date itself has passed.
      buckets[1].items.push(reminder);
    } else if (isSameWeek(reminderDate, today)) {
      buckets[2].items.push(reminder);
    } else {
      buckets[3].items.push(reminder);
    }
  }

  for (const bucket of buckets) {
    bucket.items.sort(compareRemindersChronologically);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
});

const reminderTimeInMinutes = (value?: string) => {
  const match = value?.match(/(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
};

const compareRemindersChronologically = (a: Reminder, b: Reminder) => {
  const dateA = parseDate(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const dateB = parseDate(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (dateA !== dateB) {
    return dateA - dateB;
  }

  const timeDifference = reminderTimeInMinutes(a.time) - reminderTimeInMinutes(b.time);
  if (timeDifference !== 0) {
    return timeDifference;
  }

  return a.text.localeCompare(b.text, 'de');
};

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
  // Not anchored to the start: handles both a clean "HH:mm" and a full ISO
  // datetime string like "2026-08-07T15:03:00" (older/unnormalized data).
  const match = value.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
};

// Full "Freitag, 14. August 2026" style used when actually displaying a
// reminder's date (as opposed to the compact "07.08.2026" used for the
// Von/Bis range-filter labels, where the long form would be too wide).
const formatLongDate = (value?: string) => {
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

const formatDateTime = (date?: string, time?: string) => {
  if (date && time) {
    return `${formatLongDate(date)}  ${formatTimeString(time)} Uhr`;
  }
  if (time) {
    return `${formatTimeString(time)} Uhr`;
  }
  if (date) {
    return formatLongDate(date);
  }
  return '';
};

const applyCustomFilter = () => {
  if (!canApplyCustomFilter.value || !tempCustomRangeStart.value || !tempCustomRangeEnd.value) {
    return;
  }
  customRangeStart.value = tempCustomRangeStart.value;
  customRangeEnd.value = tempCustomRangeEnd.value;
  customRangeStartTime.value = formatTimeString(tempCustomRangeStartTime.value);
  customRangeEndTime.value = formatTimeString(tempCustomRangeEndTime.value);
  customFilterText.value = tempCustomFilterText.value;
  dateFilter.value = 'custom';
  customModalOpen.value = false;
};

// Opening the dialog no longer changes the active filter, so cancelling simply
// closes it and leaves the previous selection untouched.
const cancelCustomFilter = () => {
  customModalOpen.value = false;
};

onMounted(() => {
  refreshView();
  refreshTimer = setInterval(() => {
    refreshView();
  }, 60_000);
  reminderUpdatedHandler.value = () => {
    refreshView();
  };
  window.addEventListener('reminderUpdated', reminderUpdatedHandler.value as EventListener);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  if (reminderUpdatedHandler.value) {
    window.removeEventListener('reminderUpdated', reminderUpdatedHandler.value as EventListener);
  }
});

onIonViewWillEnter(refreshView);

watch(route, () => {
  refreshView();
});
</script>

<style scoped>
/* Circular avatar crop: the source JPEG has a white background, which looked
   like a sticker pasted onto the tinted page as a rounded square. As a circle
   it reads as an intentional logo mark instead. */
.header-logo {
  width: 34px;
  height: 34px;
  object-fit: cover;
  border-radius: 50%;
  margin-right: 0.5rem;
}

/* Horizontally scrollable chip row, so additional ranges never squeeze. */
.filter-chips {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  padding: 0 0.75rem 0.25rem;
  scrollbar-width: none;
}

.filter-chips::-webkit-scrollbar {
  display: none;
}

.filter-chips ion-chip {
  flex-shrink: 0;
  margin: 0;
}

.range-block {
  margin-bottom: 1rem;
}

.range-block h3 {
  margin: 0 0 0.45rem 0.25rem;
  color: var(--ion-color-primary);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.range-block ion-item:first-of-type {
  --border-radius: 12px 12px 0 0;
}

.range-block ion-item:last-of-type {
  --border-radius: 0 0 12px 12px;
}

.custom-filter-footer {
  background: var(--ion-item-background);
  border-top: 1px solid rgba(var(--ion-color-medium-rgb), 0.16);
}

.custom-filter-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding: 0.75rem 1rem max(0.75rem, env(safe-area-inset-bottom));
}

.custom-filter-actions ion-button {
  min-height: 44px;
  margin: 0;
}

/* Each time bucket is its own card with a compact, coloured heading. This
   creates a much stronger hierarchy than headers floating inside one long list. */
.reminder-group {
  --group-color: var(--ion-color-medium);
  margin-bottom: 1.35rem;
}

.reminder-group--danger {
  --group-color: var(--ion-color-danger);
}

.reminder-group--primary {
  --group-color: var(--ion-color-primary);
}

.reminder-group--week {
  --group-color: #6b5dc6;
}

.reminder-group--upcoming {
  --group-color: #367b70;
}

.group-heading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 32px;
  margin: 0 0.35rem 0.55rem;
  color: var(--group-color);
}

.group-heading h2 {
  flex: 1;
  margin: 0;
  font-size: 0.98rem;
  font-weight: 750;
  letter-spacing: 0.01em;
}

.group-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--group-color) 13%, transparent);
}

.group-icon ion-icon {
  font-size: 17px;
}

.group-count {
  display: grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--group-color) 12%, transparent);
  font-size: 0.75rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.reminder-group ion-list {
  margin-bottom: 0;
  border: 1px solid color-mix(in srgb, var(--group-color) 12%, transparent);
}

.reminder-content {
  cursor: pointer;
}

.reminder-title {
  margin: 0 0 0.32rem;
  color: var(--ion-text-color, #1f2430);
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.reminder-date {
  display: flex;
  align-items: center;
  gap: 0.32rem;
  margin: 0;
  color: var(--ion-color-medium-shade);
  font-size: 0.82rem;
  line-height: 1.35;
}

.reminder-date ion-icon {
  flex: 0 0 auto;
  color: var(--group-color);
  font-size: 0.9rem;
}

/* Centres icon and text in the free area instead of letting them cling to the
   top with a large void underneath. */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* Fills the scrollable area of ion-content so the block is centred in the
     space actually left below the header, rather than at a fixed fraction of
     the viewport. */
  min-height: 100%;
}

.empty-state-icon {
  font-size: 64px;
  color: var(--ion-color-medium);
  margin-bottom: 0.5rem;
}

.done .reminder-title,
.done p {
  text-decoration: line-through;
  opacity: 0.6;
}
</style>
