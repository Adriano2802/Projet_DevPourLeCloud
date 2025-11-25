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


awslocal lambda create-function --function-name upload-function --runtime nodejs18.x --handler index.handler --zip-file fileb://infra/lambda-upload.zip --role arn:aws:iam::000000000000:role/lambda-role

awslocal dynamodb create-table --table-name users --attribute-definitions AttributeName=email,AttributeType=S --key-schema AttributeName=email,KeyType=HASH --billing-mode PAY_PER_REQUEST
