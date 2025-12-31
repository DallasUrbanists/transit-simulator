// vite.config.js
import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    build: {
      rollupOptions: {
        input: {
          appMain: resolve(__dirname, 'index.html'),
          appTest: resolve(__dirname, 'test.html'),
        },
      },
    },
  };
});
