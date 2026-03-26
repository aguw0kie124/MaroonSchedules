/**
 * Stream Feeds V3 Service
 */
import { FeedsClient } from '@stream-io/feeds-client';
import { API_URL } from '../config';



let feedsClient: FeedsClient | null = null;
let connectedUserId: string | null = null;

export async function connectFeedsUser(
    clerkUserId: string, 
    clerkName: string = 'Aggie', 
    clerkImage: string = '', 
    forceRefresh = false
): Promise<FeedsClient> {
  if (!forceRefresh && feedsClient && connectedUserId === clerkUserId) {
    return feedsClient;
  }

  const res = await fetch(`${API_URL}/chat/feeds/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        clerk_user_id: clerkUserId,
        name: clerkName,
        image: clerkImage
    }),
  });
  if (!res.ok) throw new Error('Failed to get feeds token');
  const { stream_api_key, stream_user_token } = await res.json();
  console.log('[StreamFeeds V3] Connected with API Key:', stream_api_key);

  const client = new FeedsClient(stream_api_key);
  await client.connectUser({ 
      id: clerkUserId,
      data: {
          name: clerkName,
          image: clerkImage
      }
  } as any, stream_user_token);

  feedsClient = client;
  connectedUserId = clerkUserId;
  return client;
}


export async function uploadStreamImage(uri: string): Promise<string> {
  if (!feedsClient) throw new Error('Not connected');
  try {
    const filename = uri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    const fileObj = {
      name: filename,
      type: type,
      uri: uri
    } as any;

    const response = await feedsClient.uploadImage({ file: fileObj });
    return response.file;
  } catch (e: any) {
    console.error('Image upload failed:', e);
    throw new Error('Failed to upload image to Stream.');
  }
}

export async function uploadStreamFile(uri: string): Promise<string> {
  if (!feedsClient) throw new Error('Not connected');
  try {
    const filename = uri.split('/').pop() || 'video.mp4';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `video/${match[1]}` : `video/mp4`;

    const fileObj = {
      name: filename,
      type: type,
      uri: uri
    } as any;

    const response = await feedsClient.uploadFile({ file: fileObj });
    return response.file;
  } catch (e: any) {
    console.error('Video upload failed:', e);
    throw new Error('Failed to upload video to Stream.');
  }
}

export async function getCampusFeed(limit = 25): Promise<any[]> {
  try {
    const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/campus_global?limit=${limit}`);
    if (!res.ok) throw new Error('Proxy Fetch Error');
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error('[StreamFeeds] getCampusFeed error:', e);
    return [];
  }
}

export async function addPost(params: {
  userId: string;
  userName: string;
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
      user_name: params.userName,
      user_image: params.userImage || '',
      location_tag: params.locationTag || ''
    }
  };

  const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/campus_global`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity })
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error(`[StreamFeeds] addPost error: ${err}`);
    throw new Error(`Proxy Post Error: ${err}`);
  }
}

export async function toggleLike(activityId: string, userId: string): Promise<any> {
    const res = await fetch(`${API_URL}/chat/feeds/proxy/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            kind: 'like', 
            activity_id: activityId, 
            user_id: userId,
            data: {}
        })
    });
    if (!res.ok) {
        const err = await res.text();
        console.error('[StreamFeeds] toggleLike error:', err);
        throw new Error('Like Proxy Error: ' + err);
    }
    return res.json();
}

export async function addComment(activityId: string, user: any, text: string): Promise<any> {
    const res = await fetch(`${API_URL}/chat/feeds/proxy/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            kind: 'comment', 
            activity_id: activityId, 
            user_id: user.id || user.userId,
            data: { 
                text: text, 
                comment: text,
                name: user.fullName || user.username || 'Aggie',
                image: user.imageUrl || ''
            }
        })
    });
    if (!res.ok) {
        const err = await res.text();
        console.error('[StreamFeeds] addComment error:', err);
        throw new Error('Comment Proxy Error: ' + err);
    }
    return res.json();
}

export async function getComments(activityId: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_URL}/chat/feeds/proxy/reactions/${activityId}/comment`);
    if (!res.ok) return [];
    const data = await res.json();
    // Proxy returns { results: [...] } or direct list
    return data.results || data.comments || [];
  } catch (e) {
    console.warn('[StreamFeeds] getComments error:', e);
    return [];
  }
}

export async function addReel(params: {
  userId: string;
  userName: string;
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
      user_name: params.userName,
      user_image: params.userImage || '',
    }
  };

  const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/reels_global`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[StreamFeeds] addReel error: ${err}`);
    throw new Error("Reel Proxy Error: " + err);
  }
}

export async function deletePost(activityId: string) {
    const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/campus_global/${activityId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error("Failed to delete post.");
}

export async function deleteReel(activityId: string) {
    const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/reels_global/${activityId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error("Failed to delete reel.");
}

export async function updatePost(activityId: string, caption: string): Promise<any> {
    const activity = { text: caption };
    const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/campus_global/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity })
    });
    if (!res.ok) throw new Error("Failed to update post.");
}

export async function updateReel(activityId: string, caption: string): Promise<any> {
    const activity = { text: caption };
    const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/reels_global/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity })
    });
    if (!res.ok) throw new Error("Failed to update reel.");
}

export async function getReelsFeed(limit = 20): Promise<any[]> {
  try {
    const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/reels_global?limit=${limit}`);
    if (!res.ok) throw new Error('Proxy Fetch Error');
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error('[StreamFeeds] getReelsFeed error:', e);
    return [];
  }
}

export async function getPlaceReviews(placeId: string, limit = 5): Promise<any[]> {
    const slugify = (text: string) => text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    try {
        const slug = slugify(placeId);
        const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/place_review_${slug}?limit=${limit}`);
        if (!res.ok) throw new Error(`Proxy Fetch Error: ${res.status}`);
        const data = await res.json();
        const results = data.results || [];
        return results.map((act: any) => ({
            id: act.id,
            user: act.custom?.user_name || 'Aggie User',
            rating: act.custom?.rating || 0,
            comment: act.text || act.custom?.comment || ''
        }));
    } catch (e) {
        console.error(`[StreamFeeds] getPlaceReviews for ${placeId} error:`, e);
        return [];
    }
}

export async function addPlaceReview(params: {
    userId: string;
    userName: string;
    userImage?: string;
    placeId: string;
    rating: number;
    text: string;
    images?: string[];
}): Promise<any> {
    const slugify = (text: string) => text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const slug = slugify(params.placeId);
    const activity = {
        actor: `SU:${params.userId}`,
        verb: 'review',
        object: `place:${slug}`,
        text: params.text,
        custom: {
            user_name: params.userName,
            user_image: params.userImage || '',
            place_id: slug,
            rating: params.rating,
            images: params.images || []
        }
    };

    const res = await fetch(`${API_URL}/chat/feeds/proxy/flat/place_review_${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity })
    });
    
    if (!res.ok) {
        const err = await res.text();
        console.error(`[StreamFeeds] addPlaceReview error: ${err}`);
        throw new Error(`Proxy Review Error: ${err}`);
    }
}

export function disconnectFeeds() {
  feedsClient = null;
  connectedUserId = null;
}
