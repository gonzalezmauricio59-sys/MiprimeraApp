import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const isNative = Capacitor.isNativePlatform();

function hashId(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

async function ensurePermission() {
  if (!isNative) return false;
  const current = await LocalNotifications.checkPermissions();
  let granted = current.display === 'granted';
  if (!granted) {
    const requested = await LocalNotifications.requestPermissions();
    granted = requested.display === 'granted';
  }
  try {
    const exact = await LocalNotifications.checkExactNotificationSetting();
    if (exact.exact_alarm !== 'granted') {
      await LocalNotifications.changeExactNotificationSetting();
    }
  } catch (e) { /* no disponible en esta versión de Android, no es crítico */ }
  return granted;
}

function allNotificationIdsFor(alarmId) {
  const base = hashId(alarmId) * 10;
  const ids = [base];
  for (let weekday = 1; weekday <= 7; weekday++) ids.push(base + weekday);
  return ids;
}

async function cancelNativeAlarm(alarmId) {
  if (!isNative) return;
  const ids = allNotificationIdsFor(alarmId).map(id => ({ id }));
  try { await LocalNotifications.cancel({ notifications: ids }); } catch (e) { /* nada programado */ }
}

async function scheduleNativeAlarm(alarm) {
  if (!isNative) return;
  await cancelNativeAlarm(alarm.id);
  if (!alarm.enabled) return;

  const granted = await ensurePermission();
  if (!granted) return;

  const [hh, mm] = alarm.time.split(':').map(Number);
  const base = hashId(alarm.id) * 10;
  const title = alarm.label ? alarm.label : 'Alarma motivacional';
  const body = 'Tocá para ver tu frase de motivación';
  const notifications = [];

  if (alarm.days && alarm.days.length > 0) {
    for (const day of alarm.days) {
      const weekday = day + 1; // JS getDay(): 0=Dom..6=Sab -> Capacitor: 1=Dom..7=Sab
      notifications.push({
        id: base + weekday,
        title,
        body,
        schedule: { on: { weekday, hour: hh, minute: mm }, allowWhileIdle: true },
        extra: { alarmId: alarm.id }
      });
    }
  } else {
    const now = new Date();
    const next = new Date();
    next.setHours(hh, mm, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    notifications.push({
      id: base,
      title,
      body,
      schedule: { at: next, allowWhileIdle: true },
      extra: { alarmId: alarm.id }
    });
  }

  try {
    await LocalNotifications.schedule({ notifications });
  } catch (e) {
    console.warn('No se pudo programar la notificación nativa', e);
  }
}

async function syncAllAlarms(alarms) {
  if (!isNative) return;
  for (const alarm of alarms) {
    await scheduleNativeAlarm(alarm);
  }
}

let onOpenCallback = null;
function onAlarmOpened(cb) { onOpenCallback = cb; }

if (isNative) {
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const alarmId = action?.notification?.extra?.alarmId;
    if (alarmId && onOpenCallback) onOpenCallback(alarmId);
  });
}

window.NativeAlarm = {
  isNative,
  ensurePermission,
  scheduleNativeAlarm,
  cancelNativeAlarm,
  syncAllAlarms,
  onAlarmOpened
};
