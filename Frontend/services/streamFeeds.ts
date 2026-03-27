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
    body: JSON.stringify({ clerk_user_id: clerkUserId }),
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
  if (!feedsClient) return [];
  const feed = feedsClient.feed('flat', 'campus_global');
  await feed.getOrCreate({ limit });
  return feed.state.getLatestValue().activities || [];
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
    throw new Error(`Proxy Post Error: ${err}`);
  }
}

export async function toggleLike(activityId: string, userId: string): Promise<{ liked: boolean }> {
  if (!feedsClient) throw new Error('Not connected');
  try {
    await feedsClient.addActivityReaction({
      activity_id: activityId,
      type: 'like',
      enforce_unique: true,
    });
    return { liked: true };
  } catch (e: any) {
    return { liked: false };
  }
}

export async function addComment(activityId: string, text: string): Promise<any> {
  if (!feedsClient) throw new Error('Not connected');
  return feedsClient.addComment({
    object_id: activityId,
    object_type: "activity",
    comment: text,
  });
}

export async function getComments(activityId: string): Promise<any[]> {
  if (!feedsClient) return [];
  try {
    const response = await feedsClient.getComments({
      object_id: activityId,
      object_type: "activity",
      limit: 50,
      sort: 'first'
    });
    return response.comments || [];
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
  if (!res.ok) throw new Error("Reel Proxy Error");
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

export async function getReelsFeed(limit = 20): Promise<any[]> {
  if (!feedsClient) return [];
  const feed = feedsClient.feed('flat', 'reels_global');
  await feed.getOrCreate({ limit });
  return feed.state.getLatestValue().activities || [];
}

export function disconnectFeeds() {
  feedsClient = null;
  connectedUserId = null;
}
