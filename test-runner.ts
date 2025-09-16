#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface Person {
  primary_name: string;
  aliases: string[];
  emails: string[];
  phones: string[];
  addresses: string[];
  relationships: Record<string, any>;
  metadata: {
    confidence_score?: number;
    first_seen?: string;
    last_seen?: string;
    session_count?: number;
  };
}

interface TestCase {
  description: string;
  input: {
    message: string;
  };
  expected: {
    status: string;
    sanitized_text: string;
    pii_mapping?: Record<string, string>;
    persons?: Record<string, Person>;
    token_map?: Record<string, string>;
  };
  validation: {
    required_fields: string[];
    pii_tokens?: string[];
    person_tokens?: string[];
    pii_attributes?: string[];
  };
}

interface APIResponse {
  status: string;
  sanitized_text: string;
  session_id: string;
  pii_mapping: Record<string, string>;
  persons?: Record<string, Person>;
  token_map?: Record<string, string>;
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
  const expectedFields = ['status', 'sanitized_text', 'session_id', 'pii_mapping', 'persons', 'token_map', 'original_input', 'timestamp'];
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

  // Check legacy PII tokens (backward compatibility)
  if (testCase.validation.pii_tokens) {
    for (const token of testCase.validation.pii_tokens) {
      if (!response.sanitized_text.includes(token)) {
        errors.push(`Expected PII token "${token}" not found in sanitized text`);
      }
      if (!(token in response.pii_mapping)) {
        errors.push(`Expected PII token "${token}" not found in mapping`);
      }
    }
  }

  // Check new person-centric schema
  if (testCase.validation.person_tokens) {
    for (const personId of testCase.validation.person_tokens) {
      if (!response.persons || !(personId in response.persons)) {
        errors.push(`Expected person "${personId}" not found in persons`);
      }
    }
  }

  // Validate person structure
  if (testCase.expected.persons && response.persons) {
    for (const [personId, expectedPerson] of Object.entries(testCase.expected.persons)) {
      const actualPerson = response.persons[personId];
      if (!actualPerson) {
        errors.push(`Expected person "${personId}" not found in response`);
        continue;
      }

      // Check required person attributes
      if (testCase.validation.pii_attributes) {
        for (const attr of testCase.validation.pii_attributes) {
          if (!(attr in actualPerson)) {
            errors.push(`Person "${personId}" missing required attribute "${attr}"`);
          }
        }
      }
    }
  }

  // Validate token map
  if (testCase.expected.token_map && response.token_map) {
    for (const [token, expectedPath] of Object.entries(testCase.expected.token_map)) {
      if (!(token in response.token_map)) {
        errors.push(`Expected token "${token}" not found in token_map`);
      }
    }
  }

  // Check legacy PII mapping (backward compatibility)
  if (testCase.expected.pii_mapping) {
    for (const [token, expectedValue] of Object.entries(testCase.expected.pii_mapping)) {
      if (response.pii_mapping[token] !== expectedValue) {
        errors.push(`PII mapping mismatch for ${token}: expected "${expectedValue}", got "${response.pii_mapping[token]}"`);
      }
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

async function runAllTests(webhookUrl: string): Promise<boolean> {
  const testDataDir = './testdata';

  if (!fs.existsSync(testDataDir)) {
    console.error(`❌ Test data directory not found: ${testDataDir}`);
    return false;
  }

  const testFiles = fs.readdirSync(testDataDir)
    .filter(file => file.endsWith('.yaml'))
    .map(file => path.join(testDataDir, file))
    .sort();

  if (testFiles.length === 0) {
    console.error('❌ No test files found in testdata directory');
    return false;
  }

  console.log(`📂 Found ${testFiles.length} test files:`);
  testFiles.forEach(file => console.log(`   - ${path.basename(file)}`));
  console.log('');

  let allPassed = true;
  let totalTests = 0;
  let passedTests = 0;

  for (const testFile of testFiles) {
    totalTests++;
    const success = await runTestFile(testFile, webhookUrl);
    if (success) {
      passedTests++;
    } else {
      allPassed = false;
    }
  }

  console.log('='.repeat(60));
  console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);

  if (allPassed) {
    console.log('🎉 All tests passed!');
  } else {
    console.log(`💔 ${totalTests - passedTests} test(s) failed!`);
  }

  return allPassed;
}

async function main() {
  const args = process.argv.slice(2);

  let useTestUrl = false;
  let testFile: string | null = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--test') {
      useTestUrl = true;
    } else if (!testFile && args[i].endsWith('.yaml')) {
      testFile = args[i];
    }
  }

  const webhookUrl = useTestUrl ? TEST_URL : PROD_URL;

  console.log('🚀 n8n PII Sanitization Test Runner');
  console.log(`🌐 Testing against: ${webhookUrl} ${useTestUrl ? '(TEST)' : '(PRODUCTION)'}`);

  let success: boolean;

  if (testFile) {
    // Run single test file
    if (!fs.existsSync(testFile)) {
      console.error(`❌ Test file not found: ${testFile}`);
      process.exit(1);
    }
    success = await runTestFile(testFile, webhookUrl);

    if (success) {
      console.log('\n🎉 Test passed!');
    } else {
      console.log('\n💔 Test failed!');
    }
  } else {
    // Run all tests
    console.log('🔍 No specific test file provided, running all tests...\n');
    success = await runAllTests(webhookUrl);
  }

  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}