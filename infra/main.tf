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

  s3_use_path_style = true
}

#########################################################
# DYNAMODB USERS TABLE
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
# SQS THUMBNAIL QUEUE
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

#########################################################
# IAM POLICIES (Logs + DynamoDB + S3 + SQS)
#########################################################

# CloudWatch logs
resource "aws_iam_role_policy" "lambda_logs_policy" {
  name = "lambda_logs_policy"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action   = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "*"
    }]
  })
}

# S3 + SQS + DynamoDB access
resource "aws_iam_role_policy" "lambda_full_access" {
  name = "lambda_full_access"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.thumbnail_queue.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.users.arn
      }
    ]
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

resource "aws_lambda_function" "upload_function" {
  function_name = "upload-function"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/lambda-upload.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-upload.zip")

  environment {
    variables = {
      BUCKET    = "userimages"
      QUEUE_URL = aws_sqs_queue.thumbnail_queue.url
    }
  }
}

resource "aws_lambda_function" "list_images_function" {
  function_name = "list-images-function"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/lambda-images.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-images.zip")

  environment {
    variables = {
      BUCKET = "userimages"
    }
  }
}

resource "aws_lambda_function" "presign_url_function" {
  function_name = "presign-url-function"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/lambda-image-url.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-image-url.zip")

  environment {
    variables = {
      BUCKET = "userimages"
    }
  }
}

#########################################################
# API GATEWAY
#########################################################

resource "aws_api_gateway_rest_api" "api" {
  name = "thumbnail_api"
}

# REGISTER
resource "aws_api_gateway_resource" "register" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "register"
}

resource "aws_api_gateway_method" "post_register" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.register.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "register_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.register.id
  http_method             = aws_api_gateway_method.post_register.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.register_function.invoke_arn
}

# LOGIN
resource "aws_api_gateway_resource" "login" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "login"
}

resource "aws_api_gateway_method" "post_login" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.login.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "login_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.login.id
  http_method             = aws_api_gateway_method.post_login.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.login_function.invoke_arn
}

# UPLOAD
resource "aws_api_gateway_resource" "upload" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "upload"
}

resource "aws_api_gateway_method" "post_upload" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.upload.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "upload_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.upload.id
  http_method             = aws_api_gateway_method.post_upload.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.upload_function.invoke_arn
}

# LIST IMAGES
resource "aws_api_gateway_resource" "images" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "images"
}

resource "aws_api_gateway_method" "get_images" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.images.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "images_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.images.id
  http_method             = aws_api_gateway_method.get_images.http_method
  integration_http_method = "GET"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.list_images_function.invoke_arn
}

# PRESIGNED URL
resource "aws_api_gateway_resource" "image_url" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "image-url"
}

resource "aws_api_gateway_resource" "image_url_key" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.image_url.id
  path_part   = "{key}"
}

resource "aws_api_gateway_method" "get_image_url" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.image_url_key.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "imgurl_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.image_url_key.id
  http_method             = aws_api_gateway_method.get_image_url.http_method
  integration_http_method = "GET"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.presign_url_function.invoke_arn
}

#########################################################
# PERMISSIONS API Gateway → Lambda
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

resource "aws_lambda_permission" "upload_permission" {
  statement_id  = "AllowUploadInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload_function.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_permission" "images_permission" {
  statement_id  = "AllowImagesInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list_images_function.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_permission" "presign_permission" {
  statement_id  = "AllowPresignInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.presign_url_function.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_permission" "thumbnail_permission" {
  statement_id  = "AllowThumbnailInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumbnail_function.function_name
  principal     = "apigateway.amazonaws.com"
}

#########################################################
# SQS → LAMBDA (THUMBNAIL WORKER)
#########################################################

resource "aws_lambda_event_source_mapping" "thumbnail_mapping" {
  event_source_arn = aws_sqs_queue.thumbnail_queue.arn
  function_name    = aws_lambda_function.thumbnail_function.arn
  batch_size       = 1
}

#########################################################
# DEPLOYMENT
#########################################################

resource "aws_api_gateway_deployment" "deployment" {
  depends_on = [
    aws_api_gateway_integration.register_integration,
    aws_api_gateway_integration.login_integration,
    aws_api_gateway_integration.upload_integration,
    aws_api_gateway_integration.images_integration,
    aws_api_gateway_integration.imgurl_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = "dev"
}

#########################################################
# OUTPUTS
#########################################################

output "api_base_url" {
  value = "http://localhost:4566/restapis/${aws_api_gateway_rest_api.api.id}/dev/_user_request_/"
}
