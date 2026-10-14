import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
import './styles.css'
import App from './App.jsx'
import { WorldProvider } from './state/WorldContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WorldProvider>
      <App />
    </WorldProvider>
  </StrictMode>,
)
