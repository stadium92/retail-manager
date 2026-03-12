import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MasterDashboardState {
  selectedStoreIds: string[];
  isAllStoresSelected: boolean;
  version: number; // Primitive for useEffect dependencies
  
  // Actions
  setSelectedStoreIds: (ids: string[]) => void;
  toggleStoreSelection: (id: string) => void;
  setAllStoresSelected: (selected: boolean, allIds: string[]) => void;
  clearSelection: () => void;
}

export const useMasterDashboardStore = create<MasterDashboardState>()(
  persist(
    (set) => ({
      selectedStoreIds: [],
      isAllStoresSelected: true,
      version: 0,

      setSelectedStoreIds: (ids) => set((state) => ({ 
        selectedStoreIds: ids,
        isAllStoresSelected: false,
        version: state.version + 1
      })),

      toggleStoreSelection: (id) => set((state) => {
        const isSelected = state.selectedStoreIds.includes(id);
        const newIds = isSelected 
          ? state.selectedStoreIds.filter(storeId => storeId !== id)
          : [...state.selectedStoreIds, id];
        
        return { 
          selectedStoreIds: newIds,
          isAllStoresSelected: false,
          version: state.version + 1
        };
      }),

      setAllStoresSelected: (selected, allIds) => set((state) => ({
        selectedStoreIds: [],
        isAllStoresSelected: selected,
        version: state.version + 1
      })),

      clearSelection: () => set((state) => ({ 
        selectedStoreIds: [],
        isAllStoresSelected: true,
        version: state.version + 1
      })),
    }),
    {
      name: 'master-dashboard-settings',
    }
  )
);
