
const { google } = require("googleapis");
const crypto = require("crypto");

const ALLOWED_FOLDER_ID =
  "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";

const ALLOWED_ORIGIN = "https://edu-phi-eight.vercel.app";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  try {
    // Check the website Referer (a deterrent, not strong authentication).
    const referer = req.headers.referer;

    if (!referer) {
      return res.status(403).send("Access Denied");
    }

    let refererUrl;
    try {
      refererUrl = new URL(referer);
    } catch {
      return res.status(403).send("Access Denied");
    }

    if (refererUrl.origin !== ALLOWED_ORIGIN) {
      return res.status(403).send("Access Denied");
    }

    // Require a valid, unexpired server-signed token.
    const secret = process.env.IMAGE_SIGNING_SECRET;
    const { token, expires } = req.query;

    if (
      !secret ||
      typeof token !== "string" ||
      typeof expires !== "string" ||
      !/^\d+$/.test(expires)
    ) {
      return res.status(403).send("Access Denied");
    }

    const expiry = Number(expires);
    const now = Math.floor(Date.now() / 1000);

    // Tokens are valid for at most five minutes.
    if (
      !Number.isSafeInteger(expiry) ||
      expiry <= now ||
      expiry > now + 300
    ) {
      return res.status(403).send("Access Denied");
    }

    const expectedToken = crypto
      .createHmac("sha256", secret)
      .update(`image-access:${expiry}`)
      .digest("hex");

    const tokenBuffer = Buffer.from(token, "hex");
    const expectedBuffer = Buffer.from(expectedToken, "hex");

    if (
      tokenBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
    ) {
      return res.status(403).send("Access Denied");
    }

    // Validate the Google Drive file ID.
    const fileId = req.query.fileId;

    if (
      typeof fileId !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(fileId)
    ) {
      return res.status(400).send("Invalid image ID");
    }

    // Read Google credentials from Vercel environment variables.
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (!privateKey || !clientEmail || !projectId) {
      console.error("Google Drive credentials are missing");
      return res.status(500).send("Server configuration error");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/drive.readonly",
      ],
    });

    const drive = google.drive({
      version: "v3",
      auth,
    });

    // Verify that the image belongs to the approved folder.
    const metadataResponse = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,parents",
      supportsAllDrives: true,
    });

    const metadata = metadataResponse.data;

    if (!(metadata.parents || []).includes(ALLOWED_FOLDER_ID)) {
      return res.status(403).send("Image access denied");
    }

    if (
      !metadata.mimeType ||
      !metadata.mimeType.startsWith("image/")
    ) {
      return res.status(400).send("The requested file is not an image");
    }

    // Stream the image from Google Drive.
    const imageResponse = await drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      {
        responseType: "stream",
      }
    );

    res.setHeader("Content-Type", metadata.mimeType);

    imageResponse.data.on("error", (error) => {
      console.error("Google Drive image stream error:", error.message);

      if (!res.headersSent) {
        res.status(502).end("Image download failed");
      } else {
        res.destroy(error);
      }
    });

    imageResponse.data.pipe(res);
  } catch (error) {
    const status = error.response?.status;

    console.error("Google Drive image error:", {
      message: error.message,
      status,
      details: error.response?.data?.error?.message,
    });

    if (!res.headersSent) {
      if (status === 403) {
        return res.status(403).send("Image access denied");
      }

      if (status === 404) {
        return res.status(404).send("Image not found");
      }

      return res.status(500).send("Unable to load image");
    }

    res.destroy(error);
  }
};
