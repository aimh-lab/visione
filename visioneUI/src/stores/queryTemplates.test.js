// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { queryTemplates } from './queryTemplates.js';

const STORAGE_KEY = 'visione_query_templates';

beforeEach(() => {
  localStorage.clear();
  queryTemplates.clear();
});

describe('queryTemplates.add', () => {
  it('creates a new template with the given name and queries', () => {
    const result = queryTemplates.add('My Template', ['query one', 'query two']);
    expect(result).toEqual({ status: 'created', name: 'My Template' });

    const list = get(queryTemplates);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'My Template', queries: ['query one', 'query two'] });
    expect(list[0].id).toBeTypeOf('number');
  });

  it('derives a fallback name from the first query when no name is given', () => {
    const result = queryTemplates.add('', ['hello world']);
    expect(result.name).toBe('hello world');
  });

  it('skips (does not create/persist anything) when there are no non-blank queries', () => {
    expect(queryTemplates.add('Name', [])).toEqual({ status: 'skipped', name: '' });
    expect(queryTemplates.add('Name', ['  ', ''])).toEqual({ status: 'skipped', name: '' });
    expect(get(queryTemplates)).toHaveLength(0);
  });

  it('trims and drops blank entries from the queries array', () => {
    queryTemplates.add('T', ['  a  ', '', 'b']);
    expect(get(queryTemplates)[0].queries).toEqual(['a', 'b']);
  });

  it('updates (and moves to front) an existing template with the same name, case-insensitively', () => {
    queryTemplates.add('Template', ['old query']);
    const result = queryTemplates.add('template', ['new query']);
    expect(result.status).toBe('updated');
    const list = get(queryTemplates);
    expect(list).toHaveLength(1);
    expect(list[0].queries).toEqual(['new query']);
  });

  it('updates an existing template with the same query signature even under a different name', () => {
    queryTemplates.add('First Name', ['shared', 'queries']);
    const result = queryTemplates.add('Second Name', ['shared', 'queries']);
    expect(result.status).toBe('updated');
    expect(get(queryTemplates)).toHaveLength(1);
  });

  it('persists to localStorage after a create', () => {
    queryTemplates.add('T', ['q']);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('T');
  });
});

describe('queryTemplates.delete', () => {
  it('removes the template with the matching id', () => {
    queryTemplates.add('A', ['a']);
    const [{ id }] = get(queryTemplates);
    queryTemplates.delete(id);
    expect(get(queryTemplates)).toHaveLength(0);
  });
});

describe('queryTemplates.load', () => {
  it('resolves the template with the matching id', async () => {
    queryTemplates.add('A', ['a']);
    const [{ id }] = get(queryTemplates);
    await expect(queryTemplates.load(id)).resolves.toMatchObject({ name: 'A' });
  });

  it('resolves undefined for an unknown id', async () => {
    await expect(queryTemplates.load(999999)).resolves.toBeUndefined();
  });
});

describe('queryTemplates.rename', () => {
  it('renames the template with the matching id', () => {
    queryTemplates.add('Old Name', ['a']);
    const [{ id }] = get(queryTemplates);
    queryTemplates.rename(id, 'New Name');
    expect(get(queryTemplates)[0].name).toBe('New Name');
  });

  it('ignores a blank new name', () => {
    queryTemplates.add('Old Name', ['a']);
    const [{ id }] = get(queryTemplates);
    queryTemplates.rename(id, '   ');
    expect(get(queryTemplates)[0].name).toBe('Old Name');
  });
});

describe('queryTemplates.clear', () => {
  it('empties the store and removes the localStorage key', () => {
    queryTemplates.add('A', ['a']);
    queryTemplates.clear();
    expect(get(queryTemplates)).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
