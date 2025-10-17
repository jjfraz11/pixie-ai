import { resolve } from '@feathersjs/schema';
import { passwordHash } from '@feathersjs/authentication-local';
import { Type } from '@feathersjs/typebox';
import { Static } from '@feathersjs/typebox';
import type { HookContext } from '@feathersjs/feathers';
import { Prisma, User as PrismaUser } from '@prisma/client';

// Base Prisma User type for database operations
export type PrismaUserType = PrismaUser;

// Prisma input/output types for service operations
export type PrismaUserCreateInput = Prisma.UserCreateInput;
export type PrismaUserUpdateInput = Prisma.UserUpdateInput;
export type PrismaUserWhereInput = Prisma.UserWhereInput;
export type PrismaUserWhereUniqueInput = Prisma.UserWhereUniqueInput;

// Extended user type for Feathers service (matches schema definition)
export type User = Static<typeof userSchema>;

// User data for creation (excludes system-managed fields)
export type UserData = Pick<PrismaUserType, 'email' | 'password' | 'roles'> & {
  // Add any additional creation fields here if needed
};

// User data for updates (partial of UserData)
export type UserPatch = Partial<UserData>;

// Schema definitions for validation
export const userSchema = Type.Object({
  id: Type.Optional(Type.String()),
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  roles: Type.Optional(Type.Array(Type.String())),
  resetToken: Type.Optional(Type.String()),
  resetTokenExpires: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.Optional(Type.String({ format: 'date-time' })),
  updatedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export const userDataSchema = Type.Pick(userSchema, ['email', 'password', 'roles']);

export const userPatchSchema = Type.Partial(userDataSchema);

// Resolver for user data
export const userDataResolver = resolve<User, HookContext>({
  properties: {},
});

// External resolver for hashing passwords (for PrismaUserType)
export const userExternalResolver = resolve<PrismaUserType, HookContext>({
  properties: {
    password: passwordHash({ strategy: 'local', service: '/authentication' }),
  },
});

// Legacy type exports for backward compatibility
export type LegacyUser = Static<typeof userSchema>;
export type LegacyUserData = Static<typeof userDataSchema>;
export type LegacyUserPatch = Static<typeof userPatchSchema>;
