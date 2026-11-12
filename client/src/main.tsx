import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import { App } from './App.tsx';
import './styles.css';

gsap.defaults({ force3D: true });
gsap.ticker.lagSmoothing(500, 33);

const root = document.querySelector('#root');
if (!root) throw new Error('missing root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
