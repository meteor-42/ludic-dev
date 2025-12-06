import { DollarSign, TrendingUp, Activity, ArrowUpRight, History } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Bet } from "@shared/schema";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  isLoading?: boolean;
}

function StatCard({ title, value, description, icon: Icon, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold" data-testid={`stat-value-${title.toLowerCase().replace(/\s/g, "-")}`}>
            {value}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function formatAmount(amount: string): string {
  return parseFloat(amount).toLocaleString("ru-RU");
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Только что";
  if (minutes < 60) return `${minutes} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  return `${days} д назад`;
}

function getBetStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return { label: "В ожидании", variant: "secondary" as const };
    case "won":
      return { label: "Выигрыш", variant: "default" as const };
    case "lost":
      return { label: "Проигрыш", variant: "destructive" as const };
    default:
      return { label: status, variant: "outline" as const };
  }
}

export default function DashboardPage() {
  const { user, getAuthHeaders } = useAuth();

  const { data: walletData, isLoading: walletLoading } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch wallet");
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

  const balance = walletData?.balance || "0";
  const bets = betsData || [];
  const pendingBets = bets.filter(b => b.status === "pending");
  const wonBets = bets.filter(b => b.status === "won");
  const totalWinnings = wonBets.reduce((sum, bet) => sum + parseFloat(bet.potentialWin), 0);

  const stats: StatCardProps[] = [
    {
      title: "Баланс",
      value: formatAmount(balance),
      description: "Виртуальные монеты",
      icon: DollarSign,
      isLoading: walletLoading,
    },
    {
      title: "Активные ставки",
      value: String(pendingBets.length),
      description: "В ожидании результата",
      icon: Activity,
      isLoading: betsLoading,
    },
    {
      title: "Выигрыши",
      value: formatAmount(String(totalWinnings)),
      description: "Общая сумма выигрышей",
      icon: TrendingUp,
      isLoading: betsLoading,
    },
    {
      title: "Всего ставок",
      value: String(bets.length),
      description: "За все время",
      icon: History,
      isLoading: betsLoading,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
          Добро пожаловать{user?.name ? `, ${user.name}` : ""}!
        </h1>
        <p className="text-muted-foreground" data-testid="text-dashboard-subtitle">
          Ваш центр управления ставками
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Последние ставки</CardTitle>
            <CardDescription>
              Ваши недавние ставки на платформе
            </CardDescription>
          </CardHeader>
          <CardContent>
            {betsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : bets.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                У вас пока нет ставок
              </p>
            ) : (
              <div className="space-y-4">
                {bets.slice(0, 5).map((bet) => {
                  const statusInfo = getBetStatusBadge(bet.status);
                  return (
                    <div
                      key={bet.id}
                      className="flex items-center justify-between gap-4"
                      data-testid={`bet-item-${bet.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={statusInfo.variant} className="shrink-0">
                          {statusInfo.label}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {bet.eventName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {bet.selection} | Коэф. {bet.odds}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          -{formatAmount(bet.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(bet.createdAt as unknown as string)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>
              Основные операции одним кликом
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4 cursor-pointer hover-elevate active-elevate-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Новая ставка</p>
                    <p className="text-xs text-muted-foreground">
                      Сделать ставку
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 cursor-pointer hover-elevate active-elevate-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Мои ставки</p>
                    <p className="text-xs text-muted-foreground">
                      Активные пари
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 cursor-pointer hover-elevate active-elevate-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <ArrowUpRight className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Коэффициенты</p>
                    <p className="text-xs text-muted-foreground">
                      Текущие события
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 cursor-pointer hover-elevate active-elevate-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <History className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">История</p>
                    <p className="text-xs text-muted-foreground">
                      Все операции
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
