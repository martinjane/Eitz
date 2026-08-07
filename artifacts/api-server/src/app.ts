import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalLimiter } from "./lib/rateLimiter";

const app: Express = express();

// The app runs behind Replit's reverse proxy. Trust its forwarded client IP
// so express-rate-limit can apply limits consistently without proxy warnings.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Advertisement images are sent as base64 data URLs (up to 500 KB), so the
// default Express JSON limit (~100 KB) rejects valid ad creation requests
// before they reach the route handler.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", globalLimiter);
app.use("/api", router);

export default app;
