// src/stores/modalController.js
import { writable } from 'svelte/store';

export function createModalController(getId = (item) => item.imgId || item.id) {
  const { subscribe, set, update } = writable({
    isOpen: false,
    selected: null,
    items: []
  });

  return {
    subscribe,
    
    // Set current items list
    setItems: (items) => update(state => ({ ...state, items })),
    
    // Open modal with selected item
    open: (item) => update(state => ({ 
      ...state, 
      isOpen: true, 
      selected: item 
    })),
    
    // Close modal
    close: (options = {}) => update(state => ({ 
      ...state, 
      isOpen: false, 
      selected: options.keepSelection ? state.selected : null 
    })),
    
    // Navigate by offset
// In modalController.js
navigate: (offset) => update(state => {
  
  if (!state.selected || !state.items.length) {
    return state;
  }
  
  const currentId = getId(state.selected);
  const currentIndex = state.items.findIndex(item => getId(item) === currentId);
  
  
  if (currentIndex === -1) {
    return state;
  }
  
  const newIndex = (currentIndex + offset + state.items.length) % state.items.length;
  const newSelected = state.items[newIndex];
  
  
  return { ...state, selected: newSelected };
}),
    
    // Select item without opening
    select: (item) => update(state => ({ ...state, selected: item }))
  };
}


