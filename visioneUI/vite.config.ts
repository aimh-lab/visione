import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [
    tailwindcss(), 
    sveltekit(), 
    mkcert({
      hosts: ['localhost', 'tuo-hostname.local', '192.168.x.x']
    })
  ],
  server: { 
    https: true,
    host: true,  // o '0.0.0.0' per accettare connessioni da tutti gli indirizzi
    port: 8080
  },
  resolve: {
    alias: {
      '$stores': '/src/stores',
    }
  }
});

