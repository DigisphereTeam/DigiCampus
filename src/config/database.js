import pg, { types } from "pg";

// import "dotenv/config";

types.setTypeParser(1082, (value) => value);

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  ssl: process.env.NODE_ENV === "production"
    ? {
      rejectUnauthorized: false,
    }
    : false,
});

export default pool;