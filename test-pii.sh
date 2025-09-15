#!/bin/bash

# Test script for PII sanitization workflow
# Make sure to activate the workflow in n8n first!

echo "Testing PII Sanitization Workflow..."
echo "=================================="

curl -X POST http://localhost:5678/webhook-test/chat -v \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, I am John Smith, my email is john.smith@company.com and I live at 123 Main Street, New York, NY 10001. My phone is 555-123-4567 and my SSN is 123-45-6789."
  }' | jq '.'

echo ""
echo "=================================="
echo "Make sure the workflow is ACTIVE in n8n!"
