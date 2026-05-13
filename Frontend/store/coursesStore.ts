import { create } from 'zustand';

interface CoursesStore {
  selectedPlanId: string | null;
  setSelectedPlanId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filters: { department?: string; creditHours?: number; hasGradeData?: boolean; college?: string };
  setFilters: (f: Partial<CoursesStore['filters']>) => void;
  resetFilters: () => void;
}

export const useCoursesStore = create<CoursesStore>((set) => ({
  selectedPlanId: null,
  setSelectedPlanId: (id) => set({ selectedPlanId: id }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  filters: {},
  setFilters: (f) => set((state) => ({ filters: { ...state.filters, ...f } })),
  resetFilters: () => set({ filters: {} }),
}));
