import { Type } from "@feathersjs/typebox";
export const userSchema = Type.Object({
    id: Type.Optional(Type.String()),
    email: Type.String({ format: "email" }),
    password: Type.String({ minLength: 8 }), // Add minLength validation
    roles: Type.Optional(Type.Array(Type.String())),
    resetToken: Type.Optional(Type.String()),
    resetTokenExpires: Type.Optional(Type.String({ format: "date-time" })),
    createdAt: Type.Optional(Type.String({ format: "date-time" })),
    updatedAt: Type.Optional(Type.String({ format: "date-time" })),
});
export const userDataSchema = Type.Pick(userSchema, [
    "email",
    "password",
    "roles",
    "resetToken",
    "resetTokenExpires",
]);
export const userPatchSchema = Type.Partial(userDataSchema);
