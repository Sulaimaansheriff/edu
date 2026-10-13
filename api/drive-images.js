
const { google } = require("googleapis");

const FOLDER_ID = "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";
const ALLOWED_ORIGIN = "https://edu-phi-eight.vercel.app";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  // Basic browser Referer check.
  const referer = req.headers.referer;

  if (!referer) {
    return res.status(403).json({
      error: "Access Denied",
    });
  }

  try {
    if (new URL(referer).origin !== ALLOWED_ORIGIN) {
      return res.status(403).json({
        error: "Access Denied",
      });
    }
  } catch {
    return res.status(403).json({
      error: "Access Denied",
    });
  }

  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (!privateKey || !clientEmail || !projectId) {
      console.error("Google Drive credentials are missing");

      return res.status(500).json({
        error: "Server configuration error",
      });
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

    const result = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, parents)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const images = (result.data.files || [])
      .filter((file) => {
        const match = file.name.match(
          /^(\d+)\.(png|jpe?g|webp)$/i
        );

        return (
          match &&
          file.mimeType &&
          file.mimeType.startsWith("image/") &&
          (file.parents || []).includes(FOLDER_ID)
        );
      })
      .map((file) => ({
        name: file.name,
        number: Number(file.name.match(/^(\d+)/)[1]),
        url: `/api/drive-image/${file.id}`,
      }))
      .sort((a, b) => a.number - b.number);

    res.setHeader("Cache-Control", "private, no-store");

    return res.status(200).json({ images });
  } catch (error) {
    console.error(
      "Drive image listing failed:",
      error.message
    );

    return res.status(500).json({
      error: "Unable to list Drive images.",
    });
  }
};
