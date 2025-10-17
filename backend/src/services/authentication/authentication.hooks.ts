import { BadRequest, NotAuthenticated, Forbidden, GeneralError } from '@feathersjs/errors';
import { Application } from '@feathersjs/feathers';

// CAPTCHA validation helper
export const validateCaptcha = async (context: any) => {
  // Explicitly set app on context if it's missing
  if (!context.app) {
    context.app = context.service?.app || (context as any).app;
  }

  if (context.data.strategy === 'local') {
    if (!context.data.captcha) {
      const error = new BadRequest('CAPTCHA is required');
      (error as any).code = 400;
      throw error;
    }
    if (context.data.captcha !== 'pixie') {
      const error = new BadRequest('Invalid CAPTCHA');
      (error as any).code = 400;
      throw error;
    }
    delete context.data.captcha;
  }

  // Log authentication attempts for debugging
  console.log('Authentication attempt:', {
    strategy: context.data?.strategy,
    email: context.data?.email,
    hasPassword: !!context.data?.password,
  });

  return context;
};

// Input validation hook
export const validateAuthenticationInput = async (context: any) => {
  const { data } = context;

  if (!data) {
    const error = new BadRequest('Request data is required');
    (error as any).code = 400;
    throw error;
  }

  if (!data.strategy) {
    const error = new NotAuthenticated('Authentication strategy is required');
    (error as any).code = 401;
    throw error;
  }

  // Validate strategy-specific requirements
  if (data.strategy === 'local') {
    if (!data.email) {
      const error = new NotAuthenticated('Email is required for local strategy');
      (error as any).code = 401;
      throw error;
    }
    if (!data.password) {
      const error = new NotAuthenticated('Password is required for local strategy');
      (error as any).code = 401;
      throw error;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      const error = new NotAuthenticated('Invalid email format');
      (error as any).code = 401;
      throw error;
    }
  }

  if (data.strategy === 'jwt') {
    if (!data.accessToken) {
      const error = new NotAuthenticated('Access token is required for JWT strategy');
      (error as any).code = 401;
      throw error;
    }
  }

  return context;
};

// Enhanced error handling hook with proper HTTP status mapping
export const handleAuthenticationError = async (context: any) => {
  const { error, method } = context;

  console.error(`Authentication service error on method ${method}:`, {
    error: error.message,
    stack: error.stack,
    data: context.data,
  });

  // Map different error types to appropriate HTTP status codes and messages
  if (error instanceof NotAuthenticated) {
    // Handle authentication failures (wrong credentials, invalid tokens, etc.)
    context.error = new NotAuthenticated(error.message || 'Invalid credentials', {
      errors: [{ message: error.message || 'Authentication failed' }],
    });
  } else if (error instanceof BadRequest) {
    // Handle bad requests (malformed data, validation errors, etc.)
    context.error = new BadRequest(error.message || 'Invalid request', {
      errors: [{ message: error.message || 'Request validation failed' }],
    });
  } else if (error instanceof Forbidden) {
    // Handle authorization failures
    context.error = new Forbidden(error.message || 'Access forbidden', {
      errors: [{ message: error.message || 'Insufficient permissions' }],
    });
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    // Handle MongoDB/mongoose validation errors
    context.error = new BadRequest('Invalid data format', {
      errors: [{ message: 'Data validation failed' }],
    });
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    // Handle JWT-specific errors
    context.error = new NotAuthenticated('Invalid or expired token', {
      errors: [{ message: 'Token authentication failed' }],
    });
  } else if (error.code === 'CREDENTIALS_INVALID' || error.code === 'INVALID_LOGIN') {
    // Handle specific authentication strategy errors
    context.error = new NotAuthenticated('Invalid credentials', {
      errors: [{ message: 'Email or password is incorrect' }],
    });
  } else if (error.code === 'USER_NOT_FOUND') {
    // Handle user not found errors
    context.error = new NotAuthenticated('Invalid credentials', {
      errors: [{ message: 'Email or password is incorrect' }],
    });
  } else if (error.message && error.message.includes('captcha')) {
    // Handle CAPTCHA-related errors
    context.error = new BadRequest('CAPTCHA verification failed', {
      errors: [{ message: 'Invalid or missing CAPTCHA' }],
    });
  } else if (error.message && error.message.includes('rate limit')) {
    // Handle rate limiting errors
    context.error = new GeneralError('Too many requests', {
      errors: [{ message: 'Rate limit exceeded' }],
    });
    (context.error as any).code = 429;
  } else {
    // Handle unexpected errors - ensure they don't expose sensitive information
    console.error('Unexpected authentication error:', error);

    // Only expose error details in development
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    context.error = new GeneralError('Internal server error', {
      errors: [
        {
          message: isDevelopment ? error.message || 'An unexpected error occurred' : 'An unexpected error occurred',
        },
      ],
    });
    (context.error as any).code = 500;
  }

  return context;
};

// Security headers and CORS handling
export const addSecurityHeaders = async (context: any) => {
  const { result } = context;

  if (result && context.method === 'create') {
    // Add security headers to successful authentication responses
    if (!context.http) context.http = {};
    if (!context.http.response) context.http.response = {};

    context.http.response.headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      ...context.http.response.headers,
    };
  }

  return context;
};

// Configure authentication service hooks
export const configureAuthenticationHooks = (service: any) => {
  service.hooks({
    before: {
      create: [validateCaptcha, validateAuthenticationInput],
    },
    after: {
      create: [addSecurityHeaders],
    },
    error: {
      all: [handleAuthenticationError],
    },
  });
};
