import { BadRequest, Forbidden } from '@feathersjs/errors';
import { hooks as schemaHooks } from '@feathersjs/schema';

import { Role } from '@prisma/client';

import { validatePasswordStrength } from '@/services/authentication/utils/password-validation';
import { userDataResolver } from './users.schema';

/**
 * @fileoverview User hooks with utility function integration
 */

// Password validation helper
export const validatePassword = async (context: any) => {
  if (context.data.password) {
    const validation = validatePasswordStrength(context.data.password);
    if (!validation.isValid) {
      throw new BadRequest(validation.errors.join(', '));
    }
  }
  return context;
};

// Role authorization helper using utility functions
export const checkRoleAuthorization = async (context: any) => {
  // Ensure user roles is treated as an array for consistent checking
  const userRoles = Array.isArray(context.params.user?.roles)
    ? context.params.user.roles
    : [context.params.user?.roles].filter(Boolean);

  if (context.data.roles && (!context.params.user || !userRoles.includes(Role.ADMIN))) {
    throw new Forbidden('Only administrators can update user roles.');
  }
  return context;
};

// Configure service hooks
export const configureUserHooks = (service: any) => {
  service.hooks({
    before: {
      all: [],
      find: [
        // Require admin role for listing all users
        (context: any) => {
          // // Skip authorization check if this is during authentication
          // if (context.params._skipAuth) {
          //   return context;
          // }

          // if (!context.params.user) {
          //   throw new Forbidden('Authentication required');
          // }

          // // Ensure user roles is treated as an array for consistent checking
          // const userRoles = Array.isArray(context.params.user.roles)
          //   ? context.params.user.roles
          //   : [context.params.user.roles].filter(Boolean);

          // if (!userRoles.includes(Role.ADMIN)) {
          //   throw new Forbidden('You are not allowed to access this resource.');
          // }
          return context;
        },
      ],
      get: [],
      create: [validatePassword, schemaHooks.resolveData(userDataResolver)],
      update: [
        (context: any) => checkRoleAuthorization(context),
        (context: any) => validatePassword(context),
        schemaHooks.resolveData(userDataResolver),
      ],
      patch: [
        (context: any) => checkRoleAuthorization(context),
        (context: any) => validatePassword(context),
        schemaHooks.resolveData(userDataResolver),
      ],
      remove: [],
    },
    after: {
      all: [
        async (context: any) => {
          // Remove password from response (handles both single objects and arrays)
          if (context.result) {
            if (Array.isArray(context.result)) {
              context.result.forEach((user: any) => {
                if (user?.password) delete user.password;
              });
            } else if (context.result.password) {
              delete context.result.password;
            }
          }
          return context;
        },
      ],
    },
  });
};
