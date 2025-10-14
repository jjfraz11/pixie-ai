import { LocalStrategy } from "@feathersjs/authentication-local";
import { AuthenticationService, JWTStrategy } from "@feathersjs/authentication";
export default function configureAuthenticationService(app) {
    console.log("Authentication entity setting:", app.get("authentication").entity); // Log entity setting
    const authentication = new AuthenticationService(app);
    authentication.register("jwt", new JWTStrategy());
    authentication.register("local", new LocalStrategy());
    app.use("/authentication", authentication);
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
                async (context) => {
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
                async (context) => {
                    console.error(`Error in authentication service on method ${context.method}:`, context.error);
                    return context;
                },
            ],
        },
    });
    return authentication;
}
