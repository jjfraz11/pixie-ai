import { LocalStrategy } from "@feathersjs/authentication-local";
import { AuthenticationService, JWTStrategy } from "@feathersjs/authentication";
import { Application } from "@feathersjs/feathers";
import configurePasswordResetService from "./password-reset.service";

export default function configureAuthenticationService(app: Application) {
  console.log(
    "Authentication entity setting:",
    app.get("authentication").entity
  ); // Log entity setting
  const authentication = new AuthenticationService(app);

  authentication.register("jwt", new JWTStrategy());
  authentication.register("local", new LocalStrategy());

  app.use("/authentication", authentication);

  // Configure password reset service as part of authentication
  configurePasswordResetService(app);

  // CAPTCHA integration placeholder
  // In a production environment, integrate with Google reCAPTCHA or similar
  // For now, rate limiting provides basic brute-force protection

  // CAPTCHA integration for brute-force protection
  // Note: In a real application, integrate with a CAPTCHA service like reCAPTCHA
  // For now, we'll rely on rate limiting implemented in app.ts

  // Add hooks to the authentication service
  app.service("authentication").hooks({
    before: {
      create: [
        async (context: any) => {
          // Log authentication attempts for debugging
          console.log("Authentication attempt:", {
            strategy: context.data?.strategy,
            email: context.data?.email,
          });
          return context;
        },
      ],
    },
    error: {
      all: [
        async (context: any) => {
          console.error(
            `Error in authentication service on method ${context.method}:`,
            context.error
          );
          return context;
        },
      ],
    },
  });

  return authentication;
}
