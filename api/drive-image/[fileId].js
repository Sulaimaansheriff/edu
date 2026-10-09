
const { google } = require("googleapis");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const fileId = req.query.fileId;

    // Validate the Google Drive file ID
    if (
      typeof fileId !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(fileId)
    ) {
      return res.status(400).send("Invalid image ID");
    }

    // Read credentials from Vercel environment variables
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (!privateKey || !clientEmail || !projectId) {
      console.error("Google Drive credentials are missing");
      return res.status(500).send("Server configuration error");
    }

    // Authenticate with Google Drive
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

    // Retrieve file metadata
    const metadataResponse = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size,webViewLink",
      supportsAllDrives: true,
    });

    const metadata = metadataResponse.data;
    const mimeType = metadata.mimeType;

    console.log("Drive file metadata:", {
      id: metadata.id,
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: metadata.size,
    });

    // Accept image files only
    if (!mimeType || !mimeType.startsWith("image/")) {
      return res.status(400).send("The requested file is not an image");
    }

    // Download the image
    const imageResponse = await drive.files.get(
      {
        fileId,
        alt: "media",
        acknowledgeAbuse: true,
        supportsAllDrives: true,
      },
      {
        responseType: "stream",
      }
    );

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    imageResponse.data.on("error", (error) => {
      console.error(
        "Google Drive image stream error:",
        error.message
      );

      if (!res.headersSent) {
        res.status(502).end("Image download failed");
      } else {
        res.destroy(error);
      }
    });

    imageResponse.data.pipe(res);
  } catch (error) {
    const googleError = error.response?.data?.error;

    console.error("Google Drive image error:", {
      message: error.message,
      status: error.response?.status,
      reason: googleError?.errors?.[0]?.reason,
      details: googleError?.message,
    });

    if (!res.headersSent) {
      const status = error.response?.status;

      if (status === 403) {
        return res
          .status(403)
          .send("Google Drive denied permission to download this image");
      }

      if (status === 404) {
        return res
          .status(404)
          .send("Image not found or not accessible");
      }

      return res.status(500).send("Unable to load image");
    }

    res.destroy(error);
  }
};
