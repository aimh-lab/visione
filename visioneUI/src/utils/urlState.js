/**
 * Serializza lo stato dell'app in URL params
 */
export function serializeToURL(state) {
  const params = new URLSearchParams();
  
  // Query testuale
  if (state.textareas?.length > 0) {
    const queries = state.textareas
      .filter(t => t.enabled && t.value?.trim())
      .map(t => t.value.trim())
      .join('|'); // ✅ queries è una stringa
    
    
    if (queries.length > 0) {
      params.set('q', queries); // ✅ RIMOSSO .join('|')
    }
  }

  // Query per imageID (step similarity dentro Search)
  if (state.imageId && String(state.imageId).trim()) {
    params.set('img', String(state.imageId).trim());
  }
  
  // Tab attivo
  if (state.activeTab && state.activeTab !== 'View1') {
    params.set('tab', state.activeTab);
  }
  
  // View mode
 // if (state.viewMode && state.viewMode !== 'byrank') {
 //   params.set('view', state.viewMode);
 // }
  
  // Video ID (per VideoSummary)
  if (state.videoId) {
    params.set('video', state.videoId);
  }
  
  // Similarity base image
  if (state.similarityBase) {
    params.set('sim', state.similarityBase);
  }
  
  // RF images (solo imgId, compressi)
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
  
  // Query testuale
  const q = params.get('q');
  if (q) {
    state.textareas = q.split('|').map(value => ({
      value: value.trim(), // URLSearchParams decodifica automaticamente
      enabled: true
    }));
  }

  // Query by imageID: va sempre in uno step separato per preservare la semantica temporale
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
  
  // Tab attivo
  const tab = params.get('tab');
  if (tab && ['View1', 'View2', 'Similarity'].includes(tab)) {
    state.activeTab = tab;
  }
  
  // View mode
  //const view = params.get('view');
  //if (view && ['byrank', 'byvideo'].includes(view)) {
  //  state.viewMode = view;
  //}
  
  // Video ID
  const video = params.get('video');
  if (video) {
    state.videoId = video;
  }
  
  // Similarity base
  const sim = params.get('sim');
  if (sim) {
    state.similarityBase = sim;
  }
  
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
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
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
