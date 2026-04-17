import { getPremiumName, getPremiumImage } from '../utils/userUtils';
import { apiFetch } from '../api/client';
import { API_KEY } from '../config';

function warnFeedRead(scope: string, e: unknown) {
  if (__DEV__) {
    console.warn(scope, e);
  }
}

let connectedUserId: string | null = null;
let currentFullUser: any | null = null;

function getFeedHeaders(extraHeaders: HeadersInit = {}) {
  return {
    ...(extraHeaders || {}),
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...(connectedUserId ? { 'X-Clerk-User-Id': connectedUserId } : {}),
  };
}

async function feedFetch(path: string, init: RequestInit = {}, timeoutMs?: number) {
  const headers = getFeedHeaders(init.headers || {});
  return apiFetch(path, { ...init, headers }, timeoutMs);
}

export function initializeFeedUser(
    clerkUser: any, 
    _forceRefresh = false
): { id: string } {
  const clerkUserId = clerkUser?.id || clerkUser?.userId;
  if (!clerkUserId) return { id: 'anonymous' };

  connectedUserId = clerkUserId;
  currentFullUser = clerkUser;

  return { id: clerkUserId };
}

export async function uploadMediaImage(uri: string): Promise<string> {
  try {
    const filename = uri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: filename,
      type: type,
    } as any);

    const res = await feedFetch('/upload/image', {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
  } catch (e: any) {
    console.warn('Local image upload failed:', e);
    throw new Error('Failed to upload image to Backend.');
  }
}

export async function uploadMediaFile(uri: string): Promise<string> {
  try {
    const filename = uri.split('/').pop() || 'video.mp4';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `video/${match[1]}` : `video/mp4`;

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: filename,
      type: type,
    } as any);

    const res = await feedFetch('/upload/video', {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
  } catch (e: any) {
    console.warn('Local video upload failed:', e);
    throw new Error('Failed to upload video to Backend.');
  }
}

export async function getCampusFeed(limit = 25): Promise<any[]> {
  try {
    const res = await feedFetch(`/chat/feeds/proxy/flat/campus_global?limit=${limit}`);
    if (!res.ok) throw new Error('Proxy Fetch Error');
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    warnFeedRead('[NativeFeeds] getCampusFeed', e);
    return [];
  }
}

export async function getPingFeed(limit = 40): Promise<any[]> {
  try {
    const res = await feedFetch(`/chat/feeds/proxy/flat/campus_pings?limit=${limit}`, {}, 12000);
    if (!res.ok) throw new Error('Proxy Fetch Error');
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    warnFeedRead('[NativeFeeds] getPingFeed', e);
    return [];
  }
}

export async function addPing(params: {
  userId: string;
  userName?: string;
  userImage?: string;
  title: string;
  body: string;
  category: string;
  locationTag: string;
  placeId?: string;
  startAt: string;
  endAt?: string;
  mediaUrl?: string;
  latitude?: number;
  longitude?: number;
  anchorType?: 'place' | 'geo';
  isAnonymous?: boolean;
}): Promise<any> {
  const attachments: any[] = [];
  if (params.mediaUrl) {
    attachments.push({
      type: 'image',
      image_url: params.mediaUrl,
      custom: {},
    });
  }

  const activity = {
    actor: `SU:${params.userId}`,
    verb: 'ping',
    object: `ping:${Date.now()}`,
    text: params.body,
    attachments,
    custom: {
      user_name: params.userName || getPremiumName(currentFullUser),
      user_image: params.userImage ?? getPremiumImage(currentFullUser) ?? '',
      ping_title: params.title,
      ping_category: params.category,
      location_tag: params.locationTag,
      place_id: params.placeId || '',
      start_at: params.startAt,
      end_at: params.endAt || '',
      content_type: 'ping',
      is_anonymous: Boolean(params.isAnonymous),
      anchor_type: params.anchorType || 'place',
      place_lat: params.latitude,
      place_lng: params.longitude,
    },
  };

  const res = await feedFetch('/chat/feeds/proxy/flat/campus_pings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity }),
  }, 30000);

  if (!res.ok) {
    const err = await res.text();
    console.warn(`[NativeFeeds] addPing error: ${err}`);
    throw new Error(`Proxy Ping Error: ${err}`);
  }
  return res.json();
}

