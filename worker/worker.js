// Cloudflare Worker для IndexAA.
//   POST /lead  — пересылает заявку с сайта вам в Telegram.
//   GET  /posts — последние посты публичного канала в JSON (кэш 30 минут).
// Секреты (Settings → Variables): TG_BOT_TOKEN, TG_CHAT_ID.
// Переменные: CHANNEL (например indexagafonov), ALLOWED_ORIGIN (адрес сайта или *).

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    const json = (data, status = 200, extra = {}) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...extra } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);

    if (url.pathname === '/lead' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      const clip = (s, n) => String(s || '').slice(0, n).trim();
      const name = clip(body.name, 100);
      const contact = clip(body.contact, 150);
      if (!name || !contact) return json({ error: 'name and contact required' }, 400);

      const text = [
        '🔔 Новая заявка с сайта IndexAA',
        '',
        '👤 ' + name,
        '📞 ' + contact,
        body.message ? '\n💬 ' + clip(body.message, 2000) : '',
        body.audit ? '\n📊 Аудит:\n' + clip(body.audit, 1500) : ''
      ].filter(Boolean).join('\n');

      const tg = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text, disable_web_page_preview: true })
      });
      if (!tg.ok) return json({ error: 'telegram error' }, 502);
      return json({ ok: true });
    }

    if (url.pathname === '/posts' && request.method === 'GET') {
      const cache = caches.default;
      const cacheKey = new Request(url.origin + '/posts-cache');
      const cached = await cache.match(cacheKey);
      if (cached) return json(await cached.json());

      const channel = env.CHANNEL || 'indexagafonov';
      const res = await fetch(`https://t.me/s/${channel}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) return json([], 200);
      const posts = parsePosts(await res.text(), channel).slice(0, 6);

      ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(posts), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=1800' }
      })));
      return json(posts);
    }

    return json({ error: 'not found' }, 404);
  }
};

function parsePosts(html, channel) {
  const out = [];
  const blocks = html.split('data-post="').slice(1);
  for (const block of blocks) {
    const id = block.slice(0, block.indexOf('"'));
    if (!id.startsWith(channel + '/')) continue;
    const textMatch = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!textMatch) continue;
    const text = decode(textMatch[1].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')).trim();
    if (!text) continue;
    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    out.push({ id, text, date: dateMatch ? dateMatch[1] : null, url: 'https://t.me/' + id });
  }
  return out.reverse(); // сначала новые
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
