'use client';

import { useState } from 'react';

export default function Home() {
  const [notification, setNotification] = useState<string | null>(null);

  // Copy email to clipboard functionality
  const copyEmailToClipboard = async (event: React.MouseEvent) => {
    event.preventDefault();
    const email = 'samarth.kumbla@gmail.com';
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(email);
        showNotification('Copied email to clipboard');
      } else {
        fallbackCopyToClipboard(email);
      }
    } catch (error) {
      fallbackCopyToClipboard(email);
    }
  };

  const fallbackCopyToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      showNotification('Copied email to clipboard');
    } catch (err) {
      console.error('Failed to copy email to clipboard', err);
      showNotification('Failed to copy email');
    }
    
    document.body.removeChild(textArea);
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  return (
    <>
      {notification && (
        <div className="notification-toast show">
          {notification}
        </div>
      )}

      <section className="hero">
        <div className="container hero-inner">
          <div>
            <h1 className="title">Samarth Kumbla</h1>
          </div>
        </div>
      </section>

      <section id="about">
        <div className="container two-col">
          <div>
            <p>I&apos;ve been building things for as long as I can remember. 
              <br />
              <br />
              <br />
              At 12, I was building circuits with my dad.
              <br />
              <br />
              <br />
              At 14, I built my first autonomous robot
              <br />
              <br />
              <br />
              At 16, I was writing Python scripts to automate my mom&apos;s job.
              <br />
              <br />
              <br />
              Now I am building to solve real world problems, from drone navigation to investment due diligence automation.</p>
          </div>
          <div className="card experience-card">
            <div className="caps">Experience</div>
            <ul className="list">
              <li>
                <div className="experience-item">
                  <div className="experience-header">
                    <span className="experience-year">2025</span>
                    <span className="experience-role">Co-Founder & CTO</span>
                  </div>
                  <div className="experience-company">Bohr Systems</div>
                  <div className="experience-description">Leading autonomous drone navigation technology for GPS-denied environments.</div>
                </div>
              </li>
              <li>
                <div className="experience-item">
                  <div className="experience-header">
                    <span className="experience-year">2024</span>
                    <span className="experience-role">AI Researcher</span>
                  </div>
                  <div className="experience-company">Mosaic AI</div>
                  <div className="experience-description">Development of AI systems to automate Commercial Real Estate Due Diligence.</div>
                </div>
              </li>
              <li>
                <div className="experience-item">
                  <div className="experience-header">
                    <span className="experience-year">2021</span>
                    <span className="experience-role">Software Engineer</span>
                  </div>
                  <div className="experience-company">NASA Ames Research Center</div>
                  <div className="experience-description">Found ways to reduce carbon emmmisions for aircrafts nationwide.</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="projects">
        <div className="container two-col">
          <div>
            <h2 className="caps">Projects</h2>
            <ul className="list">
              <li><strong>Paper Writer Agentic Application</strong> — Plans, composes, and refines papers according to user&apos;s requirements, utilizing 3+ LLM models and 7+ AI Agents.</li>
              <li><strong>Selenium Web Scraping</strong> — Retrieves 100+ statistics for 250+ companies to create comprehensive appraisals for companies.</li>
              <li><strong>Find You</strong> — Detects your face, stores it in a database, and finds pictures of you online using facial recognition technology.</li>
            </ul>
          </div>
          <div className="card">
            <div className="caps">Current Focus</div>
            <p>Currently building at Bohr Systems while pursuing Computer Science at Columbia University and competing internationally in fencing.</p>
          </div>
        </div>
      </section>

      <section id="fencing">
        <div className="container">
          <div>
            At 10, I started fencing, but for years I couldn&apos;t match my older brother&apos;s performance at that age, and many <strong className="third">expected me to fail</strong>. 
            <br />
            <br />
            At 17, I trained every morning before school and every evening after. 
            <br />
            <br />
            That year I made the World Team and won <strong className="third">bronze</strong> and <strong className="third">gold</strong> at my first World Championships. 
            <br />
            <br />
            The next year I again got <strong className="third">bronze</strong> and <strong className="third">gold</strong> at my second World Championships, became <strong className="third">#1 in the world</strong>, and later became a <strong className="third">two-time Ivy League Champion</strong> while at Columbia.
            <br />
            <br />
          </div>
        </div>
      </section>

      <section id="contact">
        <div className="container two-col">
          <div>
            <div className="social-section">
              <div className="caps">Connect</div>
              <ul className="social-links">
                <li>
                  <a href="https://www.linkedin.com/in/samarth-kumbla-77597523b/" target="_blank" rel="noopener noreferrer">
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" focusable="false">
                      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM0 8h5v16H0V8zm7.5 0h4.8v2.2h.07c.67-1.27 2.3-2.6 4.73-2.6 5.06 0 6 3.33 6 7.66V24h-5v-7.8c0-1.86-.03-4.25-2.59-4.25-2.6 0-3 2.03-3 4.12V24h-5V8z"></path>
                    </svg>
                    <span>LinkedIn</span>
                  </a>
                </li>
                <li>
                  <a href="https://x.com/smrthkumbla" target="_blank" rel="noopener noreferrer">
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" focusable="false">
                      <path d="M18.244 2H21.5l-7.5 8.57L22 22h-5.906l-4.62-5.93L5.1 22H1.84l8.06-9.2L2 2h6.094l4.18 5.52L18.244 2zm-1.036 18h2.06L7.878 4h-2.1l11.43 16z"></path>
                    </svg>
                    <span>X (Twitter)</span>
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Samarth2709" target="_blank" rel="noopener noreferrer">
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" focusable="false">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"></path>
                    </svg>
                    <span>GitHub</span>
                  </a>
                </li>
                <li>
                  <a href="#" onClick={copyEmailToClipboard}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" focusable="false">
                      <path d="M0 3v18h24V3H0zm21.518 2L12 12.713 2.482 5h19.036zM2 19V7.183l10 8.104 10-8.104V19H2z"></path>
                    </svg>
                    <span>Email</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="card">
            <div className="caps">Quick links</div>
            <ul className="list">
              <li><a href="#about">Story</a></li>
              <li><a href="#projects">Projects</a></li>
              <li><a href="#fencing">Fencing</a></li>
              <li><a href="/dashboard">Dashboard</a></li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}