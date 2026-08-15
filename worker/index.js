// Cloudflare Worker — Square Catalog proxy
// Secret: set SQUARE_TOKEN via `wrangler secret put SQUARE_TOKEN`
// Environment variable: set ALLOWED_ORIGIN in wrangler.toml [vars]

const SQUARE_API = 'https://connect.squareup.com/v2';

function corsHeaders(origin, allowed) {
  // Only reflect the origin back if it matches the allowed origin
  const allowedOrigin = origin === allowed ? origin : allowed;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/products') {
      return new Response('Not found', { status: 404, headers });
    }

    try {
      const squareRes = await fetch(`${SQUARE_API}/catalog/list?types=ITEM`, {
        headers: {
          'Authorization': `Bearer ${env.SQUARE_TOKEN}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json',
        },
      });

      if (!squareRes.ok) {
        const err = await squareRes.text();
        return new Response(JSON.stringify({ error: err }), {
          status: squareRes.status,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      const data = await squareRes.json();
      const items = (data.objects || []).filter(o => o.type === 'ITEM');

      // Fetch image URLs in a second call if items reference image IDs
      const imageIds = items
        .flatMap(item => item.item_data?.image_ids || [])
        .filter(Boolean);

      let imageMap = {};
      if (imageIds.length > 0) {
        const imgRes = await fetch(`${SQUARE_API}/catalog/batch-retrieve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SQUARE_TOKEN}`,
            'Square-Version': '2024-01-18',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ object_ids: imageIds }),
        });
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          (imgData.objects || []).forEach(obj => {
            if (obj.type === 'IMAGE') imageMap[obj.id] = obj.image_data?.url;
          });
        }
      }

      const products = items.map(item => {
        const data = item.item_data || {};
        const variation = (data.variations || [])[0];
        const priceMoney = variation?.item_variation_data?.price_money;
        const imageId = (data.image_ids || [])[0];

        return {
          id: item.id,
          name: data.name || 'Unnamed product',
          price: priceMoney
            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: priceMoney.currency }).format(priceMoney.amount / 100)
            : 'Price TBD',
          imageUrl: imageId ? imageMap[imageId] : null,
          // checkoutUrl: add Square payment link URL here per product
          checkoutUrl: null,
          soldOut: false,
        };
      });

      return new Response(JSON.stringify(products), {
        headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  },
};
