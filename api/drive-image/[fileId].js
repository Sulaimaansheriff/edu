const { google } = require("googleapis");

module.exports = async (req, res) => {
try {
const fileId = req.query.fileId;

```
if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
  return res.status(400).send("Invalid image ID");
}

const privateKey = process.env.GOOGLE_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("GOOGLE_PRIVATE_KEY is missing");
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: privateKey.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({
  version: "v3",
  auth,
});

const metadata = await drive.files.get({
  fileId,
  fields: "mimeType",
});

const mimeType = metadata.data.mimeType;

if (!mimeType || !mimeType.startsWith("image/")) {
  return res.status(400).send("The requested file is not an image");
}

const imageResponse = await drive.files.get(
  {
    fileId,
    alt: "media",
  },
  {
    responseType: "stream",
  }
);

res.setHeader("Content-Type", mimeType);
res.setHeader("Cache-Control", "public, max-age=3600");

imageResponse.data.on("error", (error) => {
  console.error("Google Drive image stream error:", error.message);
  if (!res.headersSent) {
    res.status(500).send("Unable to load image");
  } else {
    res.end();
  }
});

imageResponse.data.pipe(res);
```

} catch (error) {
console.error(
"Google Drive image error:",
error.message,
error.stack
);

```
if (!res.headersSent) {
  res.status(500).send("Unable to load image");
}
```

}
};
