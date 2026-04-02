import { Share } from 'react-native';
import { create } from 'zustand';

export interface ShareContent {
  title?: string;
  message?: string;
  url?: string;
  subject?: string;
}

interface ShareStore {
  isVisible: boolean;
  content: ShareContent | null;
  openShare: (content: ShareContent) => void;
  closeShare: () => void;
}

export const useShareStore = create<ShareStore>((set) => ({
  isVisible: false,
  content: null,
  openShare: async (content) => {
    try {
      const shareMessage = `${content.title ? `${content.title}\n` : ''}${content.message || ''}${content.url ? `\n\n${content.url}` : ''}`;
      await Share.share({
        title: content.title,
        message: shareMessage,
        url: content.url,
      }, {
        dialogTitle: content.title,
        subject: content.subject,
      });
    } catch (error) {
      console.error('Native share failed', error);
    }
  },
  closeShare: () => set({ isVisible: false, content: null }),
}));
