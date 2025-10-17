import { resolve } from '@feathersjs/schema';
import { Type } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';
import type { HookContext } from '@feathersjs/feathers';

export const refreshTokenSchema = Type.Object({
  id: Type.Optional(Type.String()),
  userId: Type.String(),
  user: Type.Optional(Type.Any()), // Will be resolved separately
  tokenHash: Type.String(),
  deviceInfo: Type.Optional(Type.Any()),
  ipAddress: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
  expiresAt: Type.String({ format: 'date-time' }),
  lastUsedAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type RefreshToken = Static<typeof refreshTokenSchema>;

export const refreshTokenDataSchema = Type.Pick(refreshTokenSchema, [
  'userId',
  'tokenHash',
  'deviceInfo',
  'ipAddress',
  'expiresAt',
]);

export type RefreshTokenData = Static<typeof refreshTokenDataSchema>;

export const refreshTokenPatchSchema = Type.Partial(
  Type.Pick(refreshTokenSchema, ['deviceInfo', 'ipAddress', 'isActive', 'expiresAt', 'lastUsedAt']),
);

export type RefreshTokenPatch = Static<typeof refreshTokenPatchSchema>;

export const refreshTokenDataResolver = resolve<RefreshToken, HookContext>({
  properties: {},
});

export const refreshTokenExternalResolver = resolve<RefreshToken, HookContext>({
  properties: {
    // Never expose tokenHash in external responses
    tokenHash: async () => undefined,
  },
});
