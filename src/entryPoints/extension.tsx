import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionHome } from '../pages/ExtensionHome/ExtensionHome.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExtensionHome />
  </StrictMode>
);
