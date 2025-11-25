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

3pwl4hanxn

http://localhost:4566/restapis/3pwl4hanxn/dev/_user_request_/register


curl -X POST http://localhost:4566/restapis/3pwl4hanxn/dev/_user_request_/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"secret"}'
