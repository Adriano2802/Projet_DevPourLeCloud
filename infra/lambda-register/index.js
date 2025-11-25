const {
    DynamoDBClient,
    PutItemCommand
} = require("@aws-sdk/client-dynamodb");

const bcrypt = require("bcryptjs");

const dynamodb = new DynamoDBClient({
    endpoint: process.env.DYNAMO_ENDPOINT,
    region: "us-east-1"
});

exports.handler = async (event) => {

    const body = JSON.parse(event.body || "{}");
    const { email, password } = body;

    if (!email || !password) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Email et mot de passe requis." })
        };
    }

    try {
        const hashed = await bcrypt.hash(password, 10);

        await dynamodb.send(
            new PutItemCommand({
                TableName: "users",
                Item: {
                    email: { S: email },
                    password: { S: hashed }
                }
            })
        );

        return {
            statusCode: 201,
            body: JSON.stringify({ message: "Utilisateur créé." })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Erreur serveur", details: err.message })
        };
    }
};
