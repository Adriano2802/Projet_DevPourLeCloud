# Projet_DevPourLeCloud

docker compose up -d
docker compose logs -f localstack
docker compose down
docker compose rm -f
docker compose up -d
docker compose logs -f localstack

tofu init
tofu apply -auto-approve

aws --endpoint-url=http://localhost:4566 s3 ls 

lancer server node :
node server.js

docker exec -it localstack awslocal dynamodb create-table --table-name users --attribute-definitions AttributeName=email,AttributeType=S --key-schema AttributeName=email,KeyType=HASH --billing-mode PAY_PER_REQUEST
