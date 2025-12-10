import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import type { Bet } from "@shared/schema";

type EventItem = {
  eventId: number;
  round: number;
  tournament: string;
  date: string;
  mskTime: string;
  team1: string;
  team2: string;
  status: "upcoming" | "live" | "finished" | "canceled" | string;
  score: null | { team1: number; team2: number };
  odds: { win1: number; draw: number; win2: number };
};

type EventsResponse = { events: EventItem[] };

type Leader = { userId: string; userName?: string; balance: string; totalBets: number; winRate: number };
type LeaderboardResponse = { leaders: Leader[] };

function formatAmount(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return String(amount);
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(dt: string | Date): string {
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return d.toLocaleString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: string) {
  switch (status) {
    case "upcoming":
      return "Upcoming";
    case "live":
      return "Live";
    case "finished":
      return "Finished";
    case "canceled":
      return "Canceled";
    default:
      return status.toUpperCase();
  }
}

export default function DashboardPage() {
  const { getAuthHeaders, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: walletData, isLoading: walletLoading } = useQuery<{ balance: string; topUpCount?: number }>({
    queryKey: ["/api/wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery<EventsResponse>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });

  const { data: betsData, isLoading: betsLoading } = useQuery<Bet[]>({
    queryKey: ["/api/bets"],
    queryFn: async () => {
      const res = await fetch("/api/bets", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch bets");
      return res.json();
    },
  });

  const balance = walletData?.balance ?? "0";
  const topUpCount = walletData?.topUpCount ?? 0;

  // Betting dialog state
  const [betOpen, setBetOpen] = useState(false);
  const [betAmount, setBetAmount] = useState("");
  const [selected, setSelected] = useState<null | {
    event: EventItem;
    selectionKey: "win1" | "draw" | "win2";
  }>(null);

  const selectedOdds = useMemo(() => {
    if (!selected) return 0;
    return selected.event.odds[selected.selectionKey];
  }, [selected]);

  async function placeBet() {
    if (!selected) return;
    const amount = parseFloat(betAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Введите корректную сумму ставки");
      return;
    }

    if (amount < 1) {
      alert("Минимальная ставка — 1 рубль");
      return;
    }

    if (amount !== Math.floor(amount)) {
      alert("Ставка должна быть целым числом (кратным 1 рублю)");
      return;
    }

    const selectionLabel =
      selected.selectionKey === "win1" ? "П1" : selected.selectionKey === "draw" ? "Н" : "П2";

    const payload = {
      eventId: selected.event.eventId,
      eventName: `${selected.event.team1} — ${selected.event.team2}`,
      selection: selectionLabel,
      odds: String(selectedOdds),
      amount: String(amount.toFixed(2)),
    };

    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.message || "Не удалось создать ставку");
      return;
    }

    setBetOpen(false);
    setBetAmount("");
    setSelected(null);
    // refresh wallet and bets
    queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
  }

  async function topUp() {
    const res = await fetch("/api/wallet/topup", { method: "POST", headers: getAuthHeaders() });
    if (!res.ok) {
      alert("Не удалось пополнить баланс");
      return;
    }
    const data = await res.json();
    queryClient.setQueryData(["/api/wallet"], (old: any) => ({ ...(old || {}), ...data }));
  }

  return (
    <Tabs defaultValue="events" className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-10 border-b-2 border-black bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <div className="text-xl font-bold tracking-widest select-none whitespace-nowrap">LUDIC.RF</div>
          <div className="flex-1 flex justify-center">
            <TabsList>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="leaders">Leaders</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-xs font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-2 border-2 border-black px-3 py-2">
              Balance: {walletLoading ? (
                <span className="inline-block align-middle"><Skeleton className="h-4 w-16" /></span>
              ) : (
                <span className="font-bold">{formatAmount(balance)}</span>
              )}
              <Button size="icon" variant="ghost" onClick={topUp} title="Top up 1000" className="h-6 w-6 border-2 border-black">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <Button variant="outline" onClick={logout} className="text-xs uppercase tracking-wider">Exit</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
          <TabsContent value="events">
            {eventsLoading ? (
              <div className="space-y-4">
                {[1,2,3,4].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (eventsData?.events?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Событий пока нет</p>
            ) : (
              <div className="space-y-4">
                {eventsData!.events.map((ev) => {
                  const bettingOpen = ev.status === "upcoming";
                  const resultText = ev.score ? `${ev.score.team1}:${ev.score.team2}` : "—";
                  return (
                    <Card key={ev.eventId} className="transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <CardHeader className="pb-0 border-b-2 border-black">
                        <div className="flex items-start justify-between gap-4 pb-4">
                          <div className="flex-1">
                            <CardTitle className="text-2xl font-bold tracking-tight mb-2">
                              {ev.team1} <span className="text-neutral-400">VS</span> {ev.team2}
                            </CardTitle>
                            <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 space-y-1">
                              <div>{ev.tournament} • Round {ev.round}</div>
                              <div>{ev.date} • {ev.mskTime} MSK</div>
                            </div>
                          </div>
                          <div className="shrink-0 text-right border-l-2 border-black pl-4">
                            <div className="text-xs font-bold uppercase tracking-wider mb-1">Status</div>
                            <div className="px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wider">{statusLabel(ev.status)}</div>
                            <div className="text-xs font-bold uppercase tracking-wider mt-2 mb-1">Score</div>
                            <div className="text-2xl font-bold">{resultText}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 pb-4">
                        <div className="grid grid-cols-3 gap-0 border-2 border-black">
                          {(["win1","draw","win2"] as const).map((key, idx) => {
                            const label = key === "win1" ? "Win 1" : key === "draw" ? "Draw" : "Win 2";
                            const odd = ev.odds[key];
                            return (
                              <button
                                key={key}
                                disabled={!bettingOpen}
                                className={`h-16 flex flex-col items-center justify-center transition-colors ${
                                  bettingOpen
                                    ? "bg-white hover:bg-black hover:text-white cursor-pointer"
                                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                                } ${idx < 2 ? "border-r-2 border-black" : ""}`}
                                onClick={() => {
                                  if (bettingOpen) {
                                    setSelected({ event: ev, selectionKey: key });
                                    setBetOpen(true);
                                  }
                                }}
                              >
                                <span className="text-[10px] font-bold uppercase tracking-widest mb-1">{label}</span>
                                <span className="text-xl font-bold">{odd}</span>
                              </button>
                            );
                          })}
                        </div>
                        {!bettingOpen && (
                          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mt-3 text-center">Betting unavailable</div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaders">
            {leaderboardLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (leaderboardData?.leaders?.length ?? 0) === 0 ? (
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">No leaders yet</p>
            ) : (
              <Card>
                <CardHeader className="border-b-2 border-black">
                  <CardTitle className="text-xl uppercase tracking-wider">Leaderboard</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-neutral-600">Balance, Bets & Win Rate</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Bets</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboardData!.leaders.map((l, idx) => (
                        <TableRow key={l.userId}>
                          <TableCell className="font-bold">{idx + 1}</TableCell>
                          <TableCell className="truncate max-w-[180px] font-medium" title={l.userName || l.userId}>{l.userName || l.userId}</TableCell>
                          <TableCell className="text-right font-bold">{formatAmount(l.balance)}</TableCell>
                          <TableCell className="text-right font-medium">{l.totalBets}</TableCell>
                          <TableCell className="text-right font-bold">{l.winRate}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            {betsLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (betsData?.length ?? 0) === 0 ? (
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">No bets yet</p>
            ) : (
              <div className="space-y-3">
                {betsData!.map((bet) => (
                  <Card key={bet.id} className="hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-base truncate max-w-[300px]" title={bet.eventName}>{bet.eventName}</div>
                        <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 mt-2 space-x-2">
                          <span>{bet.selection}</span>
                          <span>•</span>
                          <span>Odds {bet.odds}</span>
                          <span>•</span>
                          <span>{formatDateTime(bet.createdAt as unknown as string)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right border-l-2 border-black pl-4 min-w-[120px]">
                        <div className="text-lg font-bold">-{formatAmount(bet.amount)}</div>
                        <div className={`text-xs font-bold uppercase tracking-wider mt-1 px-2 py-1 ${
                          bet.status === "pending" ? "bg-neutral-200 text-black" :
                          bet.status === "won" ? "bg-black text-white" :
                          bet.status === "lost" ? "bg-neutral-400 text-black" :
                          "bg-neutral-100 text-black"
                        }`}>
                          {bet.status === "pending" ? "Pending" : bet.status === "won" ? "Won" : bet.status === "lost" ? "Lost" : bet.status}
                        </div>
                        <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 mt-1">
                          Result: {bet.result || "—"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

        </div>
      </main>

      <Dialog open={betOpen} onOpenChange={setBetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Bet</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-6">
              <div className="border-2 border-black p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-600">Event</div>
                <div className="font-bold text-base">{selected.event.team1} VS {selected.event.team2}</div>

                <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 mt-3">Selection</div>
                <div className="font-bold">{selected.selectionKey === "win1" ? "Win 1" : selected.selectionKey === "draw" ? "Draw" : "Win 2"}</div>

                <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 mt-3">Odds</div>
                <div className="font-bold text-2xl">{selectedOdds}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bet-amount">Bet Amount</Label>
                <Input id="bet-amount" inputMode="decimal" placeholder="Enter amount" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setBetOpen(false)} className="flex-1">Cancel</Button>
                <Button onClick={placeBet} className="flex-1">Place Bet</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
