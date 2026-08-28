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

  // Extra hostnames/IPs mkcert should issue the dev HTTPS cert for, e.g. when
  // accessing the dev server from another machine on the LAN. Configure per
  // developer via .env.local (gitignored), comma-separated:
  //   VITE_DEV_MKCERT_HOSTS=my-machine.local,192.168.1.42
  const devMkcertHosts = (env.VITE_DEV_MKCERT_HOSTS || process.env.VITE_DEV_MKCERT_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const mkcertHosts = ['localhost', ...devMkcertHosts];

  const devServerPort = Number(env.VITE_DEV_SERVER_PORT || process.env.VITE_DEV_SERVER_PORT) || 8080;

  return {
    plugins: [
      tailwindcss(),
      sveltekit(),
      ...(!hasDevHttpsCerts
        ? [
            mkcert({
              hosts: mkcertHosts
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
      port: devServerPort
    },
    resolve: {
      alias: {
        '$stores': '/src/stores',
      }
    }
  };
});
