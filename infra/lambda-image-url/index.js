const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://host.docker.internal:4566",
    forcePathStyle: true
});

exports.handler = async (event) => {
    try {
        const key = event.pathParameters.key;

        if (!key) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing image key" })
            };
        }

        const command = new GetObjectCommand({
            Bucket: process.env.BUCKET,
            Key: key
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

        return {
            statusCode: 200,
            body: JSON.stringify({ url })
        };
    } catch (err) {
        console.error("PRESIGN ERROR:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
