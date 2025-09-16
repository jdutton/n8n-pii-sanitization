#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface TestCase {
  description: string;
  input: {
    message: string;
  };
  expected: {
    status: string;
    sanitized_text: string;
    pii_mapping: Record<string, string>;
  };
  validation: {
    required_fields: string[];
    pii_tokens: string[];
  };
}

interface APIResponse {
  status: string;
  sanitized_text: string;
  session_id: string;
  pii_mapping: Record<string, string>;
  original_input: string;
  timestamp: string;
  [key: string]: any; // Allow additional fields for detection
}

const TEST_URL = 'http://localhost:5678/webhook-test/chat';
const PROD_URL = 'http://localhost:5678/webhook/chat';

async function sendRequest(input: TestCase['input'], webhookUrl: string): Promise<APIResponse> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to send request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateResponse(response: APIResponse, testCase: TestCase): string[] {
  const errors: string[] = [];

  // Check for unexpected additional fields (potential injection)
  const expectedFields = ['status', 'sanitized_text', 'session_id', 'pii_mapping', 'original_input', 'timestamp'];
  const actualFields = Object.keys(response);
  const unexpectedFields = actualFields.filter(field => !expectedFields.includes(field));

  if (unexpectedFields.length > 0) {
    errors.push(`Unexpected fields detected (possible injection): ${unexpectedFields.join(', ')}`);
  }

  // Check required fields
  for (const field of testCase.validation.required_fields) {
    if (!(field in response)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check status
  if (response.status !== testCase.expected.status) {
    errors.push(`Expected status "${testCase.expected.status}", got "${response.status}"`);
  }

  // Check original input matches (inject from input.message)
  if (response.original_input !== testCase.input.message) {
    errors.push(`Original input mismatch`);
  }

  // Check that all expected PII tokens appear in sanitized text
  for (const token of testCase.validation.pii_tokens) {
    if (!response.sanitized_text.includes(token)) {
      errors.push(`Expected PII token "${token}" not found in sanitized text`);
    }
  }

  // Check that PII mapping contains expected tokens
  for (const token of testCase.validation.pii_tokens) {
    if (!(token in response.pii_mapping)) {
      errors.push(`Expected PII token "${token}" not found in mapping`);
    }
  }

  // Check that mapped values match expected values exactly
  for (const [token, expectedValue] of Object.entries(testCase.expected.pii_mapping)) {
    if (response.pii_mapping[token] !== expectedValue) {
      errors.push(`PII mapping mismatch for ${token}: expected "${expectedValue}", got "${response.pii_mapping[token]}"`);
    }
  }

  // Check that sanitized text matches expected (strict comparison)
  if (response.sanitized_text !== testCase.expected.sanitized_text) {
    errors.push(`Sanitized text mismatch:\n  Expected: "${testCase.expected.sanitized_text}"\n  Actual:   "${response.sanitized_text}"`);
  }

  // Check timestamp format (ISO 8601)
  if (response.timestamp && !response.timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    errors.push(`Invalid timestamp format: ${response.timestamp}`);
  }

  // Check session_id format
  if (response.session_id && !response.session_id.match(/^\d+_\d+$/)) {
    errors.push(`Invalid session_id format: ${response.session_id}`);
  }

  return errors;
}

async function runTestFile(filePath: string, webhookUrl: string): Promise<boolean> {
  console.log(`\n🧪 Running test: ${path.basename(filePath)}`);
  console.log('='.repeat(50));

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const testCase = yaml.load(fileContent) as TestCase;

    console.log(`📝 ${path.basename(filePath, '.yaml')}`);
    console.log(`📄 ${testCase.description}`);

    console.log('\n📤 Sending request...');
    const response = await sendRequest(testCase.input, webhookUrl);

    console.log('📥 Response received');
    console.log('🔍 Validating response...');

    const errors = validateResponse(response, testCase);

    if (errors.length === 0) {
      console.log('✅ Test PASSED');
      console.log(`   Session ID: ${response.session_id}`);
      console.log(`   PII tokens detected: ${Object.keys(response.pii_mapping).length}`);
      return true;
    } else {
      console.log('❌ Test FAILED');
      console.log('   Validation errors:');
      for (const error of errors) {
        console.log(`   - ${error}`);
      }
      console.log('\n   Expected response:');
      const expectedWithOriginalInput = {
        ...testCase.expected,
        original_input: testCase.input.message
      };
      console.log('   ', JSON.stringify(expectedWithOriginalInput, null, 2).replace(/\n/g, '\n   '));
      console.log('\n   Actual response:');
      console.log('   ', JSON.stringify(response, null, 2).replace(/\n/g, '\n   '));
      return false;
    }
  } catch (error) {
    console.log('💥 Test ERROR');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: tsx test-runner.ts [--prod] <test-file.yaml>');
    console.log('Example: tsx test-runner.ts testdata/basic-pii.yaml');
    console.log('Example: tsx test-runner.ts --prod testdata/basic-pii.yaml');
    process.exit(1);
  }

  let useProductionUrl = false;
  let testFile = args[0];

  // Check for --prod flag
  if (args[0] === '--prod') {
    useProductionUrl = true;
    testFile = args[1];
    if (!testFile) {
      console.error('❌ Test file required after --prod flag');
      process.exit(1);
    }
  }

  const webhookUrl = useProductionUrl ? PROD_URL : TEST_URL;

  if (!fs.existsSync(testFile)) {
    console.error(`❌ Test file not found: ${testFile}`);
    process.exit(1);
  }

  console.log('🚀 n8n PII Sanitization Test Runner');
  console.log(`🌐 Testing against: ${webhookUrl} ${useProductionUrl ? '(PRODUCTION)' : '(TEST)'}`);

  const success = await runTestFile(testFile, webhookUrl);

  if (success) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n💔 Test failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}