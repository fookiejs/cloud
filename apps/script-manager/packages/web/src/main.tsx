import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { AuthGate } from '@/components/auth-gate';
import { Toaster } from '@/components/ui/sonner';
import './styles.css';

const rootEl = document.getElementById('root');
if (rootEl === null) {
  throw new Error('root element missing');
}

createRoot(rootEl).render(
  <StrictMode>
    <AuthGate>
      <App />
      <Toaster />
    </AuthGate>
  </StrictMode>,
);
