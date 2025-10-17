import { GeneralError, BadRequest, NotAuthenticated } from '@feathersjs/errors';

/**
 * Error context for consistent error handling
 */
export interface ErrorContext {
  operation?: string;
  message?: string;
  data: Record<string, any>;
  statusCode?: number;
  errorType?: 'validation' | 'authentication' | 'authorization' | 'general';
}

/**
 * Helper function for consistent Prisma error handling with proper status codes
 */
export const handlePrismaError = (error: any, context: ErrorContext, throwErrors = true) => {
  const { operation = 'unknown', data = {}, statusCode, errorType = 'general' } = context;
  const errorLabel = `Failed ${operation.toUpperCase()} operation`;

  let errorMessage = '';
  let dataString = JSON.stringify(data, null, 2);

  // Handle specific Prisma error codes with appropriate status codes
  switch (error.code) {
    case 'P2025':
      // Record not found - for authentication, this should be 401
      if (errorType === 'authentication') {
        errorMessage = 'Invalid credentials';
        if (throwErrors) {
          throw new NotAuthenticated(errorMessage, {
            errors: [{ message: 'Email or password is incorrect' }],
            original: error,
          });
        }
        return { message: errorMessage, statusCode: 401 };
      }
      errorMessage = `${errorLabel}: Record not found: '${dataString}'`;
      break;

    case 'P2002':
      // Unique constraint violation - should be 400 for validation errors
      errorMessage = `${errorLabel}: Unique constraint violation: '${dataString}'`;
      break;

    case 'P2003':
      // Foreign key constraint violation - should be 400
      errorMessage = `${errorLabel}: Foreign key constraint violation: '${dataString}'`;
      break;

    case 'P2028':
      // Transaction API error - should be 500
      errorMessage = `${errorLabel}: Transaction API error: '${dataString}'`;
      break;

    case 'P2034':
      // Invalid ID format - should be 400 for validation
      errorMessage = `${errorLabel}: Invalid ID format: '${dataString}'`;
      break;

    default:
      errorMessage = `${errorLabel}: Unknown Prisma error: '${dataString}'`;
      break;
  }

  // Choose appropriate error type based on context
  let ErrorClass = GeneralError;
  let defaultStatusCode = 500;

  switch (errorType) {
    case 'authentication':
      ErrorClass = NotAuthenticated;
      defaultStatusCode = 401;
      break;
    case 'authorization':
      ErrorClass = GeneralError; // Will be converted to 403 by error handler
      defaultStatusCode = 403;
      break;
    case 'validation':
      ErrorClass = BadRequest;
      defaultStatusCode = 400;
      break;
    default:
      ErrorClass = GeneralError;
      defaultStatusCode = statusCode || 500;
  }

  const finalStatusCode = statusCode || defaultStatusCode;

  if (throwErrors) {
    // Create error with proper status code
    const errorInstance = new ErrorClass(errorMessage, {
      errors: [{ message: errorMessage }],
      original: error,
    });

    // Set the status code on the error instance
    (errorInstance as any).code = finalStatusCode;

    throw errorInstance;
  } else {
    console.error(errorMessage);
    return { message: errorMessage, statusCode: finalStatusCode };
  }
};
