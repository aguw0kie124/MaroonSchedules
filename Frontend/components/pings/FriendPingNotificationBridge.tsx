import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@clerk/clerk-expo';
import * as Notifications from 'expo-notifications';
import React from 'react';
import { initializeFeedUser, getFriends, getPingFeed, registerPushToken } from '../../services/socialFeedService';
import { checkNotificationPermissions } from '../../services/notificationService';
import { useAppShellStore } from '../../store/appShellStore';

const POLL_INTERVAL_MS = 30000;
const MAX_SEEN_IDS = 250;
const MAX_NOTIFY_AGE_MS = 1000 * 60 * 60 * 6;

type SeenPingState = {
  bootstrapped: boolean;
  ids: string[];
};

type FriendPingActivity = {
  id: string;
  title: string;
  locationTag: string;
  userId: string | null;
  userName: string;
  createdAt: string;
};

function getStorageKey(userId: string) {
  return `friend-ping-notifications:v1:${userId}`;
}

async function readSeenState(userId: string): Promise<SeenPingState> {
  try {
    const rawValue = await AsyncStorage.getItem(getStorageKey(userId));
    if (!rawValue) {
      return { bootstrapped: false, ids: [] };
    }
    const parsed = JSON.parse(rawValue) as Partial<SeenPingState>;
    return {
      bootstrapped: Boolean(parsed.bootstrapped),
      ids: Array.isArray(parsed.ids)
        ? parsed.ids.filter((entry): entry is string => typeof entry === 'string')
        : [],
    };
  } catch (_error) {
    return { bootstrapped: false, ids: [] };
  }
}

async function writeSeenState(userId: string, ids: Iterable<string>, bootstrapped = true) {
  const uniqueIds = Array.from(new Set(ids)).slice(-MAX_SEEN_IDS);
  await AsyncStorage.setItem(
    getStorageKey(userId),
    JSON.stringify({ bootstrapped, ids: uniqueIds }),
  );
}

function mapActivityToFriendPing(activity: any): FriendPingActivity | null {
  const custom = activity?.custom || {};
  const actor = activity?.actor || {};
  const activityId = typeof activity?.id === 'string' ? activity.id : '';
  if (!activityId) return null;
  if (custom?.is_anonymous) return null;

  const rawUserId = actor?.id || activity?.actor || '';
  const userId = String(rawUserId).replace(/^SU:/, '').trim() || null;
  const createdAt = activity?.time || activity?.created_at || '';

  return {
    id: activityId,
    title: String(custom?.ping_title || 'Campus Ping').trim() || 'Campus Ping',
    locationTag: String(custom?.location_label || custom?.location_tag || 'Campus').trim() || 'Campus',
    userId,
    userName: String(actor?.name || actor?.data?.name || custom?.user_name || 'A friend').trim() || 'A friend',
    createdAt,
  };
}

function isRecentEnough(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return false;
  return Date.now() - createdTime <= MAX_NOTIFY_AGE_MS;
}

async function scheduleFriendPingNotification(ping: FriendPingActivity) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${ping.userName} posted a ping`,
      body: `${ping.title} · ${ping.locationTag}`,
      sound: false,
      data: {
        type: 'friend_ping',
        pingId: ping.id,
        userId: ping.userId,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  });
}

/**
 * Registers this device's Expo push token with the backend so that
 * background (closed-app) notifications can be sent via APNs / FCM.
 */
async function syncPushTokenWithBackend(userId: string) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    if (tokenData?.data) {
      await registerPushToken(userId, tokenData.data);
    }
  } catch (e) {
    if (__DEV__) console.warn('[FriendPingBridge] push token sync failed', e);
  }
}

export function FriendPingNotificationBridge() {
  const { user } = useUser();
  const notificationsEnabled = useAppShellStore((state) => state.notificationsEnabled);
  const pingNotifications = useAppShellStore((state) => state.pingNotifications);
  const requestInFlightRef = React.useRef(false);
  const tokenSyncedRef = React.useRef(false);

  React.useEffect(() => {
    if (!user) return;
    initializeFeedUser(user);
  }, [user]);

  // Register push token with backend once per session
  React.useEffect(() => {
    const userId = user?.id;
    if (!userId || tokenSyncedRef.current) return;
    tokenSyncedRef.current = true;
    syncPushTokenWithBackend(userId).catch(() => null);
  }, [user?.id]);

  React.useEffect(() => {
    const userId = user?.id;
    if (!userId || !user) return;

    let isCancelled = false;

    const syncFriendPingNotifications = async () => {
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;

      try {
        initializeFeedUser(user);
        const [seenState, friends, activities] = await Promise.all([
          readSeenState(userId),
          getFriends(userId),
          getPingFeed(60),
        ]);
        if (isCancelled) return;

        const seenIds = new Set(seenState.ids);
        const friendIds = new Set(
          (Array.isArray(friends) ? friends : [])
            .map((friend: any) => String(friend?.id || '').trim())
            .filter(Boolean),
        );
        const friendPings = (Array.isArray(activities) ? activities : [])
          .map(mapActivityToFriendPing)
          .filter((ping): ping is FriendPingActivity => !!ping)
          .filter((ping) => Boolean(ping.userId) && ping.userId !== userId && friendIds.has(ping.userId))
          .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

        const currentIds = friendPings.map((ping) => ping.id);
        const nextSeenIds = new Set([...seenIds, ...currentIds]);

        if (!seenState.bootstrapped) {
          await writeSeenState(userId, nextSeenIds, true);
          return;
        }

        const shouldNotify =
          notificationsEnabled &&
          pingNotifications &&
          await checkNotificationPermissions();

        if (shouldNotify) {
          for (const ping of friendPings) {
            if (seenIds.has(ping.id)) continue;
            if (!isRecentEnough(ping.createdAt)) continue;
            await scheduleFriendPingNotification(ping);
          }
        }

        await writeSeenState(userId, nextSeenIds, true);
      } catch (error) {
        console.warn('[FriendPingNotificationBridge] Sync failed', error);
      } finally {
        requestInFlightRef.current = false;
      }
    };

    syncFriendPingNotifications().catch(() => null);
    const intervalId = setInterval(() => {
      syncFriendPingNotifications().catch(() => null);
    }, POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [notificationsEnabled, pingNotifications, user]);

  return null;
}
