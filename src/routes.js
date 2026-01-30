const express = require("express");
const { nanoid } = require("nanoid");
const redis = require("./redis");

const router = express.Router();

function nowMs(req) {
  if (process.env.TEST_MODE === "1" && req.headers["x-test-now-ms"]) {
    return parseInt(req.headers["x-test-now-ms"], 10);
  }
  return Date.now();
}

router.get("/api/healthz", async (req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

router.post("/api/pastes", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "Invalid content" });
  }

  if (ttl_seconds !== undefined && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
    return res.status(400).json({ error: "Invalid ttl_seconds" });
  }

  if (max_views !== undefined && (!Number.isInteger(max_views) || max_views < 1)) {
    return res.status(400).json({ error: "Invalid max_views" });
  }

  const id = nanoid(10);

  const expiresAt = ttl_seconds
    ? nowMs(req) + ttl_seconds * 1000
    : "";

  await redis.hset(`paste:${id}`, {
    content,
    expires_at: expiresAt,
    max_views: max_views ?? ""
  });

  res.json({
    id,
    url: `${req.protocol}://${req.get("host")}/p/${id}`
  });
});

router.get("/api/pastes/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;
  const paste = await redis.hgetall(key);

  if (!paste.content) return res.status(404).json({ error: "Not found" });

  if (paste.expires_at && nowMs(req) > parseInt(paste.expires_at)) {
    return res.status(404).json({ error: "Not found" });
  }

  let remaining = null;

  if (paste.max_views) {
    const used = await redis.incr(`${key}:views`);

    if (used > parseInt(paste.max_views)) {
      return res.status(404).json({ error: "Not found" });
    }

    remaining = Math.max(parseInt(paste.max_views) - used, 0);
  }

  let expires_at = null;
  if (paste.expires_at) {
    expires_at = new Date(parseInt(paste.expires_at)).toISOString();
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

  if (paste.expires_at && nowMs(req) > parseInt(paste.expires_at)) {
    return res.sendStatus(404);
  }

  if (paste.max_views) {
    const used = await redis.incr(`${key}:views`);
    if (used > parseInt(paste.max_views)) return res.sendStatus(404);
  }

  const safe = paste.content.replace(/</g, "&lt;");

  res.send(`
<html>
<body>
<pre>${safe}</pre>
</body>
</html>
`);
});

router.post("/create", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content) return res.send("Content required");

  const id = nanoid(10);

  const expiresAt = ttl_seconds
    ? nowMs(req) + parseInt(ttl_seconds) * 1000
    : "";

  await redis.hset(`paste:${id}`, {
    content,
    expires_at: expiresAt,
    max_views: max_views || ""
  });

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