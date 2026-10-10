
const crypto = require("crypto");
const { google } = require("googleapis");

const FOLDER_ID = "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";
const LINK_LIFETIME_SECONDS = 3;

function createSignature(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const fileId = String(req.query.fileId || "");

  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).send("Invalid image ID");
  }

  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const projectId = process.env.GOOGLE_PROJECT_ID;
  const signingSecret = process.env.IMAGE_SIGNING_SECRET;

  if (!privateKey || !clientEmail || !projectId || !signingSecret) {
    return res.status(500).send("Server configuration error");
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    // Confirm the requested file is an image inside the approved folder.
    const result = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,parents,trashed",
      supportsAllDrives: true,
    });

    const file = result.data;
    const isInFolder = (file.parents || []).includes(FOLDER_ID);

    if (
      file.trashed ||
      !isInFolder ||
      !file.mimeType ||
      !file.mimeType.startsWith("image/")
    ) {
      return res.status(404).send("Image not found");
    }

    const expires =
      Math.floor(Date.now() / 1000) + LINK_LIFETIME_SECONDS;

    const payload = `${fileId}.${expires}`;
    const signature = createSignature(payload, signingSecret);

    return res.status(200).json({
      url: `/api/drive-image/${encodeURIComponent(fileId)}?expires=${expires}&signature=${signature}`,
      expires,
    });
  } catch (error) {
    console.error("Temporary image link error:", error.message);
    return res.status(500).send("Unable to create temporary image link");
  }
};
