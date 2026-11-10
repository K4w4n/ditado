import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Caminhos relativos funcionam tanto em usuario.github.io/repo/ quanto
  // em um domínio próprio.
  base: './',
  plugins: [react()],
})
