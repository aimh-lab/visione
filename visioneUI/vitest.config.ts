// vitest.config.ts
//
// Separate from vite.config.ts on purpose: that file has dev-server-only
// concerns (mkcert HTTPS certs, VITE_DEV_HTTPS_* env validation that throws
// on a misconfigured .env.local) which have nothing to do with running tests
// and would make test runs depend on dev-server setup. `sveltekit()` alone
// gives tests the same $lib alias resolution the app uses.
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    // Pure-logic unit tests only for now (src/lib, src/config, src/stores,
    // src/lib/controllers) — no Svelte component tests yet. Most of these
    // don't need a DOM; individual test files that do (e.g. localStorage-
    // backed stores) opt into jsdom per-file via a `// @vitest-environment
    // jsdom` comment at the top, so the rest of the suite stays fast.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
