# Projet_DevPourLeCloud

docker compose up -d
docker compose logs -f localstack
docker compose down
docker compose rm -f
docker compose up -d
docker compose logs -f localstack

tofu init
tofu apply -auto-approve

awslocal dynamodb list-tables

lancer server node :
node server.js




-----
docker-compose up 

cd .\infra\
tofu init
tofu apply -auto-approve

cd .\frontend\
npx serve


# Pour lancer l'appli

docker-compose up -d

awslocal s3 ls
awslocal dynamodb list-tables
awslocal lambda list-functions

## pour créer la table DynamoDB
awslocal dynamodb create-table --table-name users --attribute-definitions AttributeName=email,AttributeType=S --key-schema AttributeName=email,KeyType=HASH --billing-mode PAY_PER_REQUEST

## pour créer le bucket S3
awslocal s3 mb s3://userimages

## pour créer la queue SQS
awslocal sqs create-queue --queue-name thumbnail-queue

cd backend
npm install
node server.js

cd frontend
python -m http.server 8080

http://localhost:8080