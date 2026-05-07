import { Router, type IRouter } from "express";
import healthRouter        from "./health";
import dashboardRouter     from "./dashboard";
import userRouter          from "./user";
import abfRouter           from "./abf";
import chatRouter          from "./chat";
import marketRouter        from "./market";
import exchangeRouter      from "./exchange";
import adminRouter         from "./admin";
import billingRouter       from "./billing";
import auth2faRouter       from "./auth-2fa";
import fleetRouter, { fleetMiddleware } from "./fleet";
import journalRouter       from "./journal";
import notificationsRouter from "./notifications";
import backtestRouter      from "./backtest";
import alertsRouter        from "./alerts";
import referralRouter      from "./referral";

const router: IRouter = Router();

// Real-time fleet monitoring middleware (tracks every API request)
router.use(fleetMiddleware);

router.use(healthRouter);
router.use(dashboardRouter);
router.use(userRouter);
router.use(abfRouter);
router.use(chatRouter);
router.use(marketRouter);
router.use(exchangeRouter);
router.use(adminRouter);
router.use(billingRouter);
router.use(auth2faRouter);
router.use(fleetRouter);
router.use(journalRouter);
router.use(notificationsRouter);
router.use(backtestRouter);
router.use(alertsRouter);
router.use(referralRouter);

export default router;
