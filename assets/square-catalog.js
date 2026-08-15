// Replace this with your deployed Cloudflare Worker URL after setup
const WORKER_URL = 'https://webbie-catalog.bywebbie.workers.dev/products';

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" width="64" height="64"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;

function formatPrice(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}

function buildCard(product, ariaHidden = false) {
  const card = document.createElement('a');
  card.className = 'product-card webbie-gallery__item';
  card.href = product.checkoutUrl || '#';
  if (product.checkoutUrl) {
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
  }
  if (ariaHidden) card.setAttribute('aria-hidden', 'true');

  const imgWrap = document.createElement('div');
  imgWrap.className = 'product-card__img';
  if (product.imageUrl) {
    const img = document.createElement('img');
    img.src = product.imageUrl;
    img.alt = product.name;
    img.loading = 'lazy';
    imgWrap.appendChild(img);
  } else {
    imgWrap.innerHTML = PLACEHOLDER_SVG;
  }

  const info = document.createElement('div');
  info.className = 'product-card__info';
  info.innerHTML = `
    <span class="product-card__name">${product.name}</span>
    <span class="product-card__price">${product.price}</span>
    ${product.soldOut ? '<span class="product-card__sold-out">Sold out</span>' : ''}
  `;

  card.appendChild(imgWrap);
  card.appendChild(info);
  return card;
}

async function loadCatalog() {
  const track = document.getElementById('gallery-track');
  if (!track) return;

  let products = [];
  try {
    const res = await fetch(WORKER_URL);
    if (!res.ok) throw new Error(`Worker responded ${res.status}`);
    products = await res.json();
  } catch {
    // Worker not yet configured — fall back to placeholder cards
    products = [
      { name: 'Krill Tee', price: '$48' },
      { name: 'Anglerfish Tee', price: '$48' },
      { name: 'Octopus Print', price: '$36' },
      { name: 'Nautilus Tee', price: '$48' },
      { name: 'Cuttlefish Tote', price: '$28' },
    ];
  }

  // Render set 1 + duplicate set 2 for seamless marquee loop
  const fragment = document.createDocumentFragment();
  [...products, ...products.map(p => ({ ...p, _dupe: true }))].forEach((p, i) => {
    fragment.appendChild(buildCard(p, i >= products.length));
  });
  track.appendChild(fragment);
}

loadCatalog();
