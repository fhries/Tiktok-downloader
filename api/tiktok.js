// api/tiktok.js
// Serverless function (Vercel) — proxy ke vibetik.net supaya request
// tidak kena blokir CORS saat dipanggil langsung dari browser.
//
// Dipanggil dari frontend sebagai: /api/tiktok?url=<link-tiktok>

export default async function handler(req, res) {
  // izinkan dipanggil dari domain sendiri (same-origin, jadi ini formalitas)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ status: 'error', message: 'Parameter "url" wajib diisi.' });
    return;
  }

  try {
    const params = new URLSearchParams({ url: url.trim() });
    const upstream = await fetch(
      `https://vibetik.net/api/v1/tiktok/info?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Referer: 'https://vibetik.net/',
          Origin: 'https://vibetik.net',
        },
      }
    );

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await upstream.text();
      res.status(502).json({
        status: 'error',
        message: 'Server sumber tidak mengembalikan JSON (mungkin sedang bermasalah).',
        raw: text.slice(0, 300),
      });
      return;
    }

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Gagal menghubungi server sumber: ' + (err?.message || 'unknown error'),
    });
  }
}
