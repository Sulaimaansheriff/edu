const { google } = require("googleapis");

const ALLOWED_FOLDER_ID = "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const fileId = req.query.fileId;

  if (
    typeof fileId !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(fileId)
  ) {
    return res.status(400).send("Invalid image ID");
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

    const drive = google.drive({
      version: "v3",
      auth,
    });

    // Confirm the file belongs to the approved folder.
    const metadataResponse = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,parents,trashed",
      supportsAllDrives: true,
    });

    const metadata = metadataResponse.data;

    if (
      metadata.trashed ||
      !(metadata.parents || []).includes(ALLOWED_FOLDER_ID) ||
      !metadata.mimeType ||
      !metadata.mimeType.startsWith("image/")
    ) {
      return res.status(403).send("Image access denied");
    }

    // Stream the private image directly to the browser.
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
      console.error("Image stream error:", error.message);

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
        return res.status(403).send("Google Drive permission denied");
      }

      if (error.response?.status === 404) {
        return res.status(404).send("Image not found");
      }

      return res.status(500).send("Unable to load image");
    }

    res.destroy(error);
  }
};
