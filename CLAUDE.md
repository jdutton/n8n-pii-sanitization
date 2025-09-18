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

# Test multi-turn conversation scenarios
npx tsx test-runner.ts testdata/chat-conversation.yaml
```

#### Test Types
- **Single-request tests**: Basic PII detection and tokenization (e.g., `basic-pii.yaml`)
- **Conversation tests**: Multi-turn chat with session continuity (e.g., `chat-conversation.yaml`)
- **Person schema tests**: Validation of person-centric data structure (e.g., `person-schema-validation.yaml`)

The test runner automatically detects conversation tests by the presence of `conversation_turns` in the test file and handles session management across multiple turns.

## Architecture Overview

This is an n8n-based agentic workflow for conversational chat with PII (Personally Identifiable Information) protection. The system provides dual capabilities: natural conversation AND automatic PII detection/tokenization across multi-turn conversations with memory-based session management.

### Core Workflow Components

1. **Webhook Trigger** (`n8n-nodes-base.webhook`)
   - Receives POST requests at `/webhook/chat` (production) or `/webhook-test/chat` (test)
   - Accepts JSON payload with `message` field and optional `session_id` for conversation continuity

2. **Session Manager Node** (`n8n-nodes-base.code`)
   - Manages conversation history using global.conversations memory storage
   - Retrieves existing conversation context and person data
   - Builds conversation history for AI context (last 10 messages)
   - Generates session IDs for new conversations

3. **LangChain OpenAI Node** (`@n8n/n8n-nodes-langchain.openAi`)
   - Uses GPT-5 model with temperature 0.1 for dual-purpose processing
   - Provides natural conversational responses using person tokens
   - Simultaneously detects and tokenizes PII in user messages
   - Maintains conversation context across turns
   - Requires OpenAI API credentials configuration

4. **Process PII Data Node** (`n8n-nodes-base.code`)
   - Parses AI response containing both chat response and PII analysis
   - Merges new person data with existing conversation persons
   - Updates conversation history with sanitized messages
   - Manages session memory with automatic cleanup (keeps last 100 sessions)
   - Creates legacy PII mappings for backward compatibility

5. **Response Node** (`n8n-nodes-base.respondToWebhook`)
   - Returns structured JSON with chat response, person data, and conversation metadata
   - Includes conversation turn number, session ID, timestamp, and PII mappings

### Data Flow Architecture

```
Webhook Input → Session Lookup → AI Chat+PII → Memory Update → JSON Response
     ↓             ↓              ↓              ↓             ↓
[user message] → [get history] → [chat+detect] → [store data] → [chat+sanitized]
     ↓             ↓              ↓              ↓             ↓
[session_id]   → [persons]    → [tokens]     → [persist]   → [conversation_turn]
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

#### Request Payloads
```json
// New conversation
{
  "message": "Hi, I'm John Smith and I need help with my account"
}

// Continue existing conversation
{
  "message": "I also need to update my phone number",
  "session_id": "chat_1726610234567_abcd1234"
}
```

#### Response Format
```json
{
  "status": "success",
  "session_id": "chat_1726610234567_abcd1234",
  "chat_response": "Hello [Person1]! I'd be happy to help you with your account.",
  "conversation_turn": 1,
  "conversation_length": 2,
  "sanitized_text": "Hi, I'm [Person1] and I need help with my account",
  "persons": {
    "Person1": {
      "primary_name": "John Smith",
      "emails": [],
      "phones": [],
      "addresses": [],
      "aliases": [],
      "relationships": {},
      "metadata": {
        "confidence_score": 0.95,
        "first_seen": "2024-09-16T22:00:00.000Z",
        "session_count": 1
      }
    }
  },
  "token_map": {
    "[Person1]": "primary_name"
  },
  "pii_mapping": {
    "[Person1]": "John Smith"
  },
  "original_input": "Hi, I'm John Smith and I need help with my account",
  "timestamp": "2024-09-16T22:00:00.000Z"
}
```

## Development Notes

- The workflow uses n8n's visual workflow builder - no traditional build/lint commands
- All logic is contained within the n8n workflow nodes
- Testing requires the n8n instance to be running and workflow activated
- **Memory-based session storage**: Conversations stored in global.conversations (POC phase)
- **Session management**: Automatic cleanup keeps last 100 active sessions
- **Dual-purpose AI**: Single model handles both natural conversation and PII detection
- **Person persistence**: Person objects accumulate data across conversation turns
- **Conversation context**: Last 10 messages included in AI context for continuity
- **Backward compatibility**: Maintains legacy PII mapping format alongside new person schema
- **Error handling**: Preserves original input and provides debugging information
- **Testing capabilities**: Supports both single-request and multi-turn conversation testing
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