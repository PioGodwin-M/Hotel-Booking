import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import './index.css'
import './config/env'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { AppProvider } from './context/AppContext.jsx'
import { WishlistProvider } from './context/WishlistContext.jsx'
import { BRAND_NAME } from './config/brand'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}

createRoot(document.getElementById('root')).render(
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY}
    afterSignOutUrl="/"
    appearance={{
      variables: {
        colorPrimary: '#0B1220',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        borderRadius: '10px',
      },
      elements: {
        card: 'shadow-lg border border-[#E7E5E0] rounded-[12px]',
        formButtonPrimary: 'bg-[#0B1220] hover:bg-[#1E293B] text-white rounded-[10px] text-sm font-medium',
      },
    }}
  >
    <BrowserRouter>
      <AppProvider>
        <WishlistProvider>
          <App />
        </WishlistProvider>
      </AppProvider>
    </BrowserRouter>
  </ClerkProvider>,
)
