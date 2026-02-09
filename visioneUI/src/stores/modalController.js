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
    
    // Imposta la lista corrente
    setItems: (items) => update(state => ({ ...state, items })),
    
    // Apri modale con item selezionato
    open: (item) => update(state => ({ 
      ...state, 
      isOpen: true, 
      selected: item 
    })),
    
    // Chiudi modale
    close: () => update(state => ({ 
      ...state, 
      isOpen: false, 
      selected: null 
    })),
    
    // Naviga di offset posizioni
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
    
    // Seleziona item senza aprire
    select: (item) => update(state => ({ ...state, selected: item }))
  };
}


