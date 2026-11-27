import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ArtistOnboarding } from './ArtistOnboarding';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ArtistOnboarding />
  </StrictMode>
);
