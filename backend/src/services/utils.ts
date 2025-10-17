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

  // Helper to build consistent error messages
  const buildErrorMessage = (label: string, data: any) => {
    const serializedData = JSON.stringify(data, null, 2);
    return `${label}: '${serializedData}'`;
  };

  // Handle P2025 authentication case early
  if (error.code === 'P2025' && errorType === 'authentication') {
    const errorMessage = 'Invalid credentials';
    if (throwErrors) {
      throw new NotAuthenticated(errorMessage, {
        errors: [{ message: 'Email or password is incorrect' }],
        original: error,
      });
    }
    return { message: errorMessage, statusCode: 401 };
  }

  // Map of Prisma error codes to handlers for cleaner logic
  const errorHandlers = {
    P2025: (label: string, data: any) => buildErrorMessage(`${label}: Record not found`, data),
    P2002: (label: string, data: any) => buildErrorMessage(`${label}: Unique constraint violation`, data),
    P2003: (label: string, data: any) => buildErrorMessage(`${label}: Foreign key constraint violation`, data),
    P2028: (label: string, data: any) => buildErrorMessage(`${label}: Transaction API error`, data),
    P2034: (label: string, data: any) => buildErrorMessage(`${label}: Invalid ID format`, data),
  };

  // Set error message based on handler or default
  const errorMessage = errorHandlers[error.code as keyof typeof errorHandlers]
    ? errorHandlers[error.code as keyof typeof errorHandlers](errorLabel, data)
    : buildErrorMessage(`${errorLabel}: Unknown Prisma error`, data);

  // Config object for error type-based settings
  const errorTypeConfig = {
    authentication: { ErrorClass: NotAuthenticated, defaultStatusCode: 401 },
    authorization: { ErrorClass: GeneralError, defaultStatusCode: 403 },
    validation: { ErrorClass: BadRequest, defaultStatusCode: 400 },
    general: { ErrorClass: GeneralError, defaultStatusCode: statusCode || 500 },
  };

  const config = errorTypeConfig[errorType] || errorTypeConfig.general;
  const ErrorClass = config.ErrorClass;
  const defaultStatusCode = config.defaultStatusCode;
  const finalStatusCode = statusCode || defaultStatusCode;

  // Handle throwing or returning
  if (throwErrors) {
    const errorInstance = new ErrorClass(errorMessage, {
      errors: [{ message: errorMessage }],
      original: error,
    });
    (errorInstance as any).code = finalStatusCode;
    throw errorInstance;
  }

  console.error(errorMessage);
  return { message: errorMessage, statusCode: finalStatusCode };
};
