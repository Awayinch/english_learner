
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Increase the warning limit slightly (optional, default is 500)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Separate third-party libraries into their own files for better caching and parallel loading
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-genai': ['@google/genai'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  }
});
