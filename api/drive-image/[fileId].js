const { google } = require("googleapis");

module.exports = async (req, res) => {
try {
const fileId = req.query.fileId;

```
if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
  return res.status(400).send("Invalid image ID");
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

const metadata = await drive.files.get({
  fileId,
  fields: "mimeType",
});

const mimeType = metadata.data.mimeType;

if (!mimeType || !mimeType.startsWith("image/")) {
  return res.status(400).send("The requested file is not an image");
}

const image = await drive.files.get(
  { fileId, alt: "media" },
  { responseType: "stream" }
);

res.setHeader("Content-Type", mimeType);
res.setHeader("Cache-Control", "public, max-age=3600");

image.data.on("error", (error) => {
  console.error("Image stream error:", error);
  if (!res.headersSent) {
    res.status(500).end("Unable to load image");
  } else {
    res.end();
  }
});

image.data.pipe(res);
```

} catch (error) {
console.error("Google Drive image error:", error.message);
if (!res.headersSent) {
res.status(500).send("Unable to load image");
}
}
};
