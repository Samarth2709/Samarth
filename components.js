class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header>
        <div class="container nav">
          <div class="brand">SAMARTH KUMBLA</div>
          <nav aria-label="Primary">
            <ul>
              <li><a href="#about">About</a></li>
              <li><a href="#fencing">Fencing</a></li>
              <li><a href="#experience">Experience</a></li>
              <!-- <li><a href="#collegiate">Collegiate</a></li> -->
              <!-- <li><a href="#education">Education</a></li> -->
              <!-- <li><a href="#affiliations">Affiliations</a></li> -->
              <!-- <li><a href="#bohr">Bohr Systems</a></li> -->
              <li><a href="todo.html">Plans</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </nav>
        </div>
      </header>
    `;
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


