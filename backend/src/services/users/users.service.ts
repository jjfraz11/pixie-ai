import { Application, Params, NullableId } from '@feathersjs/feathers';
import { PrismaClient } from '@prisma/client';
import { BadRequest } from '@feathersjs/errors';

import { configureUserHooks } from './users.hooks';
import { UserData, UserPatch, PrismaUserType } from './users.schema';
import {
  buildUserWhereClause,
  prepareUserCreateData,
  prepareUserUpdateData,
  handleNoUserFound,
  handleNullValue,
} from './user.utils';

// Types
interface UserServiceOptions {
  paginate?: any;
}

export class UserService {
  app: Application;
  options: UserServiceOptions;
  prisma: PrismaClient;

  constructor(options: UserServiceOptions, app: Application) {
    this.options = options;
    this.app = app;
    this.prisma = (app.get('prisma') as PrismaClient) || new PrismaClient();
  }

  async find(params?: Params): Promise<PrismaUserType[]> {
    const { $limit = 10, email, roles, ...data } = params?.query || {};

    // Build where clause for filtering using utility function
    const where = buildUserWhereClause({ email, roles });

    return this.prisma.user.findMany({
      take: $limit,
      where: Object.keys(where).length > 0 ? where : undefined,
    });
  }

  async get(id: string, params?: Params): Promise<PrismaUserType> {
    handleNullValue(id, 'Missing id.');

    return this.prisma.user
      .findUnique({
        where: { id },
      })
      .then((user) => {
        if (user === null) {
          throw new BadRequest('No user found');
        } else {
          return user;
        }
      });
  }

  async create(data: UserData, params?: Params): Promise<PrismaUserType> {
    const processedData = prepareUserCreateData(data);
    return this.prisma.user.create({ data: processedData }).then((user) => handleNoUserFound(user));
  }

  async update(id: NullableId, data: UserPatch, params?: Params): Promise<PrismaUserType> {
    handleNullValue(id, 'Missing id.');

    // Prepare data for Prisma update operation using utility function
    const processedData = prepareUserUpdateData(data);
    return this.prisma.user
      .update({
        where: { id: id as string },
        data: processedData,
      })
      .then((user) => handleNoUserFound(user));
  }

  async patch(id: NullableId, data: UserPatch, params?: Params): Promise<PrismaUserType> {
    handleNullValue(id, 'Missing id.');

    // Prepare data for Prisma update operation using utility function
    const processedData = prepareUserUpdateData(data);

    return this.prisma.user
      .update({
        where: { id: id as string },
        data: processedData,
      })
      .then((user) => handleNoUserFound(user));
  }

  async remove(id: NullableId, params?: Params): Promise<PrismaUserType> {
    handleNullValue(id, 'Missing id.');

    return this.prisma.user.delete({ where: { id: id as string } });
  }
}

export default function configureUsersService(app: Application) {
  const options: UserServiceOptions = {
    paginate: app.get('paginate'),
  };

  app.use('/users', new UserService(options, app));

  // Configure hooks using the dedicated hooks file
  const service = app.service('users');
  configureUserHooks(service);
}
