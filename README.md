# n8n PII Sanitization Workflow

An experimental project exploring agentic workflows using n8n for automated PII (Personally Identifiable Information) detection and tokenization.

## Overview

This project demonstrates how to build production-ready AI workflows that automatically detect and sanitize sensitive data before processing. The workflow replaces PII with reversible tokens while maintaining a secure mapping for data restoration.

## Architecture

```
Webhook Input → AI PII Detection → Data Processing → JSON Response
     ↓              ↓                  ↓              ↓
[raw text]  → [detect & tokenize] → [store mapping] → [sanitized + mapping]
```

## Workflow Components

1. **Webhook Trigger** - Receives POST requests with message data
2. **LangChain OpenAI Node** - Uses GPT-5 for PII detection and tokenization
3. **Code Node** - Processes AI response and generates session mapping
4. **Response Node** - Returns structured JSON with sanitized text and PII mapping

## PII Detection Capabilities

The AI model detects and tokenizes PII using person-centric identifiers:
- **Names**: `[Person1]`, `[Person2]`, etc.
- **Email addresses**: `[Person1:email1]`, `[Person2:email1]`, etc.
- **Physical addresses**: `[Person1:address1]`, `[Person1:address2]`, etc.
- **Phone numbers**: `[Person1:phone1]`, `[Person1:phone2]`, etc.
- **SSN/ID numbers**: `[Person1:id1]`, `[Person1:id2]`, etc.

Each person gets a sequential identifier (Person1, Person2) with their PII organized in a structured person object including metadata, relationships, and confidence scores.

## API Usage

### Request
```bash
curl -X POST http://localhost:5678/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, I am John Smith, my email is john.smith@company.com and I live at 123 Main Street, New York, NY 10001. My phone is 555-123-4567."
  }'
```

### Response
```json
{
  "status": "success",
  "sanitized_text": "Hi, I am [Person1], my email is [Person1:email1] and I live at [Person1:address1]. My phone is [Person1:phone1].",
  "session_id": "1_1758062819430",
  "persons": {
    "Person1": {
      "primary_name": "John Smith",
      "aliases": [],
      "emails": ["john.smith@company.com"],
      "phones": ["555-123-4567"],
      "addresses": ["123 Main Street, New York, NY 10001"],
      "relationships": {},
      "metadata": {
        "confidence_score": 0.95,
        "first_seen": "2025-09-16T22:00:00.000Z",
        "last_seen": "2025-09-16T22:00:00.000Z",
        "session_count": 1
      }
    }
  },
  "token_map": {
    "[Person1]": "primary_name",
    "[Person1:email1]": "emails[0]",
    "[Person1:phone1]": "phones[0]",
    "[Person1:address1]": "addresses[0]"
  },
  "pii_mapping": {
    "[Person1]": "John Smith",
    "[Person1:email1]": "john.smith@company.com",
    "[Person1:phone1]": "555-123-4567",
    "[Person1:address1]": "123 Main Street, New York, NY 10001"
  },
  "original_input": "Hi, I am John Smith, my email is john.smith@company.com and I live at 123 Main Street, New York, NY 10001. My phone is 555-123-4567.",
  "timestamp": "2025-09-16T22:46:59.430Z"
}
```

## Setup Instructions

### Prerequisites
- Node.js and npm installed
- OpenAI API key
- n8n (installed via npx)

### Installation

1. **Clone git repo and cd to project **
   ```bash
   git clone git@github.com:jdutton/n8n-pii-sanitization.git && cd n8n-pii-sanitization
   ```

2. **Start n8n**
   ```bash
   npx n8n start
   ```

3. **Access n8n editor**
   - Open http://localhost:5678
   - Complete initial setup

4. **Import workflow**
   - In n8n UI, click "Import from File" and select `pii-sanitization-workflow.json`
   - Configure OpenAI node with your API key
   - Activate the workflow

5. **Install test dependencies**
   ```bash
   npm install
   ```

6. **Test the workflow**
   ```bash
   # Run all tests (production endpoint - default)
   npx tsx test-runner.ts

   # Run all tests against test endpoint
   npx tsx test-runner.ts --test

   # Run specific test (production endpoint)
   npx tsx test-runner.ts testdata/basic-pii.yaml

   # Run specific test against test endpoint
   npx tsx test-runner.ts --test testdata/basic-pii.yaml
   ```

## Test Suite

This project includes a comprehensive TypeScript test suite for validating the PII sanitization workflow.

### Test Structure

Tests are defined as YAML files in the `testdata/` directory:

