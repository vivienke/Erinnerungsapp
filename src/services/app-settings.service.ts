import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppSettingsPlugin {
  openNotificationSettings(): Promise<void>;
}

const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');

export function canOpenNotificationSettings(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function openNotificationSettings(): Promise<void> {
  await AppSettings.openNotificationSettings();
}
