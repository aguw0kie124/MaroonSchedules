import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { useCreateChatClient } from 'stream-chat-react-native';
import { API_URL } from '../config';

export function useChatClient() {
  const { user, isLoaded } = useUser();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    fetch(`${API_URL}/chat/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerk_user_id: user.id }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Token fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setApiKey(data.stream_api_key);
        setUserId(data.stream_user_id);
        setUserToken(data.stream_user_token);
      })
      .catch((err) => setError(err.message));
  }, [isLoaded, user]);

  const client = useCreateChatClient({
    apiKey: apiKey || '',
    userData: {
      id: userId || 'placeholder',
      name: user?.fullName || 'Aggie',
      image: user?.imageUrl || undefined,
    },
    tokenOrProvider: userToken || '',
  });

  return { client, userId, error, isReady: !!client && !!userId };
}
