// Centralised URL configuration for the VISIONE platform.
// Values default to the production endpoint but can be overridden via Vite env vars:
//   VITE_VISIONE_BASE_URL, VITE_VISIONE_SERVICES_URL, VITE_VISIONE_SEARCH_URL, VITE_VISIONE_VIDEOS_URL

/** Root URL of the VISIONE deployment (no trailing slash). */
export const VISIONE_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VISIONE_BASE_URL) ||
  'https://visione.isti.cnr.it:48123';

/** URL prefix for backend API services. */
export const VISIONE_SERVICES_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VISIONE_SERVICES_URL) ||
  'https://visione.isti.cnr.it:48123';

/** Dedicated URL for the new Search API endpoint. */
export const VISIONE_SEARCH_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VISIONE_SEARCH_URL) ||
  `${VISIONE_SERVICES_URL}/search`;

/** URL prefix for video assets. */
export const VISIONE_VIDEOS_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VISIONE_VIDEOS_URL) ||
  `${VISIONE_BASE_URL}/videos`;

