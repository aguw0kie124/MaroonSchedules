import { Share, Platform } from 'react-native';
import { trackShare } from '../api/client';

interface ShareOptions {
  title?: string;
  message?: string;
  url?: string;
  id?: string | number;
  type?: 'event' | 'place' | 'post' | 'schedule';
}

export const triggerNativeShare = async (options: ShareOptions) => {
  const { title, message, url, id, type } = options;
  
  const shareMessage = `${title ? `${title}\n` : ''}${message || ''}${url ? `\n\n${url}` : ''}`.trim();
  
  try {
    const result = await Share.share(
      {
        title: title || 'MaroonSchedules',
        message: Platform.OS === 'android' ? `${shareMessage}` : shareMessage,
        url: url,
      },
      {
        dialogTitle: title || 'Share',
      }
    );
    return result;
  } catch (error) {
    console.warn('[Share] Native share failed:', error);
  } finally {
    if (id && type) {
      trackShare(id, type).catch(e => console.warn('[Share] Tracking failed:', e));
    }
  }
};
