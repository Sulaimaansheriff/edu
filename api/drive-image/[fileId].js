
const { google } = require("googleapis");

const ALLOWED_FOLDER_ID =
  "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  try {
    const fileId = req.query.fileId;

    // Validate the Google Drive file ID.
    if (
      typeof fileId !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(fileId)
    ) {
      return res.status(400).send("Invalid image ID");
    }

    // Read credentials from Vercel environment variables.
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (!privateKey || !clientEmail || !projectId) {
      console.error("Google Drive credentials are missing");
      return res.status(500).send("Server configuration error");
    }

    // Authenticate with Google Drive.
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

    // Retrieve metadata and verify the file belongs
    // directly to the approved images folder.
    const metadataResponse = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,parents",
      supportsAllDrives: true,
    });

    const metadata = metadataResponse.data;

    if (
      !(metadata.parents || []).includes(ALLOWED_FOLDER_ID)
    ) {
      return res.status(403).send("Image access denied");
    }

    // Accept image files only.
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

    // Do not let shared caches retain private images.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

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
