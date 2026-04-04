import * as React from "react"
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Button, buttonVariants } from "@/src/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Send,
  Share2,
  Loader2,
  ExternalLink,
  Instagram,
  Linkedin,
  Facebook
} from 'lucide-react';
import { useAuth } from "../context/AuthContext";
import { statsApi, type DashboardStats } from "../api/stats";
import { toast } from "sonner";
import { XIcon } from "@/src/components/XIcon";
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";

export default function Home() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [days, setDays] = React.useState(7);

  const automationData = React.useMemo(() => {
    const data = stats?.automationOverview ?? [];
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const found = data.find(item => item.date === dateStr);
      result.push({
        name: displayDate,
        posts: found ? found.count : 0
      });
    }
    return result;
  }, [stats?.automationOverview, days]);

  const fetchStats = React.useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const { data, error } = await statsApi.getStats(token, days);
      if (error) {
        toast.error("Failed to load dashboard stats", { description: error });
      } else if (data) {
        setStats(data);
      }
    } catch (err) {
      toast.error("Error connecting to dashboard API");
    } finally {
      setIsLoading(false);
    }
  }, [token, days]);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const getPlatformIcon = (platform: string, className: string = "w-4 h-4") => {
    switch (platform.toUpperCase()) {
      case 'X': return <XIcon className={className} />;
      case 'INSTAGRAM': return <Instagram className={className} />;
      case 'LINKEDIN': return <Linkedin className={className} />;
      case 'FACEBOOK': return <Facebook className={className} />;
      default: return <Activity className={className} />;
    }
  };

  const cards = [
    {
      name: 'Active Campaigns',
      value: stats?.activeCampaigns ?? 0,
      change: '+0',
      icon: Layers,
      trend: 'up',
      color: 'text-blue-500',
      href: '/campaigns'
    },
    {
      name: 'Scheduled Posts',
      value: stats?.scheduledPosts ?? 0,
      change: '+0',
      icon: Send,
      trend: 'up',
      color: 'text-amber-500',
      href: '/scheduled-posts'
    },
    {
      name: 'Connected Channels',
      value: stats?.connectedChannels ?? 0,
      change: '+0',
      icon: Share2,
      trend: 'up',
      color: 'text-emerald-500',
      href: '/channels'
    },
    {
      name: 'System Health',
      value: '100%',
      change: 'Stable',
      icon: Activity,
      trend: 'up',
      color: 'text-primary',
      href: undefined
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to your posting overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat) => (
          <Card
            key={stat.name}
            className={cn("border-muted-foreground/10 bg-card", stat.href && "cursor-pointer hover:border-muted-foreground/20 transition-colors")}
            onClick={() => stat.href && navigate(stat.href)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {stat.trend === 'up' ? (
                      <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-destructive" />
                    )}
                    <span className={stat.trend === 'up' ? 'text-emerald-500' : 'text-destructive'}>
                      {stat.change}
                    </span>{' '}
                    status
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-muted-foreground/10 bg-card">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Automation Overview</CardTitle>
              <CardDescription>Visualizing your posting cadence</CardDescription>
            </div>
            <div className="flex items-center rounded-md border border-muted-foreground/15 p-0.5 gap-0.5">
              {([7, 14, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded font-medium transition-colors",
                    days === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d}D
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={automationData}>
                  <defs>
                    <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    itemStyle={{ color: 'var(--primary)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="posts"
                    stroke="var(--primary)"
                    fillOpacity={1}
                    fill="url(#colorPosts)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-muted-foreground/10 bg-card">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest events from your campaigns.</CardDescription>
            </div>
            {stats?.recentHistory && stats.recentHistory.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => navigate('/history')}>
                View All
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !stats?.recentHistory || stats.recentHistory.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">No recent activity</p>
                    <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                      Start by creating a campaign and sending some posts to see activity here.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/campaigns')}>
                    Go to Campaigns
                  </Button>
                </div>
              ) : (
                stats.recentHistory.map((item) => (
                  <div key={item.id} className="flex items-start">
                      <div className="relative mt-0.5">
                        <Avatar className="h-9 w-9 border border-muted-foreground/10">
                          <AvatarImage src={item.avatarUrl} alt={item.displayName || item.username} />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs">
                            {(item.displayName || item.username || "??").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background flex items-center justify-center border border-muted-foreground/10 shadow-sm">
                          {getPlatformIcon(item.platform, "h-2 w-2")}
                        </div>
                      </div>
                      <div className="ml-4 space-y-1 overflow-hidden flex-1">
                      <p className="text-sm font-medium leading-none text-foreground flex items-center gap-2">
                        {item.status === 'Completed' ? 'Post Published' : 'Post Failed'}
                        <Badge variant="outline" className={cn(
                          "text-[8px] h-3 uppercase px-1 shrink-0",
                          item.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                          {item.status}
                        </Badge>
                      </p>
                      <div className="flex flex-col">
                        <p className="text-xs text-muted-foreground truncate font-medium flex items-center gap-1">
                          <span>{item.displayName || item.username || "Deleted Account"}</span>
                          <span>•</span>
                          {item.campaignName ? (
                            <Button
                              variant="link"
                              className="h-auto p-0 text-xs font-medium text-primary/70 hover:text-primary transition-colors truncate"
                              onClick={() => navigate(`/campaigns/${item.campaignId}`)}
                            >
                              {item.campaignName}
                            </Button>
                          ) : (
                            <span className="text-primary/70 italic">Campaign</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate">
                          {item.status === 'Completed'
                            ? "Successfully published"
                            : (item.errorMessage || "Error occurred during posting.")}
                        </p>
                      </div>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground font-medium whitespace-nowrap pl-2 mt-0.5">
                      {item.postUrl && (
                        <a href={item.postUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 gap-1.5 px-2 rounded-full mr-2")}>
                            View <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                      )}
                      {new Date(item.postedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
