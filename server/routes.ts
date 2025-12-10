import type { Express } from "express";
import { createServer, type Server } from "http";
import PocketBase from "pocketbase";
import { storage } from "./storage";
import { insertBetSchema, wallets as walletsTable, bets as betsTable } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Events upstream base URL
const EVENTS_API_URL = process.env.EVENTS_API_URL || "http://localhost:5050";

function createPocketBaseClient() {
  return new PocketBase(process.env.POCKETBASE_URL);
}

interface VerifyResult {
  userId: string;
  newToken?: string;
}

async function verifyToken(authHeader: string | undefined): Promise<VerifyResult | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  const pb = createPocketBaseClient();

  try {
    pb.authStore.save(token, null);
    const authData = await pb.collection("users").authRefresh();
    return {
      userId: authData.record.id,
      newToken: authData.token !== token ? authData.token : undefined,
    };
  } catch {
    return null;
  } finally {
    pb.authStore.clear();
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const pb = createPocketBaseClient();

    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: "Email и пароль обязательны"
        });
      }

      const authData = await pb.collection("users").authWithPassword(email, password);

      // Get display_name from PocketBase, fallback to name, username, or email
      const displayName = authData.record.display_name || authData.record.name || authData.record.username || authData.record.email.split('@')[0];

      const user = {
        id: authData.record.id,
        email: authData.record.email,
        name: displayName,
        avatar: authData.record.avatar,
        created: authData.record.created,
        updated: authData.record.updated,
      };

      // Create wallet if not exists
      let wallet = await storage.getWalletByUserId(authData.record.id);
      if (!wallet) {
        wallet = await storage.createWallet(authData.record.id, displayName);
      } else if (wallet.userName !== displayName) {
        // Update user name if it changed
        await storage.updateUserName(authData.record.id, displayName || "");
      }

      res.json({
        user,
        token: authData.token,
      });
    } catch (error: any) {
      console.error("Login error:", error);

      if (error?.status === 400) {
        return res.status(401).json({
          message: "Неверный email или пароль"
        });
      }

      res.status(500).json({
        message: "Ошибка сервера при авторизации"
      });
    } finally {
      pb.authStore.clear();
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const pb = createPocketBaseClient();

    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          message: "Требуется авторизация"
        });
      }

      const token = authHeader.split(" ")[1];

      pb.authStore.save(token, null);

      try {
        const authData = await pb.collection("users").authRefresh();

        // Get display_name from PocketBase, fallback to name, username, or email
        const displayName = authData.record.display_name || authData.record.name || authData.record.username || authData.record.email.split('@')[0];

        const user = {
          id: authData.record.id,
          email: authData.record.email,
          name: displayName,
          avatar: authData.record.avatar,
          created: authData.record.created,
          updated: authData.record.updated,
        };

        res.json({ user, token: authData.token });
      } catch {
        return res.status(401).json({
          message: "Недействительный токен"
        });
      }
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({
        message: "Ошибка проверки авторизации"
      });
    } finally {
      pb.authStore.clear();
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.json({ message: "Выход выполнен успешно" });
  });

  // Wallet routes
  app.get("/api/wallet", async (req, res) => {
    try {
      const auth = await verifyToken(req.headers.authorization);
      if (!auth) {
        return res.status(401).json({ message: "Требуется авторизация" });
      }

      let wallet = await storage.getWalletByUserId(auth.userId);
      if (!wallet) {
        wallet = await storage.createWallet(auth.userId);
      }

      const response: any = { balance: wallet.balance, topUpCount: wallet.topUpCount || 0 };
      if (auth.newToken) {
        response.newToken = auth.newToken;
      }

      res.json(response);
    } catch (error) {
      console.error("Get wallet error:", error);
      res.status(500).json({ message: "Ошибка получения баланса" });
    }
  });

  app.post("/api/wallet/topup", async (req, res) => {
    try {
      const auth = await verifyToken(req.headers.authorization);
      if (!auth) {
        return res.status(401).json({ message: "Требуется авторизация" });
      }

      let wallet = await storage.getWalletByUserId(auth.userId);
      if (!wallet) {
        wallet = await storage.createWallet(auth.userId);
      }

      const current = parseFloat(wallet.balance);
      const newBalance = (current + 1000).toFixed(2);
      const updatedWallet = await storage.incrementTopUpCount(auth.userId, newBalance);

      res.json({ balance: newBalance, topUpCount: updatedWallet?.topUpCount || 0 });
    } catch (error) {
      console.error("Top up error:", error);
      res.status(500).json({ message: "Ошибка пополнения баланса" });
    }
  });

  // Bets routes
  app.get("/api/bets", async (req, res) => {
    try {
      const auth = await verifyToken(req.headers.authorization);
      if (!auth) {
        return res.status(401).json({ message: "Требуется авторизация" });
      }

      const bets = await storage.getBetsByUserId(auth.userId);
      res.json(bets);
    } catch (error) {
      console.error("Get bets error:", error);
      res.status(500).json({ message: "Ошибка получения ставок" });
    }
  });

  app.post("/api/bets", async (req, res) => {
    try {
      const auth = await verifyToken(req.headers.authorization);
      if (!auth) {
        return res.status(401).json({ message: "Требуется авторизация" });
      }

      const parseResult = insertBetSchema.safeParse({
        ...req.body,
        userId: auth.userId,
      });

      if (!parseResult.success) {
        return res.status(400).json({
          message: "Некорректные данные ставки",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      // Validate event status (only upcoming allowed)
      const requestedEventId = Number(req.body?.eventId);
      if (!requestedEventId || Number.isNaN(requestedEventId)) {
        return res.status(400).json({ message: "Не указан идентификатор события" });
      }
      const upstream = `${EVENTS_API_URL.replace(/\/$/, "")}/events`;
      const evResp = await fetch(upstream, { headers: { Accept: "application/json" } });
      if (!evResp.ok) {
        return res.status(502).json({ message: "Ошибка получения статуса события" });
      }
      const evData: any = await evResp.json();
      const found = Array.isArray(evData?.events)
        ? evData.events.find((e: any) => Number(e.eventId) === requestedEventId)
        : null;
      if (!found) {
        return res.status(404).json({ message: "Событие не найдено" });
      }
      if (found.status !== "upcoming") {
        return res.status(400).json({ message: "Ставки на это событие недоступны" });
      }

      const { eventName, selection, odds, amount, userId } = parseResult.data;

      // Check balance
      const wallet = await storage.getWalletByUserId(auth.userId);
      if (!wallet) {
        return res.status(400).json({ message: "Кошелёк не найден" });
      }

      const currentBalance = parseFloat(wallet.balance);
      const betAmount = parseFloat(amount);

      if (betAmount <= 0) {
        return res.status(400).json({ message: "Сумма ставки должна быть положительной" });
      }

      if (betAmount < 1) {
        return res.status(400).json({ message: "Минимальная ставка — 1 рубль" });
      }

      if (betAmount !== Math.floor(betAmount)) {
        return res.status(400).json({ message: "Ставка должна быть целым числом (кратным 1 рублю)" });
      }

      if (betAmount > currentBalance) {
        return res.status(400).json({ message: "Недостаточно средств" });
      }

      // Calculate potential win
      const potentialWin = (betAmount * parseFloat(odds)).toFixed(2);
      const newBalance = (currentBalance - betAmount).toFixed(2);

      // Create bet first, then update balance (if bet fails, balance unchanged)
      const bet = await storage.createBet({
        userId,
        eventName,
        selection,
        odds,
        amount,
        potentialWin,
      });

      // Update balance only after bet is successfully created
      await storage.updateBalance(auth.userId, newBalance);

      res.json(bet);
    } catch (error) {
      console.error("Create bet error:", error);
      res.status(500).json({ message: "Ошибка создания ставки" });
    }
  });

  // Events routes (proxy to external events service)
  app.get("/api/events", async (_req, res) => {
    try {
      const upstream = `${EVENTS_API_URL.replace(/\/$/, "")}/events`;
      const resp = await fetch(upstream, { headers: { Accept: "application/json" } });
      if (!resp.ok) {
        return res.status(502).json({ message: "Upstream events API error", status: resp.status });
      }
      const data = await resp.json();
      return res.json(data);
    } catch (err) {
      console.error("Events upstream error:", err);
      return res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Leaderboard: aggregate balances and betting accuracy per user
  app.get("/api/leaderboard", async (_req, res) => {
    try {
      // fetch all wallets and bets, then aggregate in-memory
      const allWallets = await db.select().from(walletsTable);
      const allBets = await db.select().from(betsTable);

      const byUser: Record<string, { total: number; wins: number }> = {};
      for (const b of allBets) {
        const u = b.userId;
        if (!byUser[u]) byUser[u] = { total: 0, wins: 0 };
        byUser[u].total += 1;
        if (b.status === "won") byUser[u].wins += 1;
      }

      const rows = allWallets.map((w) => {
        const agg = byUser[w.userId] || { total: 0, wins: 0 };
        const accuracy = agg.total > 0 ? Math.round((agg.wins / agg.total) * 100) : 0;
        return {
          userId: w.userId,
          userName: w.userName || w.userId,
          balance: w.balance,
          totalBets: agg.total,
          winRate: accuracy,
        };
      });

      rows.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
      res.json({ leaders: rows.slice(0, 50) });
    } catch (err) {
      console.error("Leaderboard error:", err);
      res.status(500).json({ message: "Failed to build leaderboard" });
    }
  });

  return httpServer;
}
