const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://host.docker.internal:4566",
    forcePathStyle: true
});

exports.handler = async (event) => {
    for (const record of event.Records) {
        try {
            const { bucket, key } = JSON.parse(record.body);

            // Récupération de l'image originale
            const original = await s3.send(new GetObjectCommand({
                Bucket: bucket,
                Key: key
            }));
            const chunks = [];
            for await (let chunk of original.Body) chunks.push(chunk);
            const imageBuffer = Buffer.concat(chunks);

            // Génération du thumbnail
            const thumbnailBuffer = await sharp(imageBuffer)
                .resize(150, 150)
                .toBuffer();

            // Upload thumbnail
            const thumbKey = key.replace(/\/([^\/]+)$/, "/thumbnail_$1");
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: thumbKey,
                Body: thumbnailBuffer,
                ContentType: "image/jpeg"
            }));

            console.log(`Thumbnail généré pour ${key} -> ${thumbKey}`);
        } catch (err) {
            console.error("THUMBNAIL ERROR:", err);
        }
    }
};
