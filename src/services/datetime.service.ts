import { Capacitor } from '@capacitor/core';
import { DatetimePicker } from '@capawesome-team/capacitor-datetime-picker';

/**
 * Native datetime picking via @capawesome-team/capacitor-datetime-picker.
 *
 * The plugin is Android/iOS only, so callers check `isNativePickerAvailable()`
 * and fall back to an inline ion-datetime in the browser preview.
 *
 * Both helpers request the exact format the app stores ("yyyy-MM-dd" / "HH:mm"),
 * which avoids the full ISO strings ion-datetime returns and the parsing
 * problems those caused.
 */

export function isNativePickerAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

const COMMON_OPTIONS = {
  locale: 'de-DE',
  theme: 'auto',
  cancelButtonText: 'Abbrechen',
  doneButtonText: 'OK',
} as const;

const DATE_FORMAT = 'yyyy-MM-dd';
const TIME_FORMAT = 'HH:mm';

/**
 * The plugin parses the `value` prefill with the very same `format` string it
 * uses for the result (SimpleDateFormat on Android). Passing an ISO datetime
 * while `format` is "HH:mm" therefore throws a ParseException and the picker
 * never opens — so prefills must already be in the requested format.
 */
function prefillFor(pattern: RegExp, value?: string): string | undefined {
  return value?.match(pattern)?.[0];
}

/** The plugin rejects with these codes when the user closes the picker. */
function isUserCancellation(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  return code === 'canceled' || code === 'dismissed';
}

/** Returns "YYYY-MM-DD", or undefined when the user cancelled. */
export async function pickDate(current?: string): Promise<string | undefined> {
  const prefill = prefillFor(/\d{4}-\d{2}-\d{2}/, current);
  try {
    const { value } = await DatetimePicker.present({
      ...COMMON_OPTIONS,
      mode: 'date',
      format: DATE_FORMAT,
      androidDatePickerMode: 'calendar',
      ...(prefill ? { value: prefill } : {}),
    });
    return value;
  } catch (error) {
    // Only cancelling is expected here; anything else is logged rather than
    // swallowed, which is what previously hid a broken prefill.
    if (!isUserCancellation(error)) {
      console.error('Date picker failed', error);
    }
    return undefined;
  }
}

/** Returns "HH:mm", or undefined when the user cancelled. */
export async function pickTime(current?: string): Promise<string | undefined> {
  const prefill = prefillFor(/\d{2}:\d{2}/, current);
  try {
    const { value } = await DatetimePicker.present({
      ...COMMON_OPTIONS,
      mode: 'time',
      format: TIME_FORMAT,
      androidTimePickerMode: 'clock',
      ...(prefill ? { value: prefill } : {}),
    });
    return value;
  } catch (error) {
    if (!isUserCancellation(error)) {
      console.error('Time picker failed', error);
    }
    return undefined;
  }
}
