import { writable } from 'svelte/store';

function createToastStore() {
  const { subscribe, update } = writable([]);
  let idCounter = 0;

  function add(message, type = 'info', duration = 3000) {
    const id = idCounter++;
    const toast = { id, message, type, duration };
    
    update(toasts => [...toasts, toast]);
    
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
    
    return id;
  }

  function remove(id) {
    update(toasts => toasts.filter(t => t.id !== id));
  }

  return {
    subscribe,
    success: (msg, duration = 3000) => add(msg, 'success', duration),
    error: (msg, duration = 5000) => add(msg, 'error', duration),
    warning: (msg, duration = 4000) => add(msg, 'warning', duration),
    info: (msg, duration = 3000) => add(msg, 'info', duration),
    remove
  };
}

export const toasts = createToastStore();
