# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### n8n Workflow Management
```bash
# Start n8n instance (required for all workflow operations)
npx n8n start

# Access n8n editor at http://localhost:5678
```

### Workflow Testing and Reload Process
```bash
# After making changes to pii-sanitization-workflow.json, reload into n8n:

# 1. Import/update the workflow
npx n8n import:workflow --input=pii-sanitization-workflow.json

# 2. Activate the workflow to enable webhooks
npx n8n update:workflow --id=1 --active=true

# 3. Test the updated workflow - run all tests
npx tsx test-runner.ts

# 4. Test specific scenarios if needed
npx tsx test-runner.ts testdata/basic-multi-person.yaml
```

### Testing
```bash
# Run all tests (production endpoint - default)
npx tsx test-runner.ts

# Run all tests against test webhook endpoint
npx tsx test-runner.ts --test

# Test specific scenarios (production endpoint)
npx tsx test-runner.ts testdata/basic-pii.yaml

# Test specific scenarios against test endpoint
npx tsx test-runner.ts --test testdata/basic-pii.yaml
```

## Architecture Overview

This is an n8n-based agentic workflow for PII (Personally Identifiable Information) detection and tokenization. The system demonstrates production-ready AI workflows that automatically detect and sanitize sensitive data before processing.

### Core Workflow Components

1. **Webhook Trigger** (`n8n-nodes-base.webhook`)
   - Receives POST requests at `/webhook/chat` (production) or `/webhook-test/chat` (test)
   - Accepts JSON payload with `message` field

2. **LangChain OpenAI Node** (`@n8n/n8n-nodes-langchain.openAi`)
   - Uses GPT-5 model with temperature 0.1
   - Processes person-centric PII detection with structured JSON output
   - Assigns sequential Person IDs (Person1, Person2, etc.)
   - Requires OpenAI API credentials configuration

3. **Code Node** (`n8n-nodes-base.code`)
   - Parses AI response and generates person objects with structured schema
   - Creates unique session IDs for PII mapping tracking
   - Maintains backward compatibility with legacy token format
   - Handles error scenarios with graceful fallback

4. **Response Node** (`n8n-nodes-base.respondToWebhook`)
   - Returns structured JSON with person schema, token mappings, and PII mappings
   - Includes session ID, timestamp, and original input

### Data Flow Architecture

```
Webhook Input → AI Person Detection → Person Processing → JSON Response
     ↓              ↓                     ↓                 ↓
[raw text]  → [detect & assign IDs] → [build persons] → [sanitized + persons]
```

### Person-Centric Token Patterns

The system uses a person-centric approach, organizing all PII under person identities:
- Names: `[Person1]`, `[Person2]`, etc.
- Email addresses: `[Person1:email1]`, `[Person1:email2]`, `[Person2:email1]`, etc.
- Physical addresses: `[Person1:address1]`, `[Person1:address2]`, etc.
- Phone numbers: `[Person1:phone1]`, `[Person1:phone2]`, etc.
- SSN/ID numbers: `[Person1:id1]`, `[Person1:id2]`, etc.

Each person gets a structured object with:
- `primary_name`: Main name identifier
- `aliases`: Alternative names
- `emails`: Array of email addresses
- `phones`: Array of phone numbers
- `addresses`: Array of physical addresses
- `relationships`: Connections to other persons
- `metadata`: Confidence scores, timestamps, session tracking

## Workflow Configuration

### Required Setup
1. Import `pii-sanitization-workflow.json` into n8n
2. Configure OpenAI API credentials in the LangChain node
3. Activate the workflow in n8n
4. Ensure webhook endpoint is accessible

### API Endpoints
- Production URL: `http://localhost:5678/webhook/chat`
- Test URL: `http://localhost:5678/webhook-test/chat`
- Method: POST
- Content-Type: application/json
- Payload: `{"message": "text containing PII"}`

## Development Notes

- The workflow uses n8n's visual workflow builder - no traditional build/lint commands
- All logic is contained within the n8n workflow nodes
- Testing requires the n8n instance to be running and workflow activated
- Person objects are generated per session with foundation for cross-session persistence
- Includes both person schema and backward-compatible PII mapping
- Error handling preserves original input and provides debugging information
- AI model may show inconsistent behavior between runs due to temperature and non-deterministic nature

## Documentation Standards

**README.md Policy:**
- README.md should ONLY contain the current state of the project
- NO "Next Steps", "Future Work", or "TODO" sections in README.md
- All future work and planning goes in TODO.md
- README.md focuses on: setup, usage, current features, architecture, testing

**TODO.md Usage:**
- All next steps, future enhancements, and planned work goes in TODO.md
- Organize by priority: Immediate, Advanced, Production Readiness, etc.
- Use checkbox format for tracking progress
- Update TODO.md as features are completed or priorities change