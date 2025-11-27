const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://host.docker.internal:4566",
    forcePathStyle: true
});

exports.handler = async () => {
    try {
        const res = await s3.send(
            new ListObjectsV2Command({
                Bucket: process.env.BUCKET
            })
        );

        const files = (res.Contents || []).map((o) => o.Key);

        return {
            statusCode: 200,
            body: JSON.stringify(files)
        };
    } catch (err) {
        console.error("LIST ERROR:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
