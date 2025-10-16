import { Application, Service, Params, NullableId, HookContext } from '@feathersjs/feathers'; // Import Service interface
import prisma from '@/prisma';
import { GeneralError, NotFound, BadRequest, Conflict, Forbidden } from '@feathersjs/errors'; // Import FeathersJS errors
import { authenticate } from '@feathersjs/authentication'; // Import authenticate hook
import { validatePasswordStrength } from '@/services/authentication/utils/password-validation';
import { passwordHash } from '@feathersjs/authentication-local';
import { hooks as schemaHooks, resolve } from '@feathersjs/schema';
import bcrypt from 'bcrypt';
import { User } from './users.schema';
import { userDataResolver } from './users.resolvers';

// Define a type for the UserService options
interface UserServiceOptions {
  paginate?: any; // Adjust as needed
}

class UserService implements Service<any> {
  // Implement Service interface
  app: Application;
  options: UserServiceOptions;

  constructor(options: UserServiceOptions, app: Application) {
    this.options = options;
    this.app = app;
  }

  async find(params?: Params): Promise<any[]> {
    try {
      const { $limit, email } = params?.query || {};
      return prisma.user.findMany({ take: $limit, where: { email } });
    } catch (error: any) {
      throw new GeneralError('Failed to retrieve users', error);
    }
  }

  async get(id: string, params?: Params): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        ...(params?.query as any),
      });
      if (!user) {
        throw new NotFound(`User with id '${id}' not found`);
      }
      return user;
    } catch (error: any) {
      if (error instanceof NotFound) {
        throw error;
      }
      throw new GeneralError(`Failed to retrieve user with id '${id}'`, error);
    }
  }

  async create(data: any, params?: Params): Promise<any> {
    try {
      // The password hashing hook should have set passwordHash and removed password and captcha
      return prisma.user.create({ data });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Prisma unique constraint violation
        throw new Conflict('User with this email already exists');
      }
      throw new GeneralError('Failed to create user', error);
    }
  }

  async update(id: NullableId, data: any, params?: Params): Promise<any> {
    try {
      return prisma.user.update({ where: { id: id as string }, data });
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Prisma record not found
        throw new NotFound(`User with id '${id}' not found`);
      }
      if (error.code === 'P2002') {
        // Prisma unique constraint violation
        throw new Conflict('User with this email already exists');
      }
      throw new GeneralError(`Failed to update user with id '${id}'`, error);
    }
  }

  async patch(id: NullableId, data: any, params?: Params): Promise<any> {
    try {
      return prisma.user.update({ where: { id: id as string }, data });
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Prisma record not found
        throw new NotFound(`User with id '${id}' not found`);
      }
      if (error.code === 'P2002') {
        // Prisma unique constraint violation
        throw new Conflict('User with this email already exists');
      }
      throw new GeneralError(`Failed to patch user with id '${id}'`, error);
    }
  }

  async remove(id: NullableId, params?: Params): Promise<any> {
    try {
      return prisma.user.delete({ where: { id: id as string } });
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Prisma record not found
        throw new NotFound(`User with id '${id}' not found`);
      }
      throw new GeneralError(`Failed to remove user with id '${id}'`, error);
    }
  }
}

export default function configureUsersService(app: Application) {
  const options: UserServiceOptions = {
    paginate: app.get('paginate'),
  };

  app.use('/users', new UserService(options, app));

  const service = app.service('users');

  service.hooks({
    before: {
      all: [], // Authenticate all methods by default
      find: [],
      get: [],
      create: [
        async (context: any) => {
          // if (context.data.captcha && context.data.captcha !== 'pixie') {
          //   throw new BadRequest('Invalid CAPTCHA');
          // }

          if (context.data.password) {
            const passwordValidation = validatePasswordStrength(context.data.password);
            if (!passwordValidation.isValid) {
              throw new BadRequest(passwordValidation.errors.join(', '));
            }
            // Hash the password and set password
            context.data.password = await bcrypt.hash(context.data.password, 12);
            // Remove the plain password and captcha
            // context.data.password = context.data.passwordHash;
            // delete context.data.password;
            delete context.data.captcha;
          }
          return context;
        },
        schemaHooks.resolveData(userDataResolver),
      ],
      update: [
        authenticate('jwt'), // Authenticate update operations
        async (context: any) => {
          if (context.data.roles && (!context.params.user || !context.params.user.roles.includes('admin'))) {
            throw new Forbidden('Only administrators can update user roles.');
          }
          if (context.data.password) {
            const passwordValidation = validatePasswordStrength(context.data.password);
            if (!passwordValidation.isValid) {
              throw new BadRequest(passwordValidation.errors.join(', '));
            }
            // Hash the password and set password
            context.data.password = await bcrypt.hash(context.data.password, 12);
            // Remove the plain password
            delete context.data.password;
          }
          return context;
        },
        schemaHooks.resolveData(userDataResolver),
      ],
      patch: [
        authenticate('jwt'), // Authenticate patch operations
        async (context: any) => {
          if (context.data.roles && (!context.params.user || !context.params.user.roles.includes('admin'))) {
            throw new Forbidden('Only administrators can update user roles.');
          }
          if (context.data.password) {
            const passwordValidation = validatePasswordStrength(context.data.password);
            if (!passwordValidation.isValid) {
              throw new BadRequest(passwordValidation.errors.join(', '));
            }
            // Hash the password and set password
            context.data.password = await bcrypt.hash(context.data.password, 12);
            // Remove the plain password
            delete context.data.password;
          }
          return context;
        },
        schemaHooks.resolveData(userDataResolver),
      ],
      remove: [authenticate('jwt')], // Authenticate remove operations
    },
    after: {
      all: [
        async (context: any) => {
          if (context.result && context.result.password) {
            delete context.result.password;
          }
          return context;
        },
      ],
    },
  });
}
