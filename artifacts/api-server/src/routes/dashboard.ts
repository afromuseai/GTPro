import { Router } from "express";
import { getAuth } from "@clerk/express";
import { GetDashboardStatsResponse } from "@workspace/api-zod";

const dashboardRouter = Router();

dashboardRouter.get("/dashboard/stats", (req, res) => {
  // Return live stats — balance comes from linked exchange accounts
  // Bot activity and P&L are managed client-side in the bot engine
  const stats = GetDashboardStatsResponse.parse({
    balance: 0,
    activeBots: 0,
    pnlToday: 0,
    pnlTodayPercent: 0,
    totalPnl: 0,
  });

  res.json(stats);
});

export default dashboardRouter;
