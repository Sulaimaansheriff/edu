
const crypto = require("crypto");

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.IMAGE_SIGNING_SECRET;

  if (!secret) {
    return res.status(500).json({
      error: "Server configuration error",
    });
  }

  const referer = req.headers.referer;

  if (!referer) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    if (
      new URL(referer).origin !==
      "https://edu-phi-eight.vercel.app"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }
  } catch {
    return res.status(403).json({ error: "Access denied" });
  }

  const expires = Math.floor(Date.now() / 1000) + 300;

  const token = crypto
    .createHmac("sha256", secret)
    .update(`image-access:${expires}`)
    .digest("hex");

  return res.status(200).json({ token, expires });
};
