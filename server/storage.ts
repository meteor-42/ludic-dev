import { wallets, bets, type Wallet, type InsertWallet, type Bet, type InsertBet } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Wallets
  getWalletByUserId(userId: string): Promise<Wallet | undefined>;
  createWallet(userId: string): Promise<Wallet>;
  updateBalance(userId: string, newBalance: string): Promise<Wallet | undefined>;
  
  // Bets
  createBet(bet: InsertBet & { potentialWin: string }): Promise<Bet>;
  getBetsByUserId(userId: string): Promise<Bet[]>;
  getBetById(id: number): Promise<Bet | undefined>;
  updateBetStatus(id: number, status: string, result?: string): Promise<Bet | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Wallets
  async getWalletByUserId(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet || undefined;
  }

  async createWallet(userId: string): Promise<Wallet> {
    const [wallet] = await db
      .insert(wallets)
      .values({ userId, balance: "1000.00" })
      .returning();
    return wallet;
  }

  async updateBalance(userId: string, newBalance: string): Promise<Wallet | undefined> {
    const [wallet] = await db
      .update(wallets)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(wallets.userId, userId))
      .returning();
    return wallet || undefined;
  }

  // Bets
  async createBet(bet: InsertBet & { potentialWin: string }): Promise<Bet> {
    const [newBet] = await db
      .insert(bets)
      .values({
        userId: bet.userId,
        eventName: bet.eventName,
        selection: bet.selection,
        odds: bet.odds,
        amount: bet.amount,
        potentialWin: bet.potentialWin,
        status: "pending",
      })
      .returning();
    return newBet;
  }

  async getBetsByUserId(userId: string): Promise<Bet[]> {
    return db
      .select()
      .from(bets)
      .where(eq(bets.userId, userId))
      .orderBy(desc(bets.createdAt));
  }

  async getBetById(id: number): Promise<Bet | undefined> {
    const [bet] = await db.select().from(bets).where(eq(bets.id, id));
    return bet || undefined;
  }

  async updateBetStatus(id: number, status: string, result?: string): Promise<Bet | undefined> {
    const [bet] = await db
      .update(bets)
      .set({ 
        status, 
        result: result || null,
        settledAt: status !== "pending" ? new Date() : null 
      })
      .where(eq(bets.id, id))
      .returning();
    return bet || undefined;
  }
}

export const storage = new DatabaseStorage();
