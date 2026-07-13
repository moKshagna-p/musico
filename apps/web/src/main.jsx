import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App.jsx'
import { ListsProvider } from './context/ListsContext.jsx'
import { RatingsProvider } from './context/RatingsContext.jsx'
import { homeSectionsQueryOptions } from './queries/homeSections.js'
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

// Kick off the homepage data fetch before React mounts so the request
// runs in parallel with rendering instead of after it.
if (window.location.pathname === '/') {
  void queryClient.prefetchQuery(homeSectionsQueryOptions)
}

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
