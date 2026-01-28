const express = require("express");
const { nanoid } = require("nanoid");
const redis = require("./redis");

const router = express.Router();

function nowMs(req) {
  if (process.env.TEST_MODE === "1" && req.headers["x-test-now-ms"]) {
    return parseInt(req.headers["x-test-now-ms"]);
  }
  return Date.now();
}

router.get("/api/healthz", async (req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

router.post("/api/pastes", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "Invalid content" });
  }

  if (ttl_seconds !== undefined && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
    return res.status(400).json({ error: "Invalid ttl_seconds" });
  }

  if (max_views !== undefined && (!Number.isInteger(max_views) || max_views < 1)) {
    return res.status(400).json({ error: "Invalid max_views" });
  }

  const id = nanoid(10);

  await redis.hset(`paste:${id}`, {
    content,
    ttl_seconds: ttl_seconds ?? "",
    max_views: max_views ?? ""
  });

  if (ttl_seconds) await redis.expire(`paste:${id}`, ttl_seconds);

  res.json({
    id,
    url: `${req.protocol}://${req.get("host")}/p/${id}`
  });
});

router.get("/api/pastes/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;
  const paste = await redis.hgetall(key);

  if (!paste.content) return res.status(404).json({ error: "Not found" });

  if (paste.max_views) {
    const used = await redis.incr(`${key}:views`);
    if (used > parseInt(paste.max_views)) return res.status(404).json({ error: "Not found" });
  }

  let remaining = null;
  if (paste.max_views) {
    const used = parseInt(await redis.get(`${key}:views`) || "0");
    remaining = Math.max(parseInt(paste.max_views) - used, 0);
  }

  let expires_at = null;
  if (paste.ttl_seconds) {
    const ttl = await redis.ttl(key);
    if (ttl > 0) expires_at = new Date(nowMs(req) + ttl * 1000).toISOString();
  }

  res.json({
    content: paste.content,
    remaining_views: remaining,
    expires_at
  });
});

router.get("/p/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;
  const paste = await redis.hgetall(key);

  if (!paste.content) return res.sendStatus(404);

  if (paste.max_views) {
    const used = await redis.incr(`${key}:views`);
    if (used > parseInt(paste.max_views)) return res.sendStatus(404);
  }

  res.send(`
<html>
<body>
<pre>${paste.content.replace(/</g, "&lt;")}</pre>
</body>
</html>
`);
});

router.post("/create", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content) return res.send("Content required");

  const id = nanoid(10);

  await redis.hset(`paste:${id}`, {
    content,
    ttl_seconds: ttl_seconds || "",
    max_views: max_views || ""
  });

  if (ttl_seconds) await redis.expire(`paste:${id}`, parseInt(ttl_seconds));

  const url = `${req.protocol}://${req.get("host")}/p/${id}`;

  res.send(`
<html>
<body>
<p>Created:</p>
<a href="${url}">${url}</a>
</body>
</html>
`);
});

module.exports = router;
