const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { v4: uuidv4 } = require("uuid");

const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://host.docker.internal:4566",
    forcePathStyle: true
});

const sqs = new SQSClient({
    region: "us-east-1",
    endpoint: "http://host.docker.internal:4566"
});

exports.handler = async (event) => {
    try {
        const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        const { filename, content, userId } = body;

        if (!filename || !content || !userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "filename + content + userId required" })
            };
        }

        const uniqueFilename = `${uuidv4()}-${filename}`;

        // ❌ Mauvais : userimages/userID/file
        // const key = `userimages/${userId}/${uniqueFilename}`;

        // ✅ Correct :
        const key = `${userId}/${uniqueFilename}`;

        const buffer = Buffer.from(content, "base64");

        // Upload vers S3
        await s3.send(new PutObjectCommand({
            Bucket: process.env.BUCKET,
            Key: key,
            Body: buffer,
            ContentType: "image/jpeg"
        }));

        // Envoi du message à SQS
        await sqs.send(new SendMessageCommand({
            QueueUrl: process.env.QUEUE_URL,
            MessageBody: JSON.stringify({ bucket: process.env.BUCKET, key })
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Uploaded!", key })
        };
    } catch (err) {
        console.error("UPLOAD ERROR:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
