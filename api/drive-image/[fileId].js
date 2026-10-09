const { google } = require("googleapis");

module.exports = async function handler(req, res) {
if (req.method !== "GET") {
return res.status(405).send("Method not allowed");
}

try {
const fileId = req.query.fileId;

```
if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
  return res.status(400).send("Invalid image ID");
}

const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const projectId = process.env.GOOGLE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  throw new Error("One or more Google credentials are missing");
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

const metadata = await drive.files.get({
  fileId: fileId,
  fields: "mimeType",
});

const mimeType = metadata.data.mimeType;

if (!mimeType || !mimeType.startsWith("image/")) {
  return res.status(400).send("The requested file is not an image");
}

const imageResponse = await drive.files.get(
  {
    fileId: fileId,
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
    res.status(500).end("Unable to load image");
  } else {
    res.destroy(error);
  }
});

imageResponse.data.pipe(res);
```

} catch (error) {
console.error("Google Drive image error:", error.message);
console.error(error.stack);

```
if (!res.headersSent) {
  res.status(500).send("Unable to load image");
} else {
  res.destroy(error);
}
```

}
};
