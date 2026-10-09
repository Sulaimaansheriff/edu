
const { google } = require("googleapis");

const FOLDER_ID = "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    const result = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const images = (result.data.files || [])
      .filter((file) => {
        const match = file.name.match(/^(\d+)\.(png|jpe?g|webp)$/i);
        return match && file.mimeType.startsWith("image/");
      })
      .map((file) => ({
        name: file.name,
        number: Number(file.name.match(/^(\d+)/)[1]),
        url: `/api/drive-image/${file.id}`,
      }))
      .sort((a, b) => a.number - b.number);

    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json({ images });
  } catch (error) {
    console.error("Drive image listing failed:", error.message);
    return res.status(500).json({
      error: "Unable to list Drive images. Check API credentials and folder access.",
    });
  }
};
