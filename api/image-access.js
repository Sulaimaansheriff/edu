
import crypto from "crypto";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const secret = process.env.IMAGE_SIGNING_SECRET;

  if (!secret) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const token = crypto
    .createHmac("sha256", secret)
    .update(`image-access:${Math.floor(Date.now() / 1000)}`)
    .digest("hex");

  const expires = Math.floor(Date.now() / 1000) + 300;

  const signedToken = crypto
    .createHmac("sha256", secret)
    .update(`image-access:${expires}`)
    .digest("hex");

  return res.status(200).json({
    token: signedToken,
    expires
  });
}
