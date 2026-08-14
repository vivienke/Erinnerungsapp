import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { alertController } from '@ionic/vue';
import {
  ensureNotificationPermission,
  type NotificationPermission,
} from '@/services/reminder.service';
import {
  canOpenNotificationSettings,
  openNotificationSettings,
} from '@/services/app-settings.service';

let permissionHintShown = false;
let suppressDeniedDialogUntil = 0;

/**
 * Uses Android's real permission popup while the decision is still open. If
 * permission was permanently denied, it offers a direct route to the app's
 * notification settings because Android cannot display that popup again.
 */
export async function requestNotificationPermissionWithFeedback(
  showDeniedDialogAgain = false,
): Promise<NotificationPermission> {
  let systemDialogCanAppear = false;
  try {
    const current = await LocalNotifications.checkPermissions();
    systemDialogCanAppear = current.display === 'prompt' || current.display === 'prompt-with-rationale';
  } catch {
    // ensureNotificationPermission handles and reports unsupported platforms.
  }

  const permission = await ensureNotificationPermission();

  if (permission === 'granted') {
    permissionHintShown = false;
    return permission;
  }

  // If the system dialog was just shown and the user selected "Don't allow",
  // do not immediately stack another dialog on top of that decision. A later
  // save attempt may offer the settings route instead.
  if (permission === 'denied' && systemDialogCanAppear) {
    suppressDeniedDialogUntil = Date.now() + 2000;
    return permission;
  }

  if (permission === 'denied' && Date.now() < suppressDeniedDialogUntil) {
    return permission;
  }

  if (permissionHintShown && !showDeniedDialogAgain) {
    return permission;
  }

  permissionHintShown = true;
  const canOpenSettings = permission === 'denied' && canOpenNotificationSettings();
  const message = permission === 'denied'
    ? Capacitor.getPlatform() === 'web'
      ? 'Benachrichtigungen sind deaktiviert. Du kannst sie in den Website-Einstellungen deines Browsers wieder aktivieren.'
      : 'Benachrichtigungen sind deaktiviert. Du kannst sie in den App-Einstellungen wieder aktivieren.'
    : 'Benachrichtigungen werden auf diesem Gerät oder Browser nicht unterstützt.';

  const alert = await alertController.create({
    cssClass: 'notification-permission-alert',
    header: permission === 'denied'
      ? 'Benachrichtigungen deaktiviert'
      : 'Benachrichtigungen nicht verfügbar',
    message,
    buttons: canOpenSettings
      ? [
          { text: 'Abbrechen', role: 'cancel' },
          {
            text: 'Einstellungen öffnen',
            handler: () => {
              void openNotificationSettings().catch((error) => {
                console.warn('Notification settings could not be opened.', error);
              });
            },
          },
        ]
      : ['Verstanden'],
  });
  await alert.present();

  return permission;
}
