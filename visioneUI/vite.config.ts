// @ts-nocheck
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import { existsSync, readFileSync } from 'node:fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devHttpsKey = env.VITE_DEV_HTTPS_KEY || process.env.VITE_DEV_HTTPS_KEY || '';
  const devHttpsCert = env.VITE_DEV_HTTPS_CERT || process.env.VITE_DEV_HTTPS_CERT || '';
  const hasDevHttpsEnv = Boolean(devHttpsKey || devHttpsCert);
  const hasDevHttpsCerts = Boolean(devHttpsKey && devHttpsCert && existsSync(devHttpsKey) && existsSync(devHttpsCert));

  if (hasDevHttpsEnv && !hasDevHttpsCerts) {
    throw new Error(
      'VITE_DEV_HTTPS_KEY and VITE_DEV_HTTPS_CERT are set, but one or both files are missing or not readable by this user.'
    );
  }

  return {
    plugins: [
      tailwindcss(), 
      sveltekit(), 
      ...(!hasDevHttpsCerts
        ? [
            mkcert({
              hosts: ['localhost', 'tuo-hostname.local', '192.168.x.x']
            })
          ]
        : [])
    ],
    server: { 
      https: hasDevHttpsCerts
        ? {
            key: readFileSync(devHttpsKey),
            cert: readFileSync(devHttpsCert)
          }
        : true,
      host: true,  // o '0.0.0.0' per accettare connessioni da tutti gli indirizzi
      port: 8080
    },
    resolve: {
      alias: {
        '$stores': '/src/stores',
      }
    }
  };
});
