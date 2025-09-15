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
2. **LangChain OpenAI Node** - Uses GPT-5-mini for PII detection and tokenization
3. **Code Node** - Processes AI response and generates session mapping
4. **Response Node** - Returns structured JSON with sanitized text and PII mapping

## PII Detection Capabilities

The AI model detects and tokenizes:
- **Names**: `[Person1]`, `[Person2]`, etc.
- **Email addresses**: `[Email1]`, `[Email2]`, etc.
- **Physical addresses**: `[Address1]`, `[Address2]`, etc.
- **Phone numbers**: `[Phone1]`, `[Phone2]`, etc.
- **SSN/ID numbers**: `[ID1]`, `[ID2]`, etc.

## API Usage

### Request
```bash
curl -X POST http://localhost:5678/webhook-test/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, I am John Smith, my email is john.smith@company.com and I live at 123 Main Street, New York, NY 10001. My phone is 555-123-4567 and my SSN is 123-45-6789."
  }'
```

### Response
```json
{
  "status": "success",
  "sanitized_text": "Hi, I am [Person1], my email is [Email1] and I live at [Address1]. My phone is [Phone1] and my SSN is [ID1].",
  "session_id": "1_1726419234567",
  "pii_mapping": {
    "[Person1]": "John Smith",
    "[Email1]": "john.smith@company.com", 
    "[Address1]": "123 Main Street, New York, NY 10001",
    "[Phone1]": "555-123-4567",
    "[ID1]": "123-45-6789"
  },
  "original_input": "Hi, I am John Smith...",
  "timestamp": "2025-09-15T00:45:00.000Z"
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
   # Basic shell test
   chmod +x test-pii.sh
   ./test-pii.sh

   # TypeScript test suite (recommended)
   npx tsx test-runner.ts testdata/basic-pii.yaml
   ```

## Test Suite

This project includes a comprehensive TypeScript test suite for validating the PII sanitization workflow.

### Test Structure

Tests are defined as YAML files in the `testdata/` directory:

```yaml
name: "Basic PII Detection Test"
description: "Test detection and tokenization of common PII types"

input:
  message: "Hi, I am John Smith, my email is john.smith@company.com..."

expected:
  status: "success"
  sanitized_text: "Hi, I am [Person1], my email is [Email1]..."
  pii_mapping:
    "[Person1]": "John Smith"
    "[Email1]": "john.smith@company.com"

validation:
  required_fields: ["status", "sanitized_text", "session_id", "pii_mapping"]
  pii_tokens: ["[Person1]", "[Email1]", "[Address1]", "[Phone1]", "[ID1]"]
```

### Running Tests

```bash
# Run a specific test file
npx tsx test-runner.ts testdata/basic-pii.yaml

# Run all tests (when multiple test files exist)
npm test
```

### Test Validation

The test runner validates:
- ✅ HTTP response structure and status codes
- ✅ Required JSON fields presence
- ✅ PII token detection accuracy
- ✅ Original input preservation
- ✅ Session ID and timestamp formats
- ✅ Expected vs actual PII mappings

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

## Next Steps

### Immediate Enhancements
- [ ] Add support for custom PII patterns
- [ ] Implement confidence scoring for detections
- [ ] Add batch processing capabilities
- [ ] Create PII mapping reversal endpoint

### Advanced Features
- [ ] Multi-language PII detection
- [ ] Industry-specific detection rules
- [ ] Real-time PII monitoring dashboard
- [ ] Integration with data governance tools

### Agentic Workflow Extensions
- [ ] Chain multiple AI models for complex analysis
- [ ] Add conditional logic based on PII risk levels
- [ ] Implement feedback loops for detection improvement
- [ ] Create autonomous data classification workflows

## Technical Architecture

### Node Configuration
- **Model**: GPT-5-mini (latest OpenAI model)
- **Temperature**: 0.1 (consistent, deterministic responses)
- **Response format**: Structured JSON output
- **Error handling**: Graceful fallback with raw response logging

### Data Flow
1. Webhook receives raw text input
2. LangChain node processes with PII detection prompt
3. Code node parses AI response and generates session data
4. Response node returns structured output
5. PII mappings stored for potential reversal

## Contributing

This is an experimental project for exploring agentic AI workflows. Key areas for contribution:

- **Detection accuracy**: Improve PII identification patterns
- **Performance optimization**: Reduce processing latency
- **Security enhancements**: Add encryption and access controls
- **Integration examples**: Demonstrate real-world usage patterns

## License

Experimental project - use at your own risk. Not intended for production use without proper security implementations.
