import { resolve } from '@feathersjs/schema';
import { passwordHash } from '@feathersjs/authentication-local';
import { Type } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';
import type { HookContext } from '@feathersjs/feathers';

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

export type User = Static<typeof userSchema>;

export const userDataSchema = Type.Pick(userSchema, [
  'email',
  'password',
  'roles',
]);
export type UserData = Static<typeof userDataSchema>;

export const userPatchSchema = Type.Partial(userDataSchema);
export type UserPatch = Static<typeof userPatchSchema>;

export const userDataResolver = resolve<User, HookContext>({
  properties: {},
});

export const userExternalResolver = resolve<User, HookContext>({
  properties: {
    password: passwordHash({ strategy: 'local', service: '/authentication' }),
  },
});
