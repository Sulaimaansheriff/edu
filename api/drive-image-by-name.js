const { google } = require("googleapis");

module.exports = async (req, res) => {
    try {
        const filename = String(req.query.filename || "");

        // Only allow filenames such as 1.png, 2.png, etc.
        if (!/^[1-9]\d*\.png$/i.test(filename)) {
            return res.status(400).send("Invalid filename");
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(
                    /\\n/g,
                    "\n"
                ),
                project_id: process.env.GOOGLE_PROJECT_ID
            },
            scopes: [
                "https://www.googleapis.com/auth/drive.readonly"
            ]
        });

        const drive = google.drive({
            version: "v3",
            auth
        });

        const folderId =
            "1GpTefSeAtcZ9bYkLNSgleHpRbX5DnYhP";

        const result = await drive.files.list({
            q: `'${folderId}' in parents and name = '${filename}' and trashed = false`,
            fields: "files(id,name,mimeType,parents)",
            pageSize: 10
        });

        const file = (result.data.files || []).find(item =>
            item.name === filename &&
            item.mimeType === "image/png" &&
            (item.parents || []).includes(folderId)
        );

        if (!file) {
            return res.status(404).send("Image not found");
        }

        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "private, no-store");

        const image = await drive.files.get(
            {
                fileId: file.id,
                alt: "media"
            },
            {
                responseType: "stream"
            }
        );

        image.data.on("error", error => {
            console.error("Drive image stream error:", error);
            if (!res.headersSent) {
                res.status(502).end("Could not load image");
            } else {
                res.destroy(error);
            }
        });

        image.data.pipe(res);
    } catch (error) {
        console.error("Image route error:", error);
        if (!res.headersSent) {
            res.status(500).send("Could not load image");
        }
    }
};
