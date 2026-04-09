import { create } from 'zustand';

export interface ShareContent {
  title?: string;
  message?: string;
  url?: string;
  subject?: string;
  id?: string | number;
  type?: 'event' | 'place' | 'post' | 'schedule';
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
  openShare: (content) => set({ isVisible: true, content }),
  closeShare: () => set({ isVisible: false, content: null }),
}));
