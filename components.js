class SiteHeader extends HTMLElement {
  async connectedCallback() {
    try {
      const response = await fetch('header.html');
      const html = await response.text();
      this.innerHTML = html;
    } catch (error) {
      // Fallback minimal header if fetching the external file fails (e.g., opened via file://)
      this.innerHTML = `
        <header>
          <div class="container nav">
            <nav aria-label="Primary">
              <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="dashboard.html">Dashboard</a></li>
                <li><a href="#projects">Projects</a></li>
                <!-- <li><a href="todo.html#projects">Future</a></li> -->
                <li><a href="index.html#contact">Socials</a></li>
              </ul>
            </nav>
          </div>
        </header>
      `;
    }
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    const year = new Date().getFullYear();
    this.innerHTML = `
      <footer>
        <div class="container">© ${year} Samarth Kumbla</div>
      </footer>
    `;
  }
}

// Shared animation initialization function
function initializePageAnimations() {
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
}

// Shared scroll reveal function  
function initializeScrollReveal() {
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
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);


