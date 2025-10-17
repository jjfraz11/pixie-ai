import assert from 'assert';

/**
 * Additional response assertion utilities
 */

/**
 * Assert that response data matches expected structure
 */
export function assertResponseDataStructure(response: any, expectedFields: string[]): void {
  assert.ok(response.data, 'Response should have data');
  expectedFields.forEach((field) => {
    assert.ok(response.data[field] !== undefined, `Response data should have field: ${field}`);
  });
}

/**
 * Assert that response has specific data value
 */
export function assertResponseDataValue(response: any, field: string, expectedValue: any): void {
  assert.ok(response.data, 'Response should have data');
  assert.strictEqual(
    response.data[field],
    expectedValue,
    `Response data field '${field}' should equal ${expectedValue}`,
  );
}

/**
 * Assert that response data contains specific value
 */
export function assertResponseDataContains(response: any, field: string, expectedValue: any): void {
  assert.ok(response.data, 'Response should have data');
  assert.ok(response.data[field], `Response data should have field: ${field}`);

  const fieldValue = response.data[field];
  if (Array.isArray(fieldValue)) {
    assert.ok(fieldValue.includes(expectedValue), `Response data field '${field}' should contain ${expectedValue}`);
  } else if (typeof fieldValue === 'string') {
    assert.ok(fieldValue.includes(expectedValue), `Response data field '${field}' should contain ${expectedValue}`);
  } else {
    assert.fail(`Field '${field}' is not a string or array, cannot check containment`);
  }
}

/**
 * Assert that response data matches partial object
 */
export function assertResponseDataPartial(response: any, partialData: Record<string, any>): void {
  assert.ok(response.data, 'Response should have data');

  Object.keys(partialData).forEach((key) => {
    assert.strictEqual(
      response.data[key],
      partialData[key],
      `Response data field '${key}' should equal ${partialData[key]}`,
    );
  });
}

/**
 * Assert that response has pagination data
 */
export function assertResponsePagination(
  response: any,
  expectedTotal?: number,
  expectedLimit?: number,
  expectedSkip?: number,
): void {
  assert.ok(response.data, 'Response should have data');

  if (expectedTotal !== undefined) {
    assert.strictEqual(response.data.total, expectedTotal, 'Response should have correct total');
  }
  if (expectedLimit !== undefined) {
    assert.strictEqual(response.data.limit, expectedLimit, 'Response should have correct limit');
  }
  if (expectedSkip !== undefined) {
    assert.strictEqual(response.data.skip, expectedSkip, 'Response should have correct skip');
  }

  // Ensure basic pagination structure exists
  assert.ok(typeof response.data.total === 'number', 'Response should have numeric total');
  assert.ok(Array.isArray(response.data.data), 'Response should have data array');
}

/**
 * Assert that response data is valid array
 */
export function assertResponseDataArray(response: any, minLength?: number, maxLength?: number): void {
  assert.ok(response.data, 'Response should have data');
  assert.ok(Array.isArray(response.data), 'Response data should be an array');

  if (minLength !== undefined) {
    assert.ok(response.data.length >= minLength, `Response data array should have at least ${minLength} items`);
  }

  if (maxLength !== undefined) {
    assert.ok(response.data.length <= maxLength, `Response data array should have at most ${maxLength} items`);
  }
}

/**
 * Assert that response data has valid ID
 */
export function assertResponseDataId(response: any): void {
  assert.ok(response.data, 'Response should have data');
  assert.ok(response.data.id, 'Response data should have id');
  assert.ok(
    typeof response.data.id === 'string' || typeof response.data.id === 'number',
    'Response data id should be string or number',
  );
}

/**
 * Assert that response data has valid timestamps
 */
export function assertResponseDataTimestamps(response: any): void {
  assert.ok(response.data, 'Response should have data');

  if (response.data.createdAt) {
    assert.ok(!isNaN(Date.parse(response.data.createdAt)), 'Response data should have valid createdAt timestamp');
  }

  if (response.data.updatedAt) {
    assert.ok(!isNaN(Date.parse(response.data.updatedAt)), 'Response data should have valid updatedAt timestamp');
  }
}
