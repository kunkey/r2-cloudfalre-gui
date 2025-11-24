addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  /**
   * Clamp number between min and max
   */
  function clamp(n, min, max) {
    if (isNaN(n)) return min
    return Math.max(min, Math.min(max, n))
  }
  
  /**
   * Encode path segments
   */
  function encodeKeyPath(key) {
    return key.split('/').map(encodeURIComponent).join('/')
  }
  
  // ---- CONFIG ----
  const BUCKET_BASE_URL = "https://<accountid>.r2.dev/<bucket>" // <== điền URL R2 bucket hoặc CDN
  
  async function handleRequest(request) {
    const url = new URL(request.url)
  
    if (!url.pathname.startsWith('/thumb')) {
      return new Response('Not found', { status: 404 })
    }
  
    const keyParam = url.searchParams.get('key')
    if (!keyParam) return new Response('Missing key', { status: 400 })
    if (!BUCKET_BASE_URL) return new Response('Worker not configured', { status: 500 })
  
    const key = keyParam.replace(/^\/+/, '')
    const lower = key.toLowerCase()
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.svg']
    if (!allowedExt.some(ext => lower.endsWith(ext))) return new Response('Unsupported type', { status: 415 })
  
    const width = clamp(parseInt(url.searchParams.get('w') || '512', 10), 8, 4096)
    const height = clamp(parseInt(url.searchParams.get('h') || '512', 10), 8, 4096)
    const quality = clamp(parseInt(url.searchParams.get('q') || '75', 10), 1, 100)
    const fit = url.searchParams.get('fit') || 'cover'
    const format = url.searchParams.get('fmt') || 'auto'
  
    const encodedKey = encodeKeyPath(key)
    const origin = BUCKET_BASE_URL.replace(/\/$/, '') + '/' + encodedKey
  
    const cfOptions = {
      image: { width, height, quality, fit, format },
      cacheEverything: true,
      cacheTtl: 604800 // 7 days
    }
  
    const upstream = await fetch(origin, { cf: cfOptions })
    if (!upstream.ok) return new Response('Upstream error: ' + upstream.status, { status: 502 })
  
    const headers = new Headers(upstream.headers)
    headers.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable')
    headers.delete('Content-Disposition') // inline thumbnail
    headers.set('Vary', 'Accept, Accept-Encoding, DPR, Viewport-Width, Width')
  
    return new Response(upstream.body, { status: 200, headers })
  }
  