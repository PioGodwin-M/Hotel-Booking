/**
 * Middleware to disable HTTP caching and conditional ETag handling for sensitive,
 * authenticated endpoints (e.g. GET /api/users/me).
 *
 * Prevents 304 Not Modified responses so that API clients always receive
 * the complete, up-to-date user profile payload.
 */
export const noCache = (req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });

  // Prevent Express from evaluating req.fresh as true
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];

  // Intercept writeHead to strip ETag header before flushing to the client
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    this.removeHeader("ETag");
    return originalWriteHead.apply(this, args);
  };

  next();
};

export default noCache;
