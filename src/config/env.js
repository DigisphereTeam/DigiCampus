import "dotenv/config";

const errors = {};

const requiredEnv = [
  "PORT",
  "JWT_SECRET",
  "DB_USER",
  "DB_NAME",
  "DB_HOST",
  "DB_PASSWORD",
  "DB_PORT",
  "NODE_ENV",
];

// Required variables
for (const key of requiredEnv) {
  if (!process.env[key]?.trim()) {
    errors[key] = `${key} is required`;
  }
}

// Validate application port
const port = Number(process.env.PORT);

if (
  process.env.PORT &&
  (!Number.isInteger(port) || port < 1 || port > 65535)
) {
  errors.PORT = "Invalid application port";
}

// Validate database port
const dbPort = Number(process.env.DB_PORT);

if (
  process.env.DB_PORT &&
  (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535)
) {
  errors.DB_PORT = "Invalid database port";
}

// Validate environment
const validEnvironments = ["development", "production", "test"];

if (
  process.env.NODE_ENV &&
  !validEnvironments.includes(process.env.NODE_ENV)
) {
  errors.NODE_ENV =
    "Invalid NODE_ENV. Use development, production, or test";
}

// Stop application if validation fails
if (Object.keys(errors).length > 0) {
  console.error("Environment validation failed:");
  console.error(errors);
  process.exit(1);
}

// Export validated configuration
export const config = {
  port,

  jwtSecret: process.env.JWT_SECRET,

  db: {
    user: process.env.DB_USER,
    name: process.env.DB_NAME,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: dbPort,
  },

  nodeEnv: process.env.NODE_ENV,
};
