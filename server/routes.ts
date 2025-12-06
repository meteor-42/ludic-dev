import type { Express } from "express";
import { createServer, type Server } from "http";
import PocketBase from "pocketbase";
import { storage } from "./storage";
import { insertBetSchema } from "@shared/schema";
import { db } from "./db";

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

      const user = {
        id: authData.record.id,
        email: authData.record.email,
        name: authData.record.name || authData.record.username,
        avatar: authData.record.avatar,
        created: authData.record.created,
        updated: authData.record.updated,
      };

      // Create wallet if not exists
      let wallet = await storage.getWalletByUserId(authData.record.id);
      if (!wallet) {
        wallet = await storage.createWallet(authData.record.id);
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
        
        const user = {
          id: authData.record.id,
          email: authData.record.email,
          name: authData.record.name || authData.record.username,
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

      const response: any = { balance: wallet.balance };
      if (auth.newToken) {
        response.newToken = auth.newToken;
      }

      res.json(response);
    } catch (error) {
      console.error("Get wallet error:", error);
      res.status(500).json({ message: "Ошибка получения баланса" });
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

  return httpServer;
}
