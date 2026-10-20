import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { FormViewport } from './app/FormViewport';
import { AppProviders } from './app/providers';
import './styles/index.css';
import './styles/nearby.css';
import './styles/form-viewport.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <FormViewport />
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>
);
