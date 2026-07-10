/**
 * Shared request guard for the /api/* serverless functions.
 * (Files starting with "_" in api/ are not exposed as routes by Vercel.)
 *
 * Rejects browser requests coming from OTHER sites (hotlinking our price
 * proxies). Requests without Origin/Referer (curl, server-to-server) are
 * allowed — this is a hotlink deterrent, not authentication.
 */
export function blockCrossSite(req, res) {
  const src = req.headers.origin || req.headers.referer || '';
  if (!src) return false;
  try {
    const srcHost = new URL(src).host;
    if (srcHost !== req.headers.host) {
      res.status(403).json({ error: 'forbidden' });
      return true;
    }
  } catch (_) {
    // Malformed Origin/Referer — let it through rather than break odd clients.
  }
  return false;
}
