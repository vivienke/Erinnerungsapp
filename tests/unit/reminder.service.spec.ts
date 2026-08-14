import { beforeEach, describe, expect, it, vi } from 'vitest';

/** These tests pretend to run on Android and record the plugin calls. */

const store = new Map<string, string>();
const scheduled: Array<Record<string, unknown>> = [];
const cancelled: number[] = [];

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
  },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      store.set(key, value);
    },
  },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: async ({ notifications }: { notifications: Array<Record<string, unknown>> }) => {
      scheduled.push(...notifications);
    },
    cancel: async ({ notifications }: { notifications: Array<{ id: number }> }) => {
      cancelled.push(...notifications.map((n) => n.id));
    },
    createChannel: async () => undefined,
    registerActionTypes: async () => undefined,
    addListener: () => ({ remove: () => undefined }),
    checkPermissions: async () => ({ display: 'granted' }),
    requestPermissions: async () => ({ display: 'granted' }),
    checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
    changeExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
  },
}));

const {
  addOrUpdateReminder,
  getReminder,
  hasRemindersNeedingNotificationPermission,
  loadReminders,
  removeReminder,
} = await import('@/services/reminder.service');

/** "YYYY-MM-DD" a given number of days from today. */
const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const future = dayOffset(2);
const past = dayOffset(-2);

beforeEach(() => {
  store.clear();
  scheduled.length = 0;
  cancelled.length = 0;
});

describe('Benachrichtigung planen', () => {
  it('plant eine Benachrichtigung, wenn Datum und Uhrzeit in der Zukunft liegen', async () => {
    const saved = await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00' });

    expect(scheduled).toHaveLength(1);
    expect(saved.notificationId).toBeDefined();
    expect(scheduled[0].id).toBe(saved.notificationId);
    expect(scheduled[0].body).toBe('Jetzt: Test');
  });

  it('weckt das Gerät (allowWhileIdle), sonst kommt nichts an, wenn das Handy schläft', async () => {
    await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00' });

    expect((scheduled[0].schedule as { allowWhileIdle?: boolean }).allowWhileIdle).toBe(true);
  });

  it('zieht den Vorlauf vom Termin ab', async () => {
    await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      notificationOffsetMinutes: 60,
    });

    const at = (scheduled[0].schedule as { at: Date }).at;
    expect(at.getHours()).toBe(9);
    expect(at.getMinutes()).toBe(0);
    expect(scheduled[0].body).toBe('In 1 Stunde: Test');
  });

  it('nennt bei zehn Minuten Vorlauf die verbleibende Zeit im Popup', async () => {
    await addOrUpdateReminder({
      id: 'r1',
      text: 'Arzttermin',
      date: future,
      time: '10:00',
      notificationOffsetMinutes: 10,
    });

    expect(scheduled[0].body).toBe('In 10 Minuten: Arzttermin');
  });

  it('plant nichts ohne Uhrzeit', async () => {
    const saved = await addOrUpdateReminder({ id: 'r1', text: 'Nur Datum', date: future });

    expect(scheduled).toHaveLength(0);
    expect(saved.notificationId).toBeUndefined();
  });

  it('plant nichts, wenn der Zeitpunkt bereits vergangen ist', async () => {
    const saved = await addOrUpdateReminder({ id: 'r1', text: 'Alt', date: past, time: '10:00' });

    expect(scheduled).toHaveLength(0);
    expect(saved.notificationId).toBeUndefined();
  });

  it('speichert auch einen vergangenen Termin, wenn „Keine“ gewählt wurde', async () => {
    const saved = await addOrUpdateReminder({
      id: 'r1',
      text: 'Ohne Benachrichtigung',
      date: past,
      time: '10:00',
      notificationOffsetMinutes: null,
    });

    expect(scheduled).toHaveLength(0);
    expect(saved.notificationId).toBeUndefined();
    expect(saved.notificationOffsetMinutes).toBeNull();
  });
});

describe('Berechtigungsbedarf', () => {
  it('besteht nur für offene Erinnerungen mit einem zukünftigen Benachrichtigungszeitpunkt', async () => {
    await addOrUpdateReminder({ id: 'future', text: 'Zukünftig', date: future, time: '10:00' });

    expect(await hasRemindersNeedingNotificationPermission()).toBe(true);
  });

  it('besteht nicht bei „Keine“, erledigten oder vergangenen Erinnerungen', async () => {
    await addOrUpdateReminder({
      id: 'none',
      text: 'Keine',
      date: future,
      time: '10:00',
      notificationOffsetMinutes: null,
    });
    await addOrUpdateReminder({
      id: 'done',
      text: 'Erledigt',
      date: future,
      time: '10:00',
      done: true,
    });
    await addOrUpdateReminder({ id: 'past', text: 'Vergangen', date: past, time: '10:00' });

    expect(await hasRemindersNeedingNotificationPermission()).toBe(false);
  });
});

