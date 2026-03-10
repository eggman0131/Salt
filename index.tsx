
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { registerServiceWorker } from './pwa-registration';
import { ThemeProvider } from './shared/providers/ThemeProvider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { V2App } from './modules/v2-ui/V2App';

const isV2 = window.location.pathname.startsWith('/V2UI');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      {isV2 ? <V2App /> : <App />}
    </ThemeProvider>
  </React.StrictMode>
);

// Register service worker for PWA functionality
registerServiceWorker();
