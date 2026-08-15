import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: '#1F2937',
          color: '#F8FAFC',
          border: '1px solid rgba(255,255,255,0.08)'
        }
      }}
    />
  </StrictMode>
);
