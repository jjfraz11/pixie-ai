import { describe, it } from 'mocha';
import assert from 'assert';
import { ResponseValidator } from '../api/response-handler';
import { ApiResponse } from '../api/request-client';
import { STATUS_CODE_REQUEST_SUCCESSFUL, STATUS_CODE_REQUEST_FAILED } from '../api/auth-client';

describe('ResponseValidator', () => {
  describe('validateResponseStructure', () => {
    it('should return true for valid response structure with data', () => {
      const response: ApiResponse = {
        data: { id: 1, name: 'test' },
        status: 200,
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), true);
    });

    it('should return true for valid response structure with errors', () => {
      const response: ApiResponse = {
        errors: ['Error message'],
        status: 400,
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), true);
    });

    it('should return true for valid response structure with both data and errors', () => {
      const response: ApiResponse = {
        data: { id: 1 },
        errors: ['Warning message'],
        status: 200,
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), true);
    });

    it('should return false for null response', () => {
      assert.strictEqual(ResponseValidator.validateResponseStructure(null as any), false);
    });

    it('should return false for undefined response', () => {
      assert.strictEqual(ResponseValidator.validateResponseStructure(undefined as any), false);
    });

    it('should return false for non-object response', () => {
      assert.strictEqual(ResponseValidator.validateResponseStructure('string' as any), false);
      assert.strictEqual(ResponseValidator.validateResponseStructure(123 as any), false);
      assert.strictEqual(ResponseValidator.validateResponseStructure([] as any), false);
    });

    it('should return false for response without data or errors', () => {
      const response: ApiResponse = {
        status: 200,
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), false);
    });

    it('should return false for response without status', () => {
      const response: ApiResponse = {
        data: { id: 1 },
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), false);
    });

    it('should return false for response with non-numeric status', () => {
      const response: ApiResponse = {
        data: { id: 1 },
        status: '200' as any,
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), false);
    });
  });

  describe('validateSuccessResponse', () => {
    it('should return true for valid success response with default status', () => {
      const response: ApiResponse = {
        data: { id: 1, name: 'test' },
        status: STATUS_CODE_REQUEST_SUCCESSFUL,
      };

      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), true);
    });

    it('should return true for valid success response with custom status', () => {
      const response: ApiResponse = {
        data: { id: 1, name: 'test' },
        status: 201,
      };

      assert.strictEqual(ResponseValidator.validateSuccessResponse(response, 201), true);
    });

    it('should return false for success response with wrong status code', () => {
      const response: ApiResponse = {
        data: { id: 1, name: 'test' },
        status: STATUS_CODE_REQUEST_SUCCESSFUL,
      };

      assert.strictEqual(ResponseValidator.validateSuccessResponse(response, 201), false);
    });

    it('should return false for response with errors', () => {
      const response: ApiResponse = {
        data: { id: 1, name: 'test' },
        errors: ['Some error'],
        status: STATUS_CODE_REQUEST_SUCCESSFUL,
      };

      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), false);
    });

    it('should return false for response without data', () => {
      const response: ApiResponse = {
        status: STATUS_CODE_REQUEST_SUCCESSFUL,
      };

      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), false);
    });

    it('should return false for invalid response structure', () => {
      const response = 'invalid' as any;

      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), false);
    });

    it('should return false for error response', () => {
      const response: ApiResponse = {
        errors: ['Error occurred'],
        status: 400,
      };

      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), false);
    });
  });

  describe('validateErrorResponse', () => {
    it('should return true for valid error response with default status', () => {
      const response: ApiResponse = {
        errors: ['Error message'],
        status: STATUS_CODE_REQUEST_FAILED,
      };

      assert.strictEqual(ResponseValidator.validateErrorResponse(response), true);
    });

    it('should return true for valid error response with custom status', () => {
      const response: ApiResponse = {
        errors: ['Not found'],
        status: 404,
      };

      assert.strictEqual(ResponseValidator.validateErrorResponse(response, 404), true);
    });

    it('should return false for error response with wrong status code', () => {
      const response: ApiResponse = {
        errors: ['Error message'],
        status: STATUS_CODE_REQUEST_FAILED,
      };

      assert.strictEqual(ResponseValidator.validateErrorResponse(response, 400), false);
    });

    it('should return false for response without errors array', () => {
      const response: ApiResponse = {
        status: STATUS_CODE_REQUEST_FAILED,
      };

      assert.strictEqual(ResponseValidator.validateErrorResponse(response), false);
    });

    it('should return false for response with empty errors array', () => {
      const response: ApiResponse = {
        errors: [],
        status: STATUS_CODE_REQUEST_FAILED,
      };

      assert.strictEqual(ResponseValidator.validateErrorResponse(response), false);
    });

    it('should return false for response with non-array errors', () => {
      const response: ApiResponse = {
        errors: 'Error message' as any,
        status: STATUS_CODE_REQUEST_FAILED,
      };

      assert.strictEqual(ResponseValidator.validateErrorResponse(response), false);
    });

    it('should return false for success response', () => {
      const response: ApiResponse = {
        data: { id: 1 },
        status: STATUS_CODE_REQUEST_SUCCESSFUL,
      };

      assert.strictEqual(ResponseValidator.validateErrorResponse(response), false);
    });

    it('should return false for invalid response structure', () => {
      const response = null as any;

      assert.strictEqual(ResponseValidator.validateErrorResponse(response), false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return combined error message for multiple errors', () => {
      const response: ApiResponse = {
        errors: ['Error 1', 'Error 2', 'Error 3'],
      };

      const result = ResponseValidator.getErrorMessage(response);
      assert.strictEqual(result, 'Error 1; Error 2; Error 3');
    });

    it('should return single error message', () => {
      const response: ApiResponse = {
        errors: ['Single error'],
      };

      const result = ResponseValidator.getErrorMessage(response);
      assert.strictEqual(result, 'Single error');
    });

    it('should return null for response without errors', () => {
      const response: ApiResponse = {
        data: { id: 1 },
        status: 200,
      };

      const result = ResponseValidator.getErrorMessage(response);
      assert.strictEqual(result, null);
    });

    it('should return null for response with empty errors array', () => {
      const response: ApiResponse = {
        errors: [],
        status: 400,
      };

      const result = ResponseValidator.getErrorMessage(response);
      assert.strictEqual(result, null);
    });

    it('should return null for response with non-array errors', () => {
      const response: ApiResponse = {
        errors: 'String error' as any,
        status: 400,
      };

      const result = ResponseValidator.getErrorMessage(response);
      assert.strictEqual(result, null);
    });

    it('should return null for response without errors property', () => {
      const response: ApiResponse = {
        data: { id: 1 },
        status: 200,
      };

      const result = ResponseValidator.getErrorMessage(response);
      assert.strictEqual(result, null);
    });

    it('should handle errors with special characters', () => {
      const response: ApiResponse = {
        errors: ['Error with spaces', 'Error with: colons', 'Error with; semicolons'],
      };

      const result = ResponseValidator.getErrorMessage(response);
      assert.strictEqual(result, 'Error with spaces; Error with: colons; Error with; semicolons');
    });

    it('should handle empty string errors', () => {
      const response: ApiResponse = {
        errors: ['Valid error', '', 'Another valid error'],
      };

      const result = ResponseValidator.getErrorMessage(response);
      assert.strictEqual(result, 'Valid error; ; Another valid error');
    });
  });

  describe('hasError', () => {
    it('should return true when response contains exact error text', () => {
      const response: ApiResponse = {
        errors: ['User not found', 'Invalid credentials'],
      };

      assert.strictEqual(ResponseValidator.hasError(response, 'User not found'), true);
      assert.strictEqual(ResponseValidator.hasError(response, 'Invalid credentials'), true);
    });

    it('should return true when response contains error text as substring', () => {
      const response: ApiResponse = {
        errors: ['User not found in the system'],
      };

      assert.strictEqual(ResponseValidator.hasError(response, 'User not found'), true);
      assert.strictEqual(ResponseValidator.hasError(response, 'not found'), true);
      assert.strictEqual(ResponseValidator.hasError(response, 'system'), true);
    });

    it('should return false when response does not contain error text', () => {
      const response: ApiResponse = {
        errors: ['User not found', 'Invalid credentials'],
      };

      assert.strictEqual(ResponseValidator.hasError(response, 'Network error'), false);
      assert.strictEqual(ResponseValidator.hasError(response, 'Database error'), false);
    });

    it('should return false for response without errors', () => {
      const response: ApiResponse = {
        data: { id: 1 },
        status: 200,
      };

      assert.strictEqual(ResponseValidator.hasError(response, 'Any error'), false);
    });

    it('should return false for response with empty errors array', () => {
      const response: ApiResponse = {
        errors: [],
        status: 400,
      };

      assert.strictEqual(ResponseValidator.hasError(response, 'Any error'), false);
    });

    it('should return false for response with non-array errors', () => {
      const response: ApiResponse = {
        errors: 'String error' as any,
        status: 400,
      };

      assert.strictEqual(ResponseValidator.hasError(response, 'Any error'), false);
    });

    it('should handle case-sensitive matching', () => {
      const response: ApiResponse = {
        errors: ['User not found'],
      };

      assert.strictEqual(ResponseValidator.hasError(response, 'user not found'), false);
      assert.strictEqual(ResponseValidator.hasError(response, 'User not found'), true);
    });

    it('should handle errors with special characters', () => {
      const response: ApiResponse = {
        errors: ['Error: User not found!', 'Warning; please check input.'],
      };

      assert.strictEqual(ResponseValidator.hasError(response, 'User not found'), true);
      assert.strictEqual(ResponseValidator.hasError(response, 'please check'), true);
    });

    it('should handle empty string error text', () => {
      const response: ApiResponse = {
        errors: ['Valid error', ''],
      };

      assert.strictEqual(ResponseValidator.hasError(response, ''), true);
      assert.strictEqual(ResponseValidator.hasError(response, 'Valid error'), true);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete success response workflow', () => {
      const response: ApiResponse = {
        data: { id: 1, name: 'test', createdAt: '2023-01-01T00:00:00Z' },
        status: 200,
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), true);
      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), true);
      assert.strictEqual(ResponseValidator.validateErrorResponse(response), false);
      assert.strictEqual(ResponseValidator.getErrorMessage(response), null);
      assert.strictEqual(ResponseValidator.hasError(response, 'error'), false);
    });

    it('should handle complete error response workflow', () => {
      const response: ApiResponse = {
        errors: ['Validation failed', 'Invalid input data'],
        status: 400,
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), true);
      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), false);
      assert.strictEqual(ResponseValidator.validateErrorResponse(response), true);
      assert.strictEqual(ResponseValidator.getErrorMessage(response), 'Validation failed; Invalid input data');
      assert.strictEqual(ResponseValidator.hasError(response, 'Validation failed'), true);
      assert.strictEqual(ResponseValidator.hasError(response, 'Invalid input'), true);
    });

    it('should handle network error response', () => {
      const response: ApiResponse = {
        errors: ['Network error: Connection timeout'],
        status: 500,
      };

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), true);
      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), false);
      assert.strictEqual(ResponseValidator.validateErrorResponse(response, 500), true);
      assert.strictEqual(ResponseValidator.getErrorMessage(response), 'Network error: Connection timeout');
      assert.strictEqual(ResponseValidator.hasError(response, 'Connection timeout'), true);
    });

    it('should handle malformed response gracefully', () => {
      const response = 'malformed' as any;

      assert.strictEqual(ResponseValidator.validateResponseStructure(response), false);
      assert.strictEqual(ResponseValidator.validateSuccessResponse(response), false);
      assert.strictEqual(ResponseValidator.validateErrorResponse(response), false);
      assert.strictEqual(ResponseValidator.getErrorMessage(response), null);
      assert.strictEqual(ResponseValidator.hasError(response, 'error'), false);
    });
  });
});
