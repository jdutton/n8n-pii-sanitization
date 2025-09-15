# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### n8n Workflow Management
```bash
# Start n8n instance (required for all workflow operations)
npx n8n start

# Access n8n editor at http://localhost:5678
```

### Testing
```bash
# Test the PII sanitization workflow (requires n8n to be running and workflow activated)
./test-pii.sh
```

## Architecture Overview

This is an n8n-based agentic workflow for PII (Personally Identifiable Information) detection and tokenization. The system demonstrates production-ready AI workflows that automatically detect and sanitize sensitive data before processing.

### Core Workflow Components

1. **Webhook Trigger** (`n8n-nodes-base.webhook`)
   - Receives POST requests at `/webhook-test/chat`
   - Accepts JSON payload with `message` field

2. **LangChain OpenAI Node** (`@n8n/n8n-nodes-langchain.openAi`)
   - Uses GPT-5-nano model with temperature 0.1
   - Processes PII detection with structured JSON output
   - Requires OpenAI API credentials configuration

3. **Code Node** (`n8n-nodes-base.code`)
   - Parses AI response and generates session data
   - Creates unique session IDs for PII mapping tracking
   - Handles error scenarios with graceful fallback

4. **Response Node** (`n8n-nodes-base.respondToWebhook`)
   - Returns structured JSON with sanitized text and PII mappings
   - Includes session ID, timestamp, and original input

### Data Flow Architecture

```
Webhook Input → AI PII Detection → Data Processing → JSON Response
     ↓              ↓                  ↓              ↓
[raw text]  → [detect & tokenize] → [store mapping] → [sanitized + mapping]
```

### PII Token Patterns

The system replaces detected PII with standardized tokens:
- Names: `[Person1]`, `[Person2]`, etc.
- Email addresses: `[Email1]`, `[Email2]`, etc.
- Physical addresses: `[Address1]`, `[Address2]`, etc.
- Phone numbers: `[Phone1]`, `[Phone2]`, etc.
- SSN/ID numbers: `[ID1]`, `[ID2]`, etc.

## Workflow Configuration

### Required Setup
1. Import `pii-sanitization-workflow.json` into n8n
2. Configure OpenAI API credentials in the LangChain node
3. Activate the workflow in n8n
4. Ensure webhook endpoint is accessible

### API Endpoint
- URL: `http://localhost:5678/webhook-test/chat`
- Method: POST
- Content-Type: application/json
- Payload: `{"message": "text containing PII"}`

## Development Notes

- The workflow uses n8n's visual workflow builder - no traditional build/lint commands
- All logic is contained within the n8n workflow nodes
- Testing requires the n8n instance to be running and workflow activated
- PII mappings are generated per session but not persisted beyond the response
- Error handling preserves original input and provides debugging information