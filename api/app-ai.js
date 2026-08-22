import { currentUser } from './_auth.js';

const AI_SCRIPT = '<script src="/js/ai-edital.js" defer></script>';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await currentUser(req);
  if (!user) return res.redirect(302, '/');

  try {
    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const upstream = await fetch(`${proto}://${host}/api/app`, { headers: { cookie: req.headers.cookie || '' }, redirect: 'manual' });
    const text = await upstream.text();
    if (!upstream.ok) {
      res.status(upstream.status);
      return res.send(text);
    }
    const html = text.replace('</body>', `${AI_SCRIPT}</body>`);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('[PRF JUCA APP AI]', error);
    return res.status(500).send('Não foi possível carregar o PRF JUCA.');
  }
}
