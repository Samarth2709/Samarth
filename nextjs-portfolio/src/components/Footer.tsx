'use client';

import { useEffect, useState } from 'react';

export default function Footer() {
  const [visitorCount, setVisitorCount] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Simple visitor counter using localStorage
    const count = localStorage.getItem('visitorCount') || '0';
    const newCount = parseInt(count) + 1;
    localStorage.setItem('visitorCount', newCount.toString());
    setVisitorCount(newCount);

    // Set last updated date
    const today = new Date().toLocaleDateString();
    setLastUpdated(today);
  }, []);

  const currentYear = new Date().getFullYear();

  // Prevent hydration mismatch by showing basic footer until mounted
  if (!mounted) {
    return (
      <footer>
        <div className="container">© {currentYear} Samarth Kumbla</div>
      </footer>
    );
  }

  return (
    <footer>
      <div className="container">
        © {currentYear} Samarth Kumbla • 
        <span style={{ color: 'var(--muted)' }}> Visitors: {visitorCount.toLocaleString()}</span> • 
        <span style={{ color: 'var(--muted)' }}> Updated: {lastUpdated}</span>
      </div>
    </footer>
  );
}
