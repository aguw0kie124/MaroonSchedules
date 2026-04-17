import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { DiningMealPeriod } from './diningMenuCache';
import { getDiningMealWindow, resolveDiningLocationForMenu } from './diningMenuCache';
import { parseLocalDateString } from './dateUtils';
import { cancelNotification, requestNotificationPermissions } from './notificationService';
import { useEventStore } from '../store/eventStore';

const DINING_REMINDERS_KEY = 'dining-menu-reminders-v1';

export type DiningReminderRecord = {
  id: string;
  itemName: string;
  categoryName: string;
  location: string;
  resolvedLocation: string;
  dateKey: string;
  mealPeriod: DiningMealPeriod;
  startDateIso: string;
  endDateIso: string;
  notificationId: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
};

type DiningReminderStore = Record<string, DiningReminderRecord>;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shortenLocation(locationName: string) {
  const lowered = locationName.toLowerCase();
  if (lowered.includes('commons')) return 'Commons';
  if (lowered.includes('sbisa')) return 'Sbisa';
  if (lowered.includes('duncan')) return 'Duncan';
  return locationName.replace(/\s+dining hall.*$/i, '').trim();
}

function buildReminderId(
  resolvedLocation: string,
  dateKey: string,
  mealPeriod: DiningMealPeriod,
  itemName: string,
) {
  return `dining-reminder:${slugify(resolvedLocation)}:${dateKey}:${mealPeriod}:${slugify(itemName)}`;
}

function buildTimelineTitle(itemName: string, mealPeriod: DiningMealPeriod, locationName: string) {
  return `${itemName} ${mealPeriod.charAt(0).toUpperCase() + mealPeriod.slice(1)} ${shortenLocation(locationName)}`;
}

async function readReminderStore(): Promise<DiningReminderStore> {
  const rawValue = await AsyncStorage.getItem(DINING_REMINDERS_KEY);
  if (!rawValue) return {};
  try {
    return JSON.parse(rawValue) as DiningReminderStore;
  } catch (_error) {
    return {};
  }
}

async function writeReminderStore(store: DiningReminderStore) {
  await AsyncStorage.setItem(DINING_REMINDERS_KEY, JSON.stringify(store));
}

function buildMealDates(dateKey: string, mealPeriod: DiningMealPeriod, location: string) {
  const baseDate = parseLocalDateString(dateKey);
  const mealWindow = getDiningMealWindow(location, mealPeriod, baseDate);
  const startDate = new Date(baseDate);
  const endDate = new Date(baseDate);

  if (mealWindow) {
    startDate.setHours(
      Math.floor(mealWindow.startMinutes / 60),
      mealWindow.startMinutes % 60,
      0,
      0,
    );
    endDate.setHours(
      Math.floor(mealWindow.endMinutes / 60),
      mealWindow.endMinutes % 60,
      0,
      0,
    );
  } else {
    startDate.setHours(12, 0, 0, 0);
    endDate.setHours(13, 0, 0, 0);
  }

  return {
    startDate,
    endDate,
  };
}

async function scheduleDiningNotification(
  title: string,
  body: string,
  startDate: Date,
  reminderId: string,
) {
  const triggerDate: Notifications.NotificationTriggerInput =
    startDate.getTime() <= Date.now()
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
        } as Notifications.TimeIntervalTriggerInput
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: startDate.getTime(),
        } as Notifications.DateTriggerInput;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Reminder: ${title}`,
      body,
      sound: false,
      data: {
        type: 'dining_menu_reminder',
        reminderId,
        startDate: startDate.toISOString(),
      },
    },
    trigger: triggerDate,
  });
}

export async function getDiningReminderIds() {
  const store = await readReminderStore();
  return new Set(Object.keys(store));
}

export function getDiningReminderId(params: {
  location: string;
  dateKey: string;
  mealPeriod: DiningMealPeriod;
  itemName: string;
}) {
  const resolvedLocation = resolveDiningLocationForMenu(params.location) || params.location;
  return buildReminderId(resolvedLocation, params.dateKey, params.mealPeriod, params.itemName);
}

export async function toggleDiningReminder(params: {
  itemName: string;
  categoryName: string;
  location: string;
  dateKey: string;
  mealPeriod: DiningMealPeriod;
  locationLat?: number | null;
  locationLng?: number | null;
}) {
  const resolvedLocation = resolveDiningLocationForMenu(params.location) || params.location;
  const reminderId = buildReminderId(
    resolvedLocation,
    params.dateKey,
    params.mealPeriod,
    params.itemName,
  );
  const reminderStore = await readReminderStore();
  const existing = reminderStore[reminderId];

  if (existing) {
    if (existing.notificationId) {
      await cancelNotification(existing.notificationId).catch(() => null);
    }
    delete reminderStore[reminderId];
    await writeReminderStore(reminderStore);
    useEventStore.getState().removeScheduledEvent(reminderId);
    return { status: 'removed' as const, reminderId };
  }

  const granted = await requestNotificationPermissions();
  if (!granted) {
    return { status: 'permission-denied' as const, reminderId };
  }

  const { startDate, endDate } = buildMealDates(
    params.dateKey,
    params.mealPeriod,
    resolvedLocation,
  );
  const timelineTitle = buildTimelineTitle(
    params.itemName,
    params.mealPeriod,
    resolvedLocation,
  );
  const body = `${params.categoryName} at ${resolvedLocation} starts at ${startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}.`;

  const notificationId = await scheduleDiningNotification(
    timelineTitle,
    body,
    startDate,
    reminderId,
  );

  const record: DiningReminderRecord = {
    id: reminderId,
    itemName: params.itemName,
    categoryName: params.categoryName,
    location: params.location,
    resolvedLocation,
    dateKey: params.dateKey,
    mealPeriod: params.mealPeriod,
    startDateIso: startDate.toISOString(),
    endDateIso: endDate.toISOString(),
    notificationId,
    locationLat: params.locationLat ?? null,
    locationLng: params.locationLng ?? null,
  };

  reminderStore[reminderId] = record;
  await writeReminderStore(reminderStore);

  useEventStore.getState().scheduleEvent({
    id: reminderId,
    title: timelineTitle,
    location: resolvedLocation,
    description: `${params.itemName} at ${params.categoryName}`,
    date_ts: Math.floor(startDate.getTime() / 1000),
    date_iso: startDate.toISOString(),
    endDate_ts: Math.floor(endDate.getTime() / 1000),
    category: 'Dining',
    location_lat: params.locationLat ?? null,
    location_lng: params.locationLng ?? null,
  });

  return { status: 'scheduled' as const, reminderId };
}
