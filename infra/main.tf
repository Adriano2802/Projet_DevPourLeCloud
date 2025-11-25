terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 5.40.0"
    }
  }
}

#########################################################
# PROVIDER LOCALSTACK
#########################################################
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  skip_region_validation      = true

  endpoints {
    s3         = "http://localhost:4566"
    lambda     = "http://localhost:4566"
    apigateway = "http://localhost:4566"
    iam        = "http://localhost:4566"
    sqs        = "http://localhost:4566"
    dynamodb   = "http://localhost:4566"
    cloudwatch = "http://localhost:4566"
    logs       = "http://localhost:4566"
    sts        = "http://localhost:4566"
  }

  # ⚠️ Important pour LocalStack : forcer path style
  s3_use_path_style = true
}



#########################################################
# DYNAMODB TABLE
#########################################################
resource "aws_dynamodb_table" "users" {
  name         = "users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }
}

#########################################################
# SQS QUEUE
#########################################################
resource "aws_sqs_queue" "thumbnail_queue" {
  name = "thumbnail-queue"
}

#########################################################
# S3 BUCKET FOR IMAGES
#########################################################
resource "aws_s3_bucket" "images" {
  bucket        = "userimages"
  force_destroy = true
}



#########################################################
# IAM ROLE FOR LAMBDA
#########################################################
resource "aws_iam_role" "lambda_exec_role" {
  name = "lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_logs_policy" {
  name = "lambda_logs_policy"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Effect   = "Allow"
      Resource = "*"
    }]
  })
}

#########################################################
# LAMBDA FUNCTIONS
#########################################################
resource "aws_lambda_function" "register_function" {
  function_name = "register-function"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/lambda-register.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-register.zip")

  environment {
    variables = {
      DYNAMO_ENDPOINT = "http://host.docker.internal:4566"
      JWT_SECRET      = "dev-secret"
    }
  }
}

resource "aws_lambda_function" "login_function" {
  function_name = "login-function"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/lambda-login.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-login.zip")

  environment {
    variables = {
      DYNAMO_ENDPOINT = "http://host.docker.internal:4566"
      JWT_SECRET      = "dev-secret"
    }
  }
}

resource "aws_lambda_function" "thumbnail_function" {
  function_name = "thumbnail-function"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/lambda-thumbnail.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-thumbnail.zip")
}

#########################################################
# API GATEWAY
#########################################################
resource "aws_api_gateway_rest_api" "api" {
  name = "thumbnail_api"
}

resource "aws_api_gateway_resource" "register" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "register"
}

resource "aws_api_gateway_resource" "login" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "login"
}

resource "aws_api_gateway_resource" "thumbnail" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "thumbnail"
}

resource "aws_api_gateway_method" "post_register" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.register.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "post_login" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.login.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "get_thumbnail" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.thumbnail.id
  http_method   = "GET"
  authorization = "NONE"
}

#########################################################
# INTEGRATIONS
#########################################################
resource "aws_api_gateway_integration" "register_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.register.id
  http_method             = aws_api_gateway_method.post_register.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.register_function.invoke_arn
}

resource "aws_api_gateway_integration" "login_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.login.id
  http_method             = aws_api_gateway_method.post_login.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.login_function.invoke_arn
}

resource "aws_api_gateway_integration" "thumbnail_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.thumbnail.id
  http_method             = aws_api_gateway_method.get_thumbnail.http_method
  integration_http_method = "GET"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.thumbnail_function.invoke_arn
}

#########################################################
# PERMISSIONS API GW -> LAMBDA
#########################################################
resource "aws_lambda_permission" "register_permission" {
  statement_id  = "AllowRegisterInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.register_function.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_permission" "login_permission" {
  statement_id  = "AllowLoginInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.login_function.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_permission" "thumbnail_permission" {
  statement_id  = "AllowThumbnailInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumbnail_function.function_name
  principal     = "apigateway.amazonaws.com"
}

#########################################################
# DEPLOYMENT
#########################################################
resource "aws_api_gateway_deployment" "deployment" {
  depends_on = [
    aws_api_gateway_integration.register_integration,
    aws_api_gateway_integration.login_integration,
    aws_api_gateway_integration.thumbnail_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = "dev"
}

#########################################################
# OUTPUTS
#########################################################
output "api_url" {
  value = "${aws_api_gateway_rest_api.api.execution_arn}/dev"
}
