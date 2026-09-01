import { pushState, replaceState } from '$app/navigation';

/**
 * Serializza lo stato dell'app in URL params
 */
export function serializeToURL(state) {
  const params = new URLSearchParams();
  
  // Text query
  if (state.textareas?.length > 0) {
    const queries = state.textareas
      .filter(t => t.enabled && t.value?.trim())
      .map(t => t.value.trim())
      .join('|'); // queries is a string
    
    
    if (queries.length > 0) {
      params.set('q', queries); // keep as-is, no .join('|')
    }
  }

  // imageID query (similarity step inside Search)
  if (state.imageId && String(state.imageId).trim()) {
    params.set('img', String(state.imageId).trim());
  }

  // Inline image query (same textarea as text), separated via img= to preserve similarity semantics.
  if (Array.isArray(state.inlineQueryImages) && state.inlineQueryImages.length > 0) {
    const packed = state.inlineQueryImages
      .map((entry) => {
        const index = Number(entry?.index);
        const imgId = String(entry?.imgId || '').trim();
        if (!Number.isInteger(index) || index < 0 || !imgId) return null;
        return `${index}:${imgId}`;
      })
      .filter(Boolean)
      .join(',');

    if (packed) params.set('qimg', packed);
  }
  
  // View mode
 // if (state.viewMode && state.viewMode !== 'byrank') {
 //   params.set('view', state.viewMode);
 // }

  // RF images (imgId only, compact)
  if (state.rfPositive?.length > 0) {
    params.set('rfp', state.rfPositive.map(r => r.imgId).join(','));
  }
  if (state.rfNegative?.length > 0) {
    params.set('rfn', state.rfNegative.map(r => r.imgId).join(','));
  }

    const result = params.toString();
  
  return result;
}

/**
 * Deserializza URL params in stato app (client-only)
 */
export function deserializeFromURL(urlString) {
  // Guard SSR
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(urlString || window.location.search);
  const state = {};
  
  // Text query
  const q = params.get('q');
  if (q) {
    state.textareas = q.split('|').map(value => ({
      value: value.trim(), // URLSearchParams handles decoding
      enabled: true
    }));
  }

  // imageID query: always create a separate step to preserve temporal semantics
  const img = params.get('img');
  if (img && img.trim()) {
    const imageId = img.trim();
    const similarityStep = { value: '', enabled: true, similarityImgId: imageId };

    if (state.textareas?.length > 0) {
      state.textareas = [...state.textareas, similarityStep];
    } else {
      state.textareas = [similarityStep];
    }

    state.imageId = imageId;
  }

  // Inline query images (testo + immagine nella stessa textarea): formato qimg=0:imgA,2:imgB
  const qimg = params.get('qimg');
  if (qimg && qimg.trim()) {
    const parsed = qimg
      .split(',')
      .map((chunk) => {
        const [rawIndex, ...rest] = String(chunk || '').split(':');
        const index = Number(rawIndex);
        const imgId = rest.join(':').trim();
        if (!Number.isInteger(index) || index < 0 || !imgId) return null;
        return { index, imgId };
      })
      .filter(Boolean);

    if (parsed.length > 0) {
      state.inlineQueryImages = parsed;

      // Ensure referenced textarea indexes exist.
      const maxIndex = parsed.reduce((acc, entry) => Math.max(acc, entry.index), -1);
      if (!Array.isArray(state.textareas)) state.textareas = [];
      while (state.textareas.length <= maxIndex) {
        state.textareas.push({ value: '', enabled: true });
      }
    }
  }
  
  // View mode
  //const view = params.get('view');
  //if (view && ['byrank', 'byvideo'].includes(view)) {
  //  state.viewMode = view;
  //}

  // RF images
  const rfp = params.get('rfp');
  if (rfp) {
    state.rfPositiveIds = rfp.split(',').filter(Boolean);
  }
  const rfn = params.get('rfn');
  if (rfn) {
    state.rfNegativeIds = rfn.split(',').filter(Boolean);
  }
  
  return state;
}

/**
 * Aggiorna URL senza reload (client-only)
 */
export function updateURL(state, replace = false) {
  // Guard SSR
  if (typeof window === 'undefined') return;
  
  try {
    const url = new URL(window.location);
    const queryString = serializeToURL(state);
    
    url.search = queryString ? `?${queryString}` : '';
    
    if (replace) {
      replaceState(url, {});
    } else {
      pushState(url, {});
    }
  } catch (err) {
    console.warn('Failed to update URL:', err);
  }
}

/**
 * Copia URL corrente negli appunti (client-only)
 */
export async function copyCurrentURL() {
  if (typeof window === 'undefined') return false;
  
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch (err) {
    console.error('Failed to copy URL', err);
    return false;
  }
}
