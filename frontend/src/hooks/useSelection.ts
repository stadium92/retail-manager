import { useState, useMemo } from 'react';

export function useSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  const selectedItems = useMemo(() => {
    return items.filter(item => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const isSelected = (id: string) => selectedIds.has(id);
  const isAllSelected = selectedIds.size === items.length && items.length > 0;
  const hasSelection = selectedIds.size > 0;

  return {
    selectedIds,
    selectedItems,
    toggleSelect,
    selectAll,
    clearSelection,
    toggleAll,
    isSelected,
    isAllSelected,
    hasSelection,
    selectedCount: selectedIds.size,
  };
}
