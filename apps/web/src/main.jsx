import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { ListsProvider } from './context/ListsContext.jsx'
import { RatingsProvider } from './context/RatingsContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ListsProvider>
        <RatingsProvider>
          <App />
        </RatingsProvider>
      </ListsProvider>
    </BrowserRouter>
  </StrictMode>,
)
