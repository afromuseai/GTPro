import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const clerkPublishableKey =
  process.env.CLERK_PUBLISHABLE_KEY ??
  process.env.VITE_CLERK_PUBLISHABLE_KEY;

// Use the legible-dove-55 RSA public key for local (offline) JWT verification.
// This allows the server to verify tokens issued by the frontend Clerk instance
// without needing its secret key. Key fetched from:
// https://legible-dove-55.clerk.accounts.dev/.well-known/jwks.json
const CLERK_JWT_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApP2DaoBTxWId10+GAbCa
79ZYy5MLyVkiVQfZudRs0P1OJo22s7PSimgFwLAsBIqqL37s8LzfCFC7Eds6/BBd
uC2ya1sD8rTOM/LFum1M7wdn5oudrBy+b8vSAbH4Ka9Sh6LWIqNLsFjmS9zMbcFg
Xpj/t4ATzU1pjr3QUOQtnvGk2c9gyHEEF6PsRuXL/z9SNa9XRmpFNAlBERZcJzw5
cQHbzCTRvbWXLw0qWv9VlCEPrymyiO3JeJpthzhGKgtnYGIwQlfDejpMhliLEmdu
M6A67/UhPjGx9F52p3idRwmUtUmy9kgPBX0huAmRRk/F79HEHSO5ZKBq+JArTaI9
PwIDAQAB
-----END PUBLIC KEY-----`;

app.use(clerkMiddleware({ publishableKey: clerkPublishableKey, jwtKey: CLERK_JWT_KEY }));

app.use("/api", router);

export default app;
