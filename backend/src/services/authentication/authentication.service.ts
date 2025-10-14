import { LocalStrategy } from "@feathersjs/authentication-local";
import { AuthenticationService, JWTStrategy } from "@feathersjs/authentication";
import { Application } from "@feathersjs/feathers";

export default function configureAuthenticationService(app: Application) {
  console.log(
    "Authentication entity setting:",
    app.get("authentication").entity
  ); // Log entity setting
  const authentication = new AuthenticationService(app);

  authentication.register("jwt", new JWTStrategy());
  authentication.register("local", new LocalStrategy());

  app.use("/authentication", authentication);

  // Add password reset request endpoint
  app.post('/authentication/reset-password', async (req: any, res: any) => {
    try {
      const { email } = req.body;
      // In a real app, you would:
      // 1. Find the user by email
      // 2. Generate a unique reset token
      // 3. Store the token (with expiration) in the database
      // 4. Send an email to the user with the reset link (containing the token)
      console.log(`Password reset requested for: ${email}`);
      res.status(200).json({ message: 'If a matching account is found, a password reset email will be sent.' });
    } catch (error: any) {
      console.error('Error requesting password reset:', error);
      res.status(500).json({ message: 'Failed to request password reset.' });
    }
  });

  // Add password change endpoint
  app.post('/authentication/change-password', async (req: any, res: any) => {
    try {
      const { token, password } = req.body;
      // In a real app, you would:
      // 1. Verify the reset token
      // 2. Find the user associated with the token
      // 3. Hash the new password
      // 4. Update the user's password in the database
      // 5. Invalidate the reset token
      console.log(`Password change requested for token: ${token}`);
      res.status(200).json({ message: 'Password successfully changed.' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Failed to change password.' });
    }
  });

  // Rate limiting for authentication endpoint
  // const authLimiter = rateLimit({
  //   windowMs: 15 * 60 * 1000, // 15 minutes
  //   max: 100, // Limit each IP to 100 requests per windowMs
  //   message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  //   standardHeaders: true,
  //   legacyHeaders: false,
  // });

  // Apply rate limiting to the authentication service (simplified for now)
  // app.service('authentication').hooks({
  //   before: {
  //     create: [authLimiter],
  //     remove: [authLimiter],
  //   },
  // });

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
