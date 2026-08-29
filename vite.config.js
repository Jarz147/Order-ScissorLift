import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Nama repository GitHub Anda
const repo = 'Order-ScissorLift'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: `/${repo}/`,
})
