package it.cnr.isti.visione.lucene;

import java.util.LinkedHashMap;
import java.util.Map;

public class LRUCache<K,V> extends LinkedHashMap<K, V>{
    /**
	 * 
	 */
	private static final long serialVersionUID = 1L;
	private int maxSize;
    
    public LRUCache(int capacity) {
        super(capacity, 0.75f, true);
        this.maxSize = capacity;
    }

    @Override
    public V get(Object key) {
        V v = super.get(key);
        return v == null ? null : v;
    }

    @Override
    public V put(K key, V value) {
        return super.put(key, value);
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return this.size() > maxSize; //must override it if used in a fixed cache
    }
}