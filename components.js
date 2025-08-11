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
                <li><a href="#projects">Projects</a></li>
                <li><a href="todo.html#projects">Future</a></li>
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

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);


