import assert from 'assert';
import { ApiResponse } from './request-client';
import { STATUS_CODE_REQUEST_SUCCESSFUL, STATUS_CODE_REQUEST_FAILED } from './auth-client';

/**
 * Helper function to assert successful response
 */
export function assertSuccessResponse(
  response: ApiResponse,
  expectedStatusCode: number = STATUS_CODE_REQUEST_SUCCESSFUL,
): void {
  assert.strictEqual(response.status, expectedStatusCode);
  assert.strictEqual(response.errors, undefined);
  assert.ok(response.data, 'Response should have data');
}

/**
 * Helper function to assert failed response
 */
export function assertFailureResponse(
  response: ApiResponse,
  expectedStatusCode: number = STATUS_CODE_REQUEST_FAILED,
): void {
  assert.strictEqual(response.status, expectedStatusCode);
  assert.ok(response.errors, 'Response should have errors');
  assert.ok(Array.isArray(response.errors), 'Errors should be an array');
  assert.ok(response.errors.length > 0, 'Errors array should not be empty');
}

/**
 * Response validation helpers
 */
export class ResponseValidator {
  /**
   * Validate that response has expected structure
   */
  static validateResponseStructure(response: ApiResponse): boolean {
    return (
      response !== null &&
      typeof response === 'object' &&
      (response.data !== undefined || response.errors !== undefined) &&
      typeof response.status === 'number'
    );
  }

  /**
   * Validate successful response
   */
  static validateSuccessResponse(response: ApiResponse, expectedStatusCode?: number): boolean {
    if (!this.validateResponseStructure(response)) {
      return false;
    }

    if (expectedStatusCode && response.status !== expectedStatusCode) {
      return false;
    }

    return response.errors === undefined && response.data !== undefined;
  }

  /**
   * Validate error response
   */
  static validateErrorResponse(response: ApiResponse, expectedStatusCode?: number): boolean {
    if (!this.validateResponseStructure(response)) {
      return false;
    }

    if (expectedStatusCode && response.status !== expectedStatusCode) {
      return false;
    }

    return response.errors !== undefined && Array.isArray(response.errors) && response.errors.length > 0;
  }

  /**
   * Extract error message from response
   */
  static getErrorMessage(response: ApiResponse): string | null {
    if (!response.errors || !Array.isArray(response.errors) || response.errors.length === 0) {
      return null;
    }

    return response.errors.join('; ');
  }

  /**
   * Check if response contains specific error
   */
  static hasError(response: ApiResponse, errorText: string): boolean {
    if (!response.errors || !Array.isArray(response.errors)) {
      return false;
    }

    return response.errors.some((error) => error.includes(errorText));
  }
}
