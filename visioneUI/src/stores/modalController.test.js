import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createModalController } from './modalController.js';

describe('createModalController', () => {
  it('starts closed, with no selection and no items', () => {
    const modal = createModalController();
    expect(get(modal)).toEqual({ isOpen: false, selected: null, items: [] });
  });

  it('setItems() replaces the items list without touching isOpen/selected', () => {
    const modal = createModalController();
    modal.open({ imgId: 'a' });
    modal.setItems([{ imgId: 'a' }, { imgId: 'b' }]);
    const state = get(modal);
    expect(state.items).toEqual([{ imgId: 'a' }, { imgId: 'b' }]);
    expect(state.isOpen).toBe(true);
    expect(state.selected).toEqual({ imgId: 'a' });
  });

  it('open() sets isOpen=true and selected to the given item', () => {
    const modal = createModalController();
    modal.open({ imgId: 'x' });
    expect(get(modal)).toMatchObject({ isOpen: true, selected: { imgId: 'x' } });
  });

  it('close() sets isOpen=false and clears the selection by default', () => {
    const modal = createModalController();
    modal.open({ imgId: 'x' });
    modal.close();
    expect(get(modal)).toMatchObject({ isOpen: false, selected: null });
  });

  it('close({ keepSelection: true }) clears isOpen but preserves the selection', () => {
    const modal = createModalController();
    modal.open({ imgId: 'x' });
    modal.close({ keepSelection: true });
    expect(get(modal)).toMatchObject({ isOpen: false, selected: { imgId: 'x' } });
  });

  it('select() sets the selection without opening the modal', () => {
    const modal = createModalController();
    modal.select({ imgId: 'y' });
    expect(get(modal)).toMatchObject({ isOpen: false, selected: { imgId: 'y' } });
  });

  describe('navigate()', () => {
    it('moves the selection forward/backward by offset among the current items', () => {
      const modal = createModalController();
      modal.setItems([{ imgId: 'a' }, { imgId: 'b' }, { imgId: 'c' }]);
      modal.select({ imgId: 'a' });

      modal.navigate(1);
      expect(get(modal).selected).toEqual({ imgId: 'b' });

      modal.navigate(1);
      expect(get(modal).selected).toEqual({ imgId: 'c' });
    });

    it('wraps around past the end and before the start', () => {
      const modal = createModalController();
      modal.setItems([{ imgId: 'a' }, { imgId: 'b' }, { imgId: 'c' }]);
      modal.select({ imgId: 'c' });

      modal.navigate(1); // c -> wraps to a
      expect(get(modal).selected).toEqual({ imgId: 'a' });

      modal.navigate(-1); // a -> wraps to c
      expect(get(modal).selected).toEqual({ imgId: 'c' });
    });

    it('is a no-op when there is no current selection or the items list is empty', () => {
      const modal = createModalController();
      modal.setItems([{ imgId: 'a' }]);
      const before = get(modal);
      modal.navigate(1);
      expect(get(modal)).toEqual(before);
    });

    it('is a no-op when the selected item is no longer present in items', () => {
      const modal = createModalController();
      modal.setItems([{ imgId: 'a' }, { imgId: 'b' }]);
      modal.select({ imgId: 'removed' });
      const before = get(modal);
      modal.navigate(1);
      expect(get(modal)).toEqual(before);
    });
  });

  describe('custom getId', () => {
    it('uses the provided getId function instead of the default imgId/id lookup', () => {
      const modal = createModalController((item) => item.customKey);
      modal.setItems([{ customKey: 'a' }, { customKey: 'b' }]);
      modal.select({ customKey: 'a' });
      modal.navigate(1);
      expect(get(modal).selected).toEqual({ customKey: 'b' });
    });
  });
});
