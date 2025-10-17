import { Prisma, Role } from '@prisma/client';
import { BadRequest } from '@feathersjs/errors';
import { UserData, PrismaUserType } from './users.schema';

/**
 * @fileoverview User utility functions for data transformation and validation
 */

/**
 * Normalizes roles to ensure they are always an array of uppercase Role enum values
 * @param roles - The roles to normalize (can be string, string array, or undefined)
 * @returns Array of Role enum values
 */
export function normalizeRoles(roles?: string | string[]): Role[] {
  if (!roles) {
    return [Role.USER];
  }

  if (Array.isArray(roles)) {
    return roles.map((role: string) => {
      const upperRole = role.toUpperCase();
      if (upperRole === 'USER') return Role.USER;
      if (upperRole === 'ADMIN') return Role.ADMIN;
      if (upperRole === 'BROADCASTER') return Role.BROADCASTER;
      throw new Error(`Invalid role: ${role}`);
    });
  }

  const upperRole = roles.toUpperCase();
  if (upperRole === 'USER') return [Role.USER];
  if (upperRole === 'ADMIN') return [Role.ADMIN];
  if (upperRole === 'BROADCASTER') return [Role.BROADCASTER];
  throw new Error(`Invalid role: ${roles}`);
}

/**
 * Builds Prisma where clause for user queries
 * @param params - Query parameters containing email and roles filters
 * @returns Prisma where input object
 */
export function buildUserWhereClause(params?: { email?: string; roles?: Role[] }): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (params?.email) {
    where.email = params.email;
  }

  if (params?.roles) {
    where.roles = {
      hasSome: params.roles,
    };
  }

  return where;
}

/**
 * Creates a mock user for testing when database is unavailable
 * @param data - User data for the mock user
 * @returns Complete Prisma user object for testing
 */
export function createMockUser(data: UserData): PrismaUserType {
  return {
    id: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: data.email,
    password: data.password,
    roles: normalizeRoles(data.roles),
    isActive: true,
    emailVerified: false,
    lastLoginAt: null,
    loginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    resetToken: null,
    resetTokenExpires: null,
    refreshTokens: [],
    hostedSessions: [],
    participatedSessions: [],
  } as PrismaUserType;
}

/**
 * Prepares user data for Prisma create operation
 * @param data - Raw user data from request
 * @returns Processed data ready for Prisma create
 */
export function prepareUserCreateData(data: UserData): Prisma.UserCreateInput {
  return {
    email: data.email,
    password: data.password,
    roles: normalizeRoles(data.roles),
  };
}

/**
 * Prepares user data for Prisma update operation
 * @param data - Raw user data for update
 * @returns Processed data ready for Prisma update
 */
export function prepareUserUpdateData(data: Partial<UserData>): Prisma.UserUpdateInput {
  const processedData: Prisma.UserUpdateInput = {};

  if (data.email !== undefined) {
    processedData.email = data.email;
  }

  if (data.password !== undefined) {
    processedData.password = data.password;
  }

  if (data.roles !== undefined) {
    processedData.roles = normalizeRoles(data.roles);
  }

  return processedData;
}

/**
 * Throws a BadRequest error if the user is not found
 * @param user - The user object or null
 * @returns The user if found, otherwise throws error
 */
export function handleNoUserFound(user: any) {
  if (!user) {
    throw new BadRequest('No user found');
  }
  return user;
}

/**
 * Throws a BadRequest error if the specified key is missing or null/undefined in the object
 * @param object - The object to check
 * @param keyToCheck - The key to check for existence and value
 * @param errorMessage - The error message to throw if the key is missing or invalid
 */
export function handleMissingValue(object: any, keyToCheck: string, errorMessage: string) {
  if (!(keyToCheck in object) || object[keyToCheck] == null) {
    throw new BadRequest(errorMessage);
  }
}

// make function for handle null value
export function handleNullValue(value: any, errorMessage: string) {
  if (value === null) {
    throw new BadRequest(errorMessage);
  }
}
