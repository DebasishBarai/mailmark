#!/bin/bash
#
# Deploy the SES S3 handler Lambda function.
#
# Prerequisites:
#   - AWS CLI configured with credentials
#   - Lambda execution role ARN (see setup instructions below)
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# ──────────────────────────────────────────────────────────────
# FIRST-TIME SETUP (do these once in AWS Console or CLI):
#
# 1. Create IAM role for Lambda:
#
#    aws iam create-role \
#      --role-name devmail-ses-lambda-role \
#      --assume-role-policy-document '{
#        "Version": "2012-10-17",
#        "Statement": [{
#          "Effect": "Allow",
#          "Principal": {"Service": "lambda.amazonaws.com"},
#          "Action": "sts:AssumeRole"
#        }]
#      }'
#
# 2. Attach policies (S3 read/write + CloudWatch logs):
#
#    aws iam attach-role-policy \
#      --role-name devmail-ses-lambda-role \
#      --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
#
#    aws iam attach-role-policy \
#      --role-name devmail-ses-lambda-role \
#      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
#
# 3. After creating the Lambda (first deploy), add S3 trigger:
#
#    aws s3api put-bucket-notification-configuration \
#      --bucket devmail-emails \
#      --notification-configuration '{
#        "LambdaFunctionConfigurations": [{
#          "LambdaFunctionArn": "arn:aws:lambda:ap-south-1:989774662403:function:devmail-ses-s3-handler",
#          "Events": ["s3:ObjectCreated:*"],
#          "Filter": {
#            "Key": {
#              "FilterRules": [{
#                "Name": "suffix",
#                "Value": ""
#              }]
#            }
#          }
#        }]
#      }'
#
# 4. Allow S3 to invoke the Lambda:
#
#    aws lambda add-permission \
#      --function-name devmail-ses-s3-handler \
#      --statement-id s3-trigger \
#      --action lambda:InvokeFunction \
#      --principal s3.amazonaws.com \
#      --source-arn arn:aws:s3:::devmail-emails
#
# ──────────────────────────────────────────────────────────────

set -e

FUNCTION_NAME="devmail-ses-s3-handler"
REGION="ap-south-1"
# Replace with your actual role ARN after step 1
ROLE_ARN="arn:aws:iam::989774662403:role/devmail-ses-lambda-role"

# ── Set these to your actual values ──
CONVEX_SITE_URL="https://rugged-bulldog-579.convex.site"
WEBHOOK_SECRET="aws-ses"
S3_BUCKET="devmail-emails"

echo "📦 Packaging Lambda..."
cd "$(dirname "$0")"
zip -j lambda.zip ses-s3-handler.mjs

# Check if function exists
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null; then
  echo "🔄 Updating existing Lambda function..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://lambda.zip \
    --region "$REGION"

  # Wait for update to complete
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={CONVEX_SITE_URL=$CONVEX_SITE_URL,WEBHOOK_SECRET=$WEBHOOK_SECRET,S3_BUCKET=$S3_BUCKET}" \
    --region "$REGION"
else
  echo "🆕 Creating new Lambda function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --handler ses-s3-handler.handler \
    --role "$ROLE_ARN" \
    --zip-file fileb://lambda.zip \
    --timeout 30 \
    --memory-size 256 \
    --environment "Variables={CONVEX_SITE_URL=$CONVEX_SITE_URL,WEBHOOK_SECRET=$WEBHOOK_SECRET,S3_BUCKET=$S3_BUCKET}" \
    --region "$REGION"
fi

rm lambda.zip
echo "✅ Done! Lambda '$FUNCTION_NAME' deployed to $REGION"
