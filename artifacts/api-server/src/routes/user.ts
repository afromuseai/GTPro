import { Router } from "express";
import { getAuth } from "@clerk/express";
import { GetUserProfileResponse, GetLinkedAccountsResponse } from "@workspace/api-zod";

const userRouter = Router();

userRouter.get("/user/profile", (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }

  const profile = GetUserProfileResponse.parse({
    id: auth.userId,
    email: "",
    displayName: "Trader",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  });

  res.json(profile);
});

userRouter.get("/user/linked-accounts", (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }

  const accounts = GetLinkedAccountsResponse.parse([]);

  res.json(accounts);
});

export default userRouter;
