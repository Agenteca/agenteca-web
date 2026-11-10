import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// Rendu côté serveur : chaque page est du HTML complet, lisible sans JavaScript.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 3000 },
  security: { checkOrigin: true },
  devToolbar: { enabled: false },
});
