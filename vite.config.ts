import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
// `npm run dev:phone` → https on the local network, so phones/tablets on the same Wi-Fi can open the camera
export default defineConfig(({ mode }) => ({ plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])] }))
