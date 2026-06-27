import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App.jsx'
import { ListsProvider } from './context/ListsContext.jsx'
import { RatingsProvider } from './context/RatingsContext.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60, // 1 hour
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ListsProvider>
          <RatingsProvider>
            <App />
          </RatingsProvider>
        </ListsProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
// test: verify PR checks