```yaml
description: "Test detection and tokenization of common PII types"

input:
  message: "Hi, I am John Smith, my email is john.smith@company.com..."

expected:
  status: "success"
  sanitized_text: "Hi, I am [Person1], my email is [Person1:email1]..."
  persons:
    Person1:
      primary_name: "John Smith"
      aliases: []
      emails: ["john.smith@company.com"]
      phones: ["555-123-4567"]
      addresses: ["123 Main Street, New York, NY 10001"]
      relationships: {}
      metadata:
        confidence_score: 0.95
        session_count: 1
  token_map:
    "[Person1]": "primary_name"
    "[Person1:email1]": "emails[0]"
    "[Person1:phone1]": "phones[0]"
    "[Person1:address1]": "addresses[0]"

validation:
  required_fields: ["status", "sanitized_text", "session_id", "persons", "token_map", "pii_mapping"]
  person_tokens: ["Person1"]
  pii_attributes: ["primary_name", "emails", "phones", "addresses"]
```

### Running Tests

```bash
# Run all tests (production endpoint - default)
npx tsx test-runner.ts

# Run all tests against test endpoint
npx tsx test-runner.ts --test

# Run a specific test file (production endpoint)
npx tsx test-runner.ts testdata/basic-pii.yaml

# Run specific test against test endpoint
npx tsx test-runner.ts --test testdata/basic-pii.yaml
```

### Test Validation

The test runner validates:
- ✅ HTTP response structure and status codes
- ✅ Required JSON fields presence
- ✅ Person token detection accuracy
- ✅ Person schema structure and attributes
- ✅ Token mapping correctness
- ✅ Original input preservation
- ✅ Session ID and timestamp formats
- ✅ Expected vs actual PII mappings
- ✅ Protection against prompt injection attacks

## Enterprise Considerations

### Security
- **Encryption at rest**: PII mappings should be encrypted in production
- **Access controls**: Restrict API access with authentication
- **Audit logging**: Track all PII operations for compliance
- **Data retention**: Implement automatic PII mapping cleanup

### Scalability
- **External memory**: Use Redis or database for PII mapping storage
- **Rate limiting**: Implement API throttling for production use
- **Batch processing**: Handle high-volume scenarios efficiently
- **Model optimization**: Fine-tune for specific PII types and industries

### Compliance
- **GDPR**: Right to erasure support through PII mapping deletion
- **HIPAA**: Healthcare-specific PII detection patterns
- **SOX**: Financial data tokenization requirements
- **Industry standards**: Configurable detection rules per sector

## Agentic Workflow Patterns

This PII sanitization workflow demonstrates several key patterns for building agentic AI systems:

1. **Data preprocessing**: Clean and prepare data before AI processing
2. **Reversible transformations**: Maintain ability to restore original data
3. **Session management**: Track processing context across workflow steps
4. **Error handling**: Graceful degradation when AI processing fails
5. **Structured outputs**: Consistent JSON responses for integration

## Technical Architecture

### Node Configuration
- **Model**: GPT-5 (latest OpenAI model)
- **Temperature**: 0.1 (consistent, deterministic responses)
- **Response format**: Structured JSON output with person schema
- **Error handling**: Graceful fallback with raw response logging
- **Schema**: Person-centric with persistent identity across sessions

### Why GPT-5 is Required

The system uses GPT-5 instead of smaller models for several critical capabilities:

**Multi-Person Entity Resolution:**
- **GPT-5-nano limitation**: Could only detect single persons in complex scenarios
- **GPT-5 advantage**: Correctly identifies multiple people (Person1, Person2, etc.) in the same conversation
- **Relationship mapping**: GPT-5 can identify and map family/professional relationships between detected persons
- **Alias handling**: Properly recognizes when "Tim" and "Timmy" refer to the same person

**Enhanced PII Detection:**
- **SSN/ID detection**: GPT-5 shows superior accuracy in detecting Social Security Numbers and other ID formats
- **Context awareness**: Better understanding of PII in complex sentence structures
- **Confidence scoring**: More accurate confidence assessments (typically 0.98-0.99 vs 0.95)

**Security Features:**
- **Prompt injection resistance**: GPT-5 demonstrates better defense against injection attacks while maintaining PII sanitization
- **Conservative detection**: Reduces sensitivity when potential security threats are detected
- **Consistent schema adherence**: More reliable JSON structure output compliance

### Data Flow
1. Webhook receives raw text input
2. LangChain node processes with person-centric PII detection prompt
3. AI assigns sequential Person IDs (Person1, Person2, etc.)
4. Code node parses AI response and generates person objects
5. Response node returns structured output with person schema
6. Person mappings and token mappings stored for potential reversal

## Contributing

This is an experimental project for exploring agentic AI workflows. Key areas for contribution:

- **Detection accuracy**: Improve PII identification patterns
- **Performance optimization**: Reduce processing latency
- **Security enhancements**: Add encryption and access controls
- **Integration examples**: Demonstrate real-world usage patterns

## License

Experimental project - use at your own risk. Not intended for production use without proper security implementations.
