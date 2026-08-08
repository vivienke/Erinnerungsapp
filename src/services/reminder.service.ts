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
let exactAlarmPromptShown = false;

export type NotificationPermission = 'granted' | 'denied' | 'unavailable';

/**
 * Returns the current notification permission, asking the user only when that
 * can actually still produce a system dialog.
 *
 * Android shows the permission dialog only while the state is "prompt". Once
 * the user has denied it, requestPermissions() resolves to "denied" without
 * displaying anything — so blindly calling it on every start looks like
 * "nothing happens". Callers get "denied" back and can explain to the user
 * that it now has to be re-enabled in the system settings.
 */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (Capacitor.getPlatform() === 'web') {
    return 'unavailable';
  }

  let status = await LocalNotifications.checkPermissions();

  if (status.display === 'prompt' || status.display === 'prompt-with-rationale') {
    status = await LocalNotifications.requestPermissions();
  }

  if (status.display !== 'granted') {
    return 'denied';
  }

  // Android 12+ (API 31+) requires the separate "exact alarms" setting for notifications
  // to fire at the precise scheduled time. Without it, the OS silently falls back to
  // inexact delivery, which can arrive noticeably late for time-based reminders.
  // This opens a system settings screen, so it is only triggered once per app run
  // and only after notifications themselves were actually allowed.
  if (Capacitor.getPlatform() === 'android' && !exactAlarmPromptShown) {
    try {
      const exactAlarmStatus = await LocalNotifications.checkExactNotificationSetting();
      if (exactAlarmStatus.exact_alarm !== 'granted') {
        exactAlarmPromptShown = true;
        await LocalNotifications.changeExactNotificationSetting();
      }
    } catch (error) {
      console.warn('Exact alarm permission could not be requested.', error);
    }
  }

  return 'granted';
}

export interface ReminderNotificationHandlers {
  /** The reminder was marked as done via the notification action. */
  onReminderCompleted?: (id: string) => void;
  /** The notification body itself was tapped — the user wants to see it. */
  onReminderOpened?: (id: string) => void;
}

export async function initializeReminderService(handlers: ReminderNotificationHandlers = {}) {
  if (Capacitor.getPlatform() === 'web') {
    return;
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
      const extra = action?.notification?.extra as { reminderId?: string } | undefined;
      const reminderId = extra?.reminderId;
      if (!reminderId) {
        return;
      }

      if (action.actionId === 'COMPLETE') {
        // Tapping "Erledigt" on the notification should behave like ticking the
        // checkbox in the app (mark as done, keep it in the list/history) — it
        // must not permanently delete the reminder, which is what happened here
        // before (removeReminder was called instead of marking it done).
        const existing = await getReminder(reminderId);
        if (existing) {
          await addOrUpdateReminder({ ...existing, done: true });
        }
        handlers.onReminderCompleted?.(reminderId);
        return;
      }

      // Capacitor reports a tap on the notification body itself as "tap".
      // This used to be ignored, so opening a reminder from its notification
      // simply did nothing.
      if (action.actionId === 'tap') {
        handlers.onReminderOpened?.(reminderId);
      }
    });
    listenersRegistered = true;
  }
}

// Preferences works on every platform — it uses SharedPreferences on Android,
// UserDefaults on iOS and falls back to localStorage on the web itself. The
// previous manual web branch bypassed the plugin for no benefit, so persistence
// now goes through Preferences everywhere.
async function getStorageValue(key: string): Promise<string | null> {
  const result = await Preferences.get({ key });
  return result.value;
}

async function setStorageValue(key: string, value: string): Promise<void> {
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
  // ion-datetime returns a full ISO datetime string (e.g. "2026-08-14T15:03:00")
  // even for presentation="date", so the Y-M-D part is matched out rather than
  // split on "-" — a plain split turns the day into "14T15:03:00" => NaN and
  // silently aborted the whole scheduling.
  const dateMatch = date.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    return undefined;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  let hour = 9;
  let minute = 0;

  if (time) {
    // ion-datetime's value for presentation="time" is a full ISO datetime
    // string (e.g. "2026-08-07T15:03:00"), not a bare "HH:mm" — so the
    // HH:mm pair is extracted from wherever it appears rather than assumed
    // to be at the start of the string.
    const match = time.match(/(\d{2}):(\d{2})/);
    if (match) {
      hour = Number(match[1]);
      minute = Number(match[2]);
    }
  }

  return new Date(year, month - 1, day, hour, minute, 0);
}

async function scheduleNotificationForReminder(reminder: Reminder): Promise<number | undefined> {
  if (Capacitor.getPlatform() === 'web') {
    return undefined;
  }

  if (reminder.done) {
    return undefined;
  }

  // Requirement: a notification must be scheduled whenever both a date AND a time are set.
  if (!reminder.date || !reminder.time) {
    return undefined;
  }

  const eventDate = parseReminderDateTime(reminder.date, reminder.time);
  if (!eventDate || Number.isNaN(eventDate.getTime())) {
    return undefined;
  }

  const offsetMinutes = reminder.notificationOffsetMinutes ?? 0;
  const scheduleAt = new Date(eventDate.getTime() - offsetMinutes * 60 * 1000);
  if (Number.isNaN(scheduleAt.getTime())) {
    return undefined;
  }

  // A time in the past never fires, so it is pointless to register it. This
  // happens easily with an offset ("1 Tag davor" for an appointment that is
  // only hours away), which previously looked like "notifications are broken".
  if (scheduleAt.getTime() <= Date.now()) {
    console.warn('Notification time is in the past, nothing scheduled.', scheduleAt);
    return undefined;
  }

  const notificationId = notificationIdFor(reminder.id);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: 'Erinnerung',
        // The system popup should immediately explain how far away the actual
        // appointment is, not only repeat the reminder title.
        body: `${notificationTimingLabel(offsetMinutes)}: ${reminder.text}`,
        // allowWhileIdle is essential: without it the plugin registers the alarm
        // with AlarmManager.RTC (not RTC_WAKEUP), so it does not wake a sleeping
        // device and the reminder silently fails to appear until the phone is
        // unlocked again — exactly the "no notification arrives" symptom.
        schedule: { at: scheduleAt, allowWhileIdle: true },
        extra: { reminderId: reminder.id },
        channelId: CHANNEL_ID,
        actionTypeId: ACTION_TYPE_ID,
      },
    ],
  });

  return notificationId;
}

function notificationTimingLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'Jetzt';
  if (offsetMinutes === 60) return 'In 1 Stunde';
  if (offsetMinutes === 1440) return 'In 1 Tag';
  return `In ${offsetMinutes} Minuten`;
}

/**
 * Derives a stable 31-bit id from the reminder id, so the same reminder always
 * maps to the same notification. The previous timestamp-based id could collide
 * for reminders saved within the same millisecond and made cancelling unreliable.
 */
function notificationIdFor(reminderId: string): number {
  let hash = 0;
  for (let i = 0; i < reminderId.length; i++) {
    hash = (hash * 31 + reminderId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2000000000) + 1;
}

async function cancelNotification(notificationId: number): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    return;
  }

  await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
}
