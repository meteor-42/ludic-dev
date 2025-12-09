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

type Leader = { userId: string; balance: string; totalBets: number; winRate: number };
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
      return "Скоро";
    case "live":
      return "В эфире";
    case "finished":
      return "Завершён";
    case "canceled":
      return "Отменён";
    default:
      return status;
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
    if (!Number.isFinite(amount) || amount <= 0) return;

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
    <Tabs defaultValue="events" className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
          <div className="text-lg font-extrabold tracking-wide select-none whitespace-nowrap">ЛУДИК.РФ</div>
          <div className="flex-1 flex justify-center">
            <TabsList className="bg-muted p-1">
              <TabsTrigger value="events">События</TabsTrigger>
              <TabsTrigger value="leaders">Лидеры</TabsTrigger>
              <TabsTrigger value="history">История</TabsTrigger>
            </TabsList>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-2">
              Баланс: {walletLoading ? (
                <span className="inline-block align-middle"><Skeleton className="h-4 w-16" /></span>
              ) : (
                <span className="font-semibold text-foreground">{formatAmount(balance)}</span>
              )}
              <Button size="icon" variant="secondary" onClick={topUp} title="Пополнить на 1000" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">Пополнений: {topUpCount}</div>
            <ThemeToggle />
            <Button variant="secondary" onClick={logout}>Выход</Button>
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
                    <Card key={ev.eventId} className="transition-shadow hover:shadow-md hover:bg-muted/40 border group">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">{ev.team1} — {ev.team2}</CardTitle>
                            <CardDescription>
                              {ev.tournament} • Тур {ev.round} • ID {ev.eventId}
                              <span className="block mt-1">{ev.date} • {ev.mskTime} (MSK)</span>
                            </CardDescription>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-medium">Статус: <span className="px-1.5 py-0.5 rounded bg-muted text-foreground/80">{statusLabel(ev.status)}</span></div>
                            <div className="text-xs text-muted-foreground mt-1">Счёт: <span className="font-semibold text-foreground/80">{resultText}</span></div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3">
                          {(["win1","draw","win2"] as const).map((key) => {
                            const label = key === "win1" ? "П1" : key === "draw" ? "Н" : "П2";
                            const odd = ev.odds[key];
                            return (
                              <Button
                                key={key}
                                variant={bettingOpen ? "default" : "secondary"}
                                disabled={!bettingOpen}
                                className="w-full h-12 flex flex-col items-center justify-center"
                                onClick={() => {
                                  setSelected({ event: ev, selectionKey: key });
                                  setBetOpen(true);
                                }}
                              >
                                <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
                                <span className="text-lg font-semibold leading-none">{odd}</span>
                              </Button>
                            );
                          })}
                        </div>
                        {!bettingOpen && (
                          <div className="text-xs text-muted-foreground mt-2">Ставки на это событие недоступны</div>
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
              <p className="text-sm text-muted-foreground">Лидеров пока нет</p>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Список лидеров</CardTitle>
                  <CardDescription>Баланс, количество ставок и точность</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Пользователь</TableHead>
                        <TableHead className="text-right">Баланс</TableHead>
                        <TableHead className="text-right">Ставок</TableHead>
                        <TableHead className="text-right">Точность</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboardData!.leaders.map((l, idx) => (
                        <TableRow key={l.userId}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="truncate max-w-[180px]" title={l.userId}>{l.userId}</TableCell>
                          <TableCell className="text-right font-medium">{formatAmount(l.balance)}</TableCell>
                          <TableCell className="text-right">{l.totalBets}</TableCell>
                          <TableCell className="text-right">{l.winRate}%</TableCell>
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
              <p className="text-sm text-muted-foreground">История пуста</p>
            ) : (
              <div className="space-y-3">
                {betsData!.map((bet) => (
                  <Card key={bet.id} className="hover:bg-muted/40 transition-colors">
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[260px]" title={bet.eventName}>{bet.eventName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {bet.selection} • Коэф. {bet.odds} • {formatDateTime(bet.createdAt as unknown as string)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold">-{formatAmount(bet.amount)}</div>
                        <div className="text-xs text-muted-foreground">{bet.status === "pending" ? "В ожидании" : bet.status === "won" ? "Выигрыш" : bet.status === "lost" ? "Проигрыш" : bet.status}</div>
                        <div className="text-xs text-muted-foreground">Результат: {bet.result || "—"}</div>
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
            <DialogTitle>Оформление ставки</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Событие: <span className="font-medium text-foreground">{selected.event.team1} — {selected.event.team2}</span>
                <br />
                Выбор: <span className="font-medium text-foreground">{selected.selectionKey === "win1" ? "П1" : selected.selectionKey === "draw" ? "Н" : "П2"}</span>
                <br />
                Коэффициент: <span className="font-medium text-foreground">{selectedOdds}</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bet-amount">Сумма ставки</Label>
                <Input id="bet-amount" inputMode="decimal" placeholder="Введите сумму" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} />
              </div>
              <DialogFooter>
                <Button onClick={placeBet}>Поставить</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
