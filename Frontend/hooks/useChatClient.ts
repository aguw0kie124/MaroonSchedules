import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { StreamChat } from 'stream-chat';

import { requestJson } from '../api/client';

export function useChatClient() {
  const { user, isLoaded } = useUser();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [client, setClient] = useState<StreamChat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    requestJson('/chat/token', {
      method: 'POST',
      body: JSON.stringify({ clerk_user_id: user.id }),
    })
      .then((data) => {
        setApiKey(data.stream_api_key);
        setUserId(data.stream_user_id);
        setUserToken(data.stream_user_token);
      })
      .catch((err) => setError(err.message));
  }, [isLoaded, user]);

  useEffect(() => {
    if (!apiKey || !userId || !userToken) return;

    let isCancelled = false;

    const connectClient = async () => {
      try {
        const nextClient = StreamChat.getInstance(apiKey);
        await nextClient.connectUser(
          {
            id: userId,
            name: user?.fullName || 'Aggie',
            image: user?.imageUrl || undefined,
          },
          userToken,
        );

        if (!isCancelled) {
          setClient(nextClient);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || 'Failed to connect chat client');
        }
      }
    };

    connectClient();

    return () => {
      isCancelled = true;
    };
  }, [apiKey, user?.fullName, user?.imageUrl, userId, userToken]);

  return { client, userId, error, isReady: !!client && !!userId };
}
