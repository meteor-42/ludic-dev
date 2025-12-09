import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Bet } from "@shared/schema";

type EventItem = {
  eventId: number;
  round: number;
  tournament: string;
  date: string;
  mskTime: string;
  team1: string;
  team2: string;
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

export default function DashboardPage() {
  const { getAuthHeaders, logout } = useAuth();

  const { data: walletData, isLoading: walletLoading } = useQuery<{ balance: string }>({
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
          <div className="ml-auto flex items-center gap-3">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              Баланс: {walletLoading ? <span className="inline-block align-middle"><Skeleton className="h-4 w-16" /></span> : <span className="font-semibold text-foreground">{formatAmount(balance)}</span>}
            </div>
            <ThemeToggle />
            <Button variant="secondary" onClick={logout}>Выход</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
          <TabsContent value="events">
            {eventsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="grid gap-4 sm:grid-cols-2">
                {eventsData!.events.map((ev) => (
                  <Card key={ev.eventId} className="hover:elevate transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base">{ev.team1} — {ev.team2}</CardTitle>
                      <CardDescription>
                        {ev.tournament} • Тур {ev.round} • ID {ev.eventId}
                        <span className="block mt-1">{ev.date} • {ev.mskTime} (MSK)</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">П1</div>
                          <div className="text-lg font-semibold">{ev.odds.win1}</div>
                        </div>
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">Н</div>
                          <div className="text-lg font-semibold">{ev.odds.draw}</div>
                        </div>
                        <div className="p-3 rounded-md border text-center">
                          <div className="text-xs text-muted-foreground">П2</div>
                          <div className="text-lg font-semibold">{ev.odds.win2}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                  <Card key={bet.id}>
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

        </div>
      </main>
    </Tabs>
  );
}
