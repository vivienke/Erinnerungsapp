import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

export interface Reminder {
  id: string;
  text: string;
  date?: string;
  time?: string;
  description?: string;
  done?: boolean;
  notificationId?: number;
  notificationOffsetMinutes?: number;
}

const STORAGE_KEY = 'reminders';
const ACTION_TYPE_ID = 'REMINDER_ACTIONS';
const CHANNEL_ID = 'reminders';

let listenersRegistered = false;

export async function initializeReminderService(onReminderDeleted?: (id: string) => void) {
  if (Capacitor.getPlatform() === 'web') {
    return;
  }

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') {
    console.warn('Local notification permission was not granted.');
  }

  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Erinnerungen',
    importance: 5,
  });

  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE_ID,
        actions: [
          {
            id: 'COMPLETE',
            title: 'Erledigt',
          },
        ],
      },
    ],
  });

  if (!listenersRegistered) {
    LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      const notification = action?.notification;
      const extra = notification?.extra as { reminderId?: string } | undefined;
      const reminderId = extra?.reminderId as string | undefined;
      if (action?.actionId === 'COMPLETE' && reminderId) {
        await removeReminder(reminderId);
        onReminderDeleted?.(reminderId);
      }
    });
    listenersRegistered = true;
  }
}

async function getStorageValue(key: string): Promise<string | null> {
  if (Capacitor.getPlatform() === 'web') {
    return localStorage.getItem(key);
  }

  const result = await Preferences.get({ key });
  return result.value;
}

async function setStorageValue(key: string, value: string): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    localStorage.setItem(key, value);
    return;
  }

  await Preferences.set({ key, value });
}

export async function loadReminders(): Promise<Reminder[]> {
  const value = await getStorageValue(STORAGE_KEY);
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value) as Reminder[];
  } catch {
    return [];
  }
}

export async function saveReminders(reminders: Reminder[]) {
  await setStorageValue(STORAGE_KEY, JSON.stringify(reminders));
}

export async function getReminder(id: string): Promise<Reminder | undefined> {
  const reminders = await loadReminders();
  return reminders.find((item) => item.id === id);
}

export async function addOrUpdateReminder(reminder: Reminder): Promise<Reminder> {
  const reminders = await loadReminders();
  const existingIndex = reminders.findIndex((item) => item.id === reminder.id);
  const existing = reminders[existingIndex];

  if (existing?.notificationId) {
    await cancelNotification(existing.notificationId);
  }

  const updatedReminder: Reminder = {
    ...existing,
    ...reminder,
    done: reminder.done ?? existing?.done ?? false,
  };

  const notificationId = await scheduleNotificationForReminder(updatedReminder);

  const finalReminder: Reminder = {
    ...updatedReminder,
    notificationId,
  };

  if (existingIndex >= 0) {
    reminders[existingIndex] = finalReminder;
  } else {
    reminders.push(finalReminder);
  }

  await saveReminders(reminders);
  return finalReminder;
}

export async function removeReminder(id: string): Promise<void> {
  const reminders = await loadReminders();
  const reminder = reminders.find((item) => item.id === id);
  if (!reminder) {
    return;
  }

  if (reminder.notificationId) {
    await cancelNotification(reminder.notificationId);
  }

  const next = reminders.filter((item) => item.id !== id);
  await saveReminders(next);
}

function parseReminderDateTime(date: string, time?: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  let hour = 9;
  let minute = 0;

  if (time) {
    const [h, m] = time.split(':').map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      hour = h;
      minute = m;
    }
  }

  return new Date(year, month - 1, day, hour, minute, 0);
}

async function scheduleNotificationForReminder(reminder: Reminder): Promise<number | undefined> {
  if (Capacitor.getPlatform() === 'web') {
    return undefined;
  }

  if (reminder.done || reminder.notificationOffsetMinutes == null) {
    return undefined;
  }

  if (!reminder.date) {
    return undefined;
  }

  const eventDate = parseReminderDateTime(reminder.date, reminder.time);
  if (!eventDate || Number.isNaN(eventDate.getTime())) {
    return undefined;
  }

  const scheduleAt = new Date(eventDate.getTime() - reminder.notificationOffsetMinutes * 60 * 1000);
  if (Number.isNaN(scheduleAt.getTime())) {
    return undefined;
  }

  const notificationId = Math.floor(Date.now() % 1000000000);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: 'Erinnerung',
        body: reminder.text,
        schedule: { at: scheduleAt },
        extra: { reminderId: reminder.id },
        channelId: CHANNEL_ID,
        actionTypeId: ACTION_TYPE_ID,
      },
    ],
  });

  return notificationId;
}

async function cancelNotification(notificationId: number): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    return;
  }

  await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
}
