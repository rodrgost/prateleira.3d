import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { DesktopPetApp } from './features/desktop-pet/DesktopPetApp'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const isPetMode = params.get('mode') === 'pet'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPetMode ? <DesktopPetApp /> : <App />}
  </StrictMode>,
)