describe('Bearbeiten', () => {
  it('storniert die alte Benachrichtigung und plant eine neue', async () => {
    const first = await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00' });
    scheduled.length = 0;
    cancelled.length = 0;

    await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '15:30' });

    expect(cancelled).toContain(first.notificationId);
    expect(scheduled).toHaveLength(1);
    const at = (scheduled[0].schedule as { at: Date }).at;
    expect(at.getHours()).toBe(15);
    expect(at.getMinutes()).toBe(30);
  });

  it('behält Felder, die beim Bearbeiten nicht mitgeschickt werden', async () => {
    await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      description: 'Meine Notiz',
      notificationOffsetMinutes: 60,
    });

    await addOrUpdateReminder({ id: 'r1', text: 'Neuer Titel', date: future, time: '10:00' });

    const stored = await getReminder('r1');
    expect(stored?.text).toBe('Neuer Titel');
    expect(stored?.description).toBe('Meine Notiz');
    expect(stored?.notificationOffsetMinutes).toBe(60);
  });

  it('entfernt die Benachrichtigung, wenn das Datum gelöscht wird', async () => {
    const first = await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00' });
    scheduled.length = 0;
    cancelled.length = 0;

    const saved = await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: undefined,
      time: '10:00',
    });

    expect(cancelled).toContain(first.notificationId);
    expect(scheduled).toHaveLength(0);
    expect(saved.notificationId).toBeUndefined();
  });

  it('storniert die bestehende Benachrichtigung, wenn „Keine“ gewählt wird', async () => {
    const first = await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00' });
    scheduled.length = 0;
    cancelled.length = 0;

    const saved = await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      notificationOffsetMinutes: null,
    });

    expect(cancelled).toContain(first.notificationId);
    expect(scheduled).toHaveLength(0);
    expect(saved.notificationId).toBeUndefined();
  });
});

describe('Erledigt', () => {
  it('storniert die Benachrichtigung, wenn eine Erinnerung als erledigt markiert wird', async () => {
    const first = await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00' });
    scheduled.length = 0;
    cancelled.length = 0;

    const saved = await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      done: true,
    });

    expect(cancelled).toContain(first.notificationId);
    expect(scheduled).toHaveLength(0);
    expect(saved.notificationId).toBeUndefined();
  });

  it('plant erneut, wenn erledigt zurückgenommen wird', async () => {
    await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      done: true,
    });
    scheduled.length = 0;

    const saved = await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      done: false,
    });

    expect(scheduled).toHaveLength(1);
    expect(saved.notificationId).toBeDefined();
  });

  it('behält den erledigt-Status, wenn er beim Bearbeiten nicht mitgeschickt wird', async () => {
    await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00', done: true });

    await addOrUpdateReminder({ id: 'r1', text: 'Geändert', date: future, time: '10:00' });

    const stored = await getReminder('r1');
    expect(stored?.done).toBe(true);
  });

  // The editor sends the status explicitly, so switching it there has to take
  // effect on the notification as well.
  it('plant wieder, wenn der Status im Editor auf offen gesetzt wird', async () => {
    await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00', done: true });
    scheduled.length = 0;

    const saved = await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      done: false,
    });

    expect(scheduled).toHaveLength(1);
    expect(saved.done).toBe(false);
    expect(saved.notificationId).toBeDefined();
  });

  it('storniert, wenn der Status im Editor auf erledigt gesetzt wird', async () => {
    const first = await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      done: false,
    });
    scheduled.length = 0;
    cancelled.length = 0;

    const saved = await addOrUpdateReminder({
      id: 'r1',
      text: 'Test',
      date: future,
      time: '10:00',
      done: true,
    });

    expect(cancelled).toContain(first.notificationId);
    expect(scheduled).toHaveLength(0);
    expect(saved.done).toBe(true);
    expect(saved.notificationId).toBeUndefined();
  });
});

describe('Löschen', () => {
  it('storniert die geplante Benachrichtigung', async () => {
    const first = await addOrUpdateReminder({ id: 'r1', text: 'Test', date: future, time: '10:00' });
    cancelled.length = 0;

    await removeReminder('r1');

    expect(cancelled).toContain(first.notificationId);
    expect(await loadReminders()).toHaveLength(0);
  });

  it('lässt andere Erinnerungen unangetastet', async () => {
    await addOrUpdateReminder({ id: 'r1', text: 'Eins', date: future, time: '10:00' });
    const second = await addOrUpdateReminder({ id: 'r2', text: 'Zwei', date: future, time: '11:00' });
    cancelled.length = 0;

    await removeReminder('r1');

    const rest = await loadReminders();
    expect(rest.map((r) => r.id)).toEqual(['r2']);
    expect(cancelled).not.toContain(second.notificationId);
  });
});

describe('Benachrichtigungs-IDs', () => {
  it('vergibt unterschiedliche IDs für unterschiedliche Erinnerungen', async () => {
    const a = await addOrUpdateReminder({ id: 'r1', text: 'A', date: future, time: '10:00' });
    const b = await addOrUpdateReminder({ id: 'r2', text: 'B', date: future, time: '10:00' });

    expect(a.notificationId).not.toBe(b.notificationId);
  });

  it('bleibt für dieselbe Erinnerung stabil', async () => {
    const first = await addOrUpdateReminder({ id: 'r1', text: 'A', date: future, time: '10:00' });
    const again = await addOrUpdateReminder({ id: 'r1', text: 'A', date: future, time: '11:00' });

    expect(again.notificationId).toBe(first.notificationId);
  });
});
