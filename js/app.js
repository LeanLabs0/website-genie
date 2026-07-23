// Website Genie — app logic (classic script, no build, no modules).

// image-slot: lightweight stand-in for the design-canvas component.
// Fills its positioned parent; shows the placeholder label until a real image src is set.
// Reacts to a late `src` set via observedAttributes (the original element only read
// src in connectedCallback, so setting it after parse did nothing).
customElements.define('image-slot', class extends HTMLElement {
  static get observedAttributes() { return ['src']; }
  connectedCallback() { this.renderSlot(); }
  attributeChangedCallback() { if (this.isConnected) this.renderSlot(); }
  renderSlot() {
    const src = this.getAttribute('src');
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
      if (this.dataset.fit) img.style.objectPosition = this.dataset.fit;
      this.replaceChildren(img);
    } else {
      const ph = document.createElement('span');
      ph.className = 'ph';
      ph.textContent = this.dataset.placeholder || 'Image';
      this.replaceChildren(ph);
    }
  }
});

const ORDER = ['entry', 'copy', 'credibility', 'conversion', 'code', 'cost', 'conversation'];
let move = 'entry';

function render() {
  const cur = ORDER.indexOf(move);
  document.querySelectorAll('.step').forEach(btn => {
    const i = ORDER.indexOf(btn.dataset.step);
    btn.classList.remove('done', 'active', 'sel', 'next', 'locked');
    let st;
    if (i < cur) { btn.classList.add('done'); st = 'Complete'; }
    else if (i === cur) { btn.classList.add('active', 'sel'); st = 'You are here'; }
    else if (i === cur + 1) { btn.classList.add('next'); st = 'Up next'; }
    else { btn.classList.add('locked'); st = 'Locked'; }
    btn.querySelector('.sst').textContent = st;
  });
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = s.dataset.screen !== move; });
}

function go(k) {
  move = k;
  history.replaceState(null, '', '#' + k);
  render();
  window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (t) go(t.dataset.go);
});

const h = location.hash.slice(1);
if (ORDER.includes(h)) move = h;
render();
