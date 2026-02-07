import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { RatingsProvider } from './context/RatingsContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RatingsProvider>
        <App />
      </RatingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
