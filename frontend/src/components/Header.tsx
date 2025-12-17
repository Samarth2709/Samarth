'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header>
      <div className="container nav">
        <nav aria-label="Primary">
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/dashboard">Dashboard</Link></li>
            <li><Link href="/#projects">Projects</Link></li>
            <li><Link href="/#contact">Socials</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
