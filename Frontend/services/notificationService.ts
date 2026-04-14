import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions from the user.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return finalStatus === 'granted';
}

/**
 * Check current notification permission status.
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule a local notification for an event.
 * @param title Event title
 * @param body Notification body
 * @param date Target date for the event
 * @param leadTimeMinutes Minutes before the event to fire the notification (default 5)
 */
export async function scheduleEventNotification(
  title: string,
  body: string,
  date: Date,
  leadTimeMinutes: number = 5
): Promise<string | null> {
  const trigger = new Date(date.getTime() - leadTimeMinutes * 60000);
  
  if (trigger.getTime() <= Date.now()) {
    console.warn('[NotificationService] Skipping notification: trigger is in the past.');
    return null;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Reminder: ${title}`,
        body: body,
        data: { type: 'event', date: date.toISOString() },
        sound: false,
      },
      trigger: { 
        type: Notifications.SchedulableTriggerInputTypes.DATE, 
        date: trigger.getTime() 
      },
    });
    return id;
  } catch (error) {
    console.warn('[NotificationService] Failed to schedule event notification:', error);
    return null;
  }
}

export async function scheduleAdminEventReviewNotification(
  title: string,
  locationName: string | null | undefined,
  endDate: Date,
  googleReviewUrl?: string | null,
  eventId?: string | null,
): Promise<string | null> {
  const triggerDate = endDate.getTime() <= Date.now()
    ? new Date(Date.now() + 1000)
    : endDate;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `How was ${title}?`,
        body: `Your RSVP event just ended${locationName ? ` at ${locationName}` : ''}. Tap to leave a quick review.`,
        data: {
          type: 'admin_event_review',
          eventId: eventId || null,
          title,
          locationName: locationName || null,
          endDate: endDate.toISOString(),
          googleReviewUrl: googleReviewUrl || null,
        },
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate.getTime(),
      },
    });
    return id;
  } catch (error) {
    console.warn('[NotificationService] Failed to schedule admin event review notification:', error);
    return null;
  }
}

export async function scheduleRsvpSuccessNotification(
  title: string,
  startDate?: Date | null,
  locationName?: string | null,
): Promise<string | null> {
  const startLabel = startDate
    ? startDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'RSVP confirmed',
        body: `You're in for ${title}${locationName ? ` at ${locationName}` : ''}${startLabel ? ` on ${startLabel}` : ''}.`,
        data: {
          type: 'featured_event_rsvp_confirmed',
          title,
          locationName: locationName || null,
          startDate: startDate?.toISOString() || null,
        },
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
    return id;
  } catch (error) {
    console.warn('[NotificationService] Failed to schedule RSVP success notification:', error);
    return null;
  }
}

/**
 * Schedule a local notification for a bus arrival.
 * @param routeName Name of the bus route
 * @param stopName Name of the stop
 * @param arrivalMinutes Predicted minutes until arrival
 */
export async function scheduleBusArrivalNotification(
  routeName: string,
  stopName: string,
  arrivalMinutes: number,
  leadTime: number = 5
): Promise<string | null> {
  const waitMinutes = arrivalMinutes - leadTime;

  if (waitMinutes <= 0) {
    console.warn(`[NotificationService] Bus is arriving in less than ${leadTime} minutes. Firing immediate alert.`);
    // Fire very soon (1s)
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `Bus Arriving Soon!`,
        body: `The ${routeName} is arriving at ${stopName} in about ${arrivalMinutes} minutes.`,
        sound: false,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
    });
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Bus Reminder`,
        body: `The ${routeName} is arriving at ${stopName} in ${leadTime} minutes.`,
        sound: false,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: waitMinutes * 60 },
    });
    return id;
  } catch (error) {
    console.warn('[NotificationService] Failed to schedule bus notification:', error);
    return null;
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Cancel a specific notification.
 */
export async function cancelNotification(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id);
}
