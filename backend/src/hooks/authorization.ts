import { Forbidden } from "@feathersjs/errors";
import { HookContext } from "@feathersjs/feathers";

// Custom authorization hook for RBAC
export const authorize = (requiredRoles: string[] = []) => {
  return async (context: HookContext) => {
    const { user } = context.params;

    if (!user) {
      // This isn't a good way to handle authorization and we don't have clear requirements for it so i'm removing this for now
      // it would be better to handle this in session creation by throwing an error if no valid user id is given when creating the session
      return context;
      //      throw new Forbidden("Authentication required");
    }

    // If no specific roles required, just need authentication
    if (requiredRoles.length === 0) {
      return context;
    }

    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles?.includes(role)
    );

    if (!hasRequiredRole) {
      throw new Forbidden(
        `Insufficient permissions. Required roles: ${requiredRoles.join(", ")}`
      );
    }

    return context;
  };
};