export async function deletePing(activityId: string) {
  const res = await feedFetch(`/chat/feeds/proxy/flat/campus_pings/${activityId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.text();
    // Use console.warn to avoid triggering error boxes in testing
    console.warn(`[NativeFeeds] deletePing silent failure: ${err}`);
  }
}

export async function addPost(params: {
  userId: string;
  userName?: string;
  userImage?: string;
  caption?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  locationTag?: string;
}): Promise<any> {
  const attachments: any[] = [];
  if (params.mediaUrl) {
    attachments.push({
      type: params.mediaType || 'image',
      [params.mediaType === 'image' ? 'image_url' : 'asset_url']: params.mediaUrl,
      custom: {}
    });
  }

  const activity = {
    actor: `SU:${params.userId}`,
    verb: 'post',
    object: Date.now().toString(),
    text: params.caption || '',
    attachments: attachments,
    custom: {
      user_name: params.userName || getPremiumName(currentFullUser),
      user_image: params.userImage || getPremiumImage(currentFullUser),
      location_tag: params.locationTag || ''
    }
  };

  const res = await feedFetch('/chat/feeds/proxy/flat/campus_global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity })
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.warn(`[NativeFeeds] addPost error: ${err}`);
    throw new Error(`Proxy Post Error: ${err}`);
  }
}

export async function toggleVote(activityId: string, kind: 'upvote' | 'downvote' | 'none' | 'like', parentId?: string): Promise<any> {
    if (!connectedUserId) throw new Error('Must be logged in to vote.');
    const res = await feedFetch('/chat/feeds/proxy/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            kind: kind, 
            activity_id: activityId, 
            user_id: connectedUserId,
            parent_id: parentId,
            data: {
              name: getPremiumName(currentFullUser),
              image: getPremiumImage(currentFullUser)
            }
        })
    });
    if (!res.ok) {
        const err = await res.text();
        console.warn('[NativeFeeds] toggleVote error:', err);
        throw new Error('Vote Proxy Error: ' + err);
    }
    return res.json();
}

export async function toggleLike(activityId: string, userId: string): Promise<any> {
    const res = await feedFetch('/chat/feeds/proxy/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            kind: 'like', 
            activity_id: activityId, 
            user_id: userId,
            data: {
              name: getPremiumName(currentFullUser),
              image: getPremiumImage(currentFullUser)
            }
        })
    });
    if (!res.ok) {
        const err = await res.text();
        console.warn('[NativeFeeds] toggleLike error:', err);
        throw new Error('Like Proxy Error: ' + err);
    }
    return res.json();
}

export async function addComment(activityId: string, user: any, text: string, parentId?: string): Promise<any> {
    const res = await feedFetch('/chat/feeds/proxy/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            kind: 'comment', 
            activity_id: activityId, 
            user_id: user?.id || user?.userId || connectedUserId,
            parent_id: parentId,
            data: { 
                text: text, 
                comment: text,
                name: getPremiumName(user || currentFullUser),
                image: getPremiumImage(user || currentFullUser)
            }
        })
    });
    if (!res.ok) {
        const err = await res.text();
        console.warn('[NativeFeeds] addComment error:', err);
        throw new Error('Comment Proxy Error: ' + err);
    }
    return res.json();
}

export async function getComments(activityId: string): Promise<any[]> {
  try {
    const res = await feedFetch(`/chat/feeds/proxy/reactions/${activityId}/comment`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || data.comments || [];
  } catch (e) {
    console.warn('[NativeFeeds] getComments error:', e);
    return [];
  }
}

export async function addReel(params: {
  userId: string;
  userName?: string;
  userImage?: string;
  caption?: string;
  videoUrl: string;
}): Promise<any> {
  const activity = {
    actor: `SU:${params.userId}`,
    verb: 'reel',
    object: Date.now().toString(),
    text: params.caption || '',
    attachments: [{
      type: 'video',
      asset_url: params.videoUrl,
      custom: {}
    }],
    custom: {
      user_name: params.userName || getPremiumName(currentFullUser),
      user_image: params.userImage || getPremiumImage(currentFullUser),
    }
  };

  const res = await feedFetch('/chat/feeds/proxy/flat/reels_global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity })
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn(`[NativeFeeds] addReel error: ${err}`);
    throw new Error("Reel Proxy Error: " + err);
  }
}

export async function deletePost(activityId: string) {
    await feedFetch(`/chat/feeds/proxy/flat/campus_global/${activityId}`, {
        method: 'DELETE',
    });
}

export async function deleteReview(placeId: string, activityId: string) {
    const slugify = (text: string) => text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const slug = slugify(placeId);
    const res = await feedFetch(`/chat/feeds/proxy/flat/place_review_${slug}/${activityId}`, {
        method: 'DELETE',
    });
    if (!res.ok) {
        const err = await res.text();
        console.warn(`[NativeFeeds] deleteReview silent failure: ${err}`);
    }
}

export async function deleteReel(activityId: string) {
    await feedFetch(`/chat/feeds/proxy/flat/reels_global/${activityId}`, {
        method: 'DELETE',
    });
}

export async function updatePost(activityId: string, caption: string): Promise<any> {
    const activity = { text: caption };
    await feedFetch(`/chat/feeds/proxy/flat/campus_global/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity })
    });
}

export async function getReelsFeed(limit = 20): Promise<any[]> {
  try {
    const res = await feedFetch(`/chat/feeds/proxy/flat/reels_global?limit=${limit}`);
    if (!res.ok) throw new Error('Proxy Fetch Error');
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.warn('[NativeFeeds] getReelsFeed error:', e);
    return [];
  }
}

