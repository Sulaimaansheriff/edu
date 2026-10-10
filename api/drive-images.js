
const { google } = require("googleapis");

const FOLDER_ID = "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (!privateKey || !clientEmail || !projectId) {
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
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    const result = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id,name,mimeType)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const images = (result.data.files || [])
      .filter((file) => {
        const match = file.name.match(
          /^(\d+)\.(png|jpe?g|webp|gif)$/i
        );
        return match && file.mimeType?.startsWith("image/");
      })
      .map((file) => ({
        id: file.id,
        name: file.name,
        number: Number(file.name.match(/^(\d+)/)[1]),
      }))
      .sort((a, b) => a.number - b.number);

    return res.status(200).json({ images });
  } catch (error) {
    console.error("Drive image listing failed:", error.message);

    return res.status(500).json({
      error: "Unable to list Drive images",
    });
  }
};
