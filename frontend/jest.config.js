const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  setupFiles: ["<rootDir>/jest.polyfills.js"],
  moduleNameMapper: {
    "^@/contexts/AuthContext$": "<rootDir>/app/contexts/AuthContext.tsx",
    "^@/(.*)$": "<rootDir>/app/$1",
    "\\.css$": "identity-obj-proxy",
    "^jose$|@livekit/components-styles|@livekit/components-react$": "identity-obj-proxy",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(livekit-server-sdk|jose|@livekit/components-react|@livekit/components-styles))",
  ],
};

module.exports = createJestConfig(config);
