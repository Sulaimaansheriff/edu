
const crypto = require("crypto");
const { google } = require("googleapis");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const fileId = req.query.fileId;
  const expires = req.query.expires;
  const signature = req.query.signature;

  const denyAccess = () => res.status(403).send("Access Denied");

  if (
    typeof fileId !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(fileId)
  ) {
    return denyAccess();
  }

  const signingSecret = process.env.IMAGE_SIGNING_SECRET;

  if (!signingSecret) {
    console.error("IMAGE_SIGNING_SECRET is missing");
    return res.status(500).send("Server configuration error");
  }

  if (
    typeof expires !== "string" ||
    !/^\d+$/.test(expires) ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return denyAccess();
  }

  const expiryTime = Number(expires);

  if (
    !Number.isSafeInteger(expiryTime) ||
    Math.floor(Date.now() / 1000) >= expiryTime
  ) {
    return denyAccess();
  }

  const expectedSignature = crypto
    .createHmac("sha256", signingSecret)
    .update(`${fileId}.${expires}`)
    .digest();

  const suppliedSignature = Buffer.from(signature, "hex");

  if (
    suppliedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return denyAccess();
  }

  try {
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
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    const metadataResponse = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,parents,trashed",
      supportsAllDrives: true,
    });

    const metadata = metadataResponse.data;
    const mimeType = metadata.mimeType;
    const folderId = "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";

    if (
      metadata.trashed ||
      !(metadata.parents || []).includes(folderId) ||
      !mimeType ||
      !mimeType.startsWith("image/")
    ) {
      return denyAccess();
    }

    const imageResponse = await drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "stream" }
    );

    res.setHeader("Content-Type", mimeType);

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
    console.error("Google Drive image error:", {
      message: error.message,
      status: error.response?.status,
    });

    if (!res.headersSent) {
      if (error.response?.status === 403) {
        return res.status(403).send("Access Denied");
      }

      if (error.response?.status === 404) {
        return res.status(404).send("Image not found");
      }

      return res.status(500).send("Unable to load image");
    }

    res.destroy(error);
  }
};
