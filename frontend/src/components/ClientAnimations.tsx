'use client';

import { useEffect } from 'react';

export default function ClientAnimations() {
  useEffect(() => {
    // Initialize page animations
    const initializePageAnimations = () => {
      const body = document.body;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (prefersReduced) {
        body.classList.remove('titles-init', 'texts-init');
        body.classList.add('titles-in', 'texts-in');
      } else {
        requestAnimationFrame(() => {
          body.classList.add('titles-in');
          body.classList.remove('titles-init');
        });
        const TITLES_DURATION = 600;
        setTimeout(() => {
          body.classList.add('texts-in');
          body.classList.remove('texts-init');
        }, TITLES_DURATION + 80);
      }
    };

    // Initialize scroll reveal
    const initializeScrollReveal = () => {
      const targets = document.querySelectorAll('section, .card');
      targets.forEach(el => el.classList.add('reveal'));

      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });

      targets.forEach(el => io.observe(el));
    };

    // Initialize animations
    initializePageAnimations();
    initializeScrollReveal();

  }, []);

  return null;
}




