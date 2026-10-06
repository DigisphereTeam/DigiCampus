import pg, { types } from "pg";
import { config } from "./env.js";

types.setTypeParser(1082, (value) => value);

const { Pool } = pg;

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,

  // options: "-c timezone=Asia/Kolkata",

  ssl:
    config.nodeEnv === "production"
      ? {
        rejectUnauthorized: false,
      }
      : false,
});

export default pool;