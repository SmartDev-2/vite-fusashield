import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: './',
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'https://fusashield.vercel.app',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