export async function getPlaceReviews(placeId: string, limit = 5): Promise<any[]> {
    const slugify = (text: string) => text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    try {
        const slug = slugify(placeId);
        const res = await feedFetch(`/chat/feeds/proxy/flat/place_review_${slug}?limit=${limit}`, {}, 6000);
        if (!res.ok) throw new Error(`Proxy Fetch Error: ${res.status}`);
        const data = await res.json();
        const results = data.results || [];
        return results.map((act: any) => ({
            id: act.id,
            user: act.custom?.user_name || 'Aggie User',
            userId: act.custom?.user_id || act.actor?.id?.replace('SU:', '') || '',
            rating: act.custom?.rating || 0,
            comment: act.text || act.custom?.comment || ''
        }));
    } catch (e) {
        console.warn(`[NativeFeeds] getPlaceReviews error:`, e);
        return [];
    }
}

export async function addPlaceReview(params: {
  placeId: string;
  rating: number;
  text: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  images?: string[];
}): Promise<void> {
    const slugify = (text: string) => text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    
    const { 
        placeId, 
        rating, 
        text, 
        images = [], 
        userId = connectedUserId || "anonymous",
        userName = getPremiumName(currentFullUser),
        userImage = getPremiumImage(currentFullUser)
    } = params;

    if (!placeId) {
        console.warn("[NativeFeeds] addPlaceReview: placeId is undefined");
        throw new Error("placeId is required for reviews");
    }

    const slug = slugify(placeId);
    const activity = {
        actor: `SU:${userId}`,
        verb: 'review',
        object: `place:${slug}`,
        text: text,
        custom: {
            user_name: userName || getPremiumName(currentFullUser),
            user_image: userImage || getPremiumImage(currentFullUser),
            place_id: slug,
            rating: rating,
            images: images || []
        }
    };

    const res = await feedFetch(`/chat/feeds/proxy/flat/place_review_${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity })
    });
    
    if (!res.ok) {
        const err = await res.text();
        console.warn(`[NativeFeeds] addPlaceReview error: ${err}`);
        throw new Error(`Proxy Review Error: ${err}`);
    }
}

export const postPlaceReview = addPlaceReview;

export function disconnectFeeds() {
  connectedUserId = null;
  currentFullUser = null;
}

export async function blockUser(targetId: string, actingUserId?: string): Promise<void> {
    const blockerId = actingUserId || connectedUserId;
    if (!blockerId) {
        throw new Error('Must be signed in to block a user.');
    }
    const res = await feedFetch(`/chat/users/${blockerId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId })
    });
    if (!res.ok) throw new Error('Failed to block user.');
}

export async function unblockUser(targetId: string, actingUserId?: string): Promise<void> {
    const blockerId = actingUserId || connectedUserId;
    if (!blockerId) {
        throw new Error('Must be signed in to unblock a user.');
    }
    const res = await feedFetch(`/chat/users/${blockerId}/block/${targetId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to unblock user.');
}

export async function getBlockedUsers(userId: string): Promise<any[]> {
    try {
        const res = await feedFetch(`/chat/users/${userId}/blocked`);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        if (__DEV__) {
            console.warn('[NativeFeeds] getBlockedUsers: network error, returning empty list', e);
        }
        return [];
    }
}

export async function addFriend(targetId: string, actingUserId?: string): Promise<void> {
    const requesterId = actingUserId || connectedUserId;
    if (!requesterId) {
        throw new Error('Must be signed in to add a friend.');
    }
    
    // Debug logging for troubleshooting social connectivity
    if (__DEV__) {
      console.log(`[SocialService] addFriend: requester=${requesterId}, target=${targetId}`);
    }

    const res = await feedFetch(`/chat/users/${requesterId}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[SocialService] addFriend failed: status=${res.status}, body=${errorText}`);
        throw new Error('Failed to add friend.');
    }
}

export async function removeFriend(targetId: string, actingUserId?: string): Promise<void> {
    const requesterId = actingUserId || connectedUserId;
    if (!requesterId) {
        throw new Error('Must be signed in to remove a friend.');
    }
    const res = await feedFetch(`/chat/users/${requesterId}/friends/${targetId}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove friend.');
}

export async function getFriends(userId: string): Promise<any[]> {
    try {
        const res = await feedFetch(`/chat/users/${userId}/friends`);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        if (__DEV__) {
            console.warn('[NativeFeeds] getFriends: network error, returning empty list', e);
        }
        return [];
    }
}

export async function searchUsers(query: string, userId?: string, limit = 10): Promise<any[]> {
    const requesterId = userId || connectedUserId;
    if (!requesterId) {
        throw new Error('Must be signed in to search users.');
    }
    const params = new URLSearchParams({
        query,
        limit: String(limit),
    });
    const res = await feedFetch(`/chat/users/${requesterId}/friends/search?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to search users.');
    return await res.json();
}

export async function reportContent(params: {
    reporteeId: string;
    postType: 'review' | 'crowdping' | 'post' | 'reel';
    postId: string;
    reason: string;
    comment?: string;
    placeId?: string;
}): Promise<void> {
    const res = await feedFetch('/chat/reports', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            reportee_id: params.reporteeId,
            post_type: params.postType,
            post_id: params.postId,
            reason: params.reason,
            comment: params.comment,
            place_id: params.placeId
        })
    });
    if (!res.ok) throw new Error('Failed to submit report.');
}

export async function deleteAccount(userId: string): Promise<void> {
    const res = await feedFetch(`/api/account?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete account.');
}
