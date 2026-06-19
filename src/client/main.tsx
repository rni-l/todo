import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles/app.css';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

root.classList.remove('boot-screen');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
