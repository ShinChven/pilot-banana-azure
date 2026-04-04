import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import {
  Sparkles,
  Search,
  RefreshCw,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Timer,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Calendar as CalendarIcon,
  ArrowRight,
  Zap,
  PlayCircle
} from 'lucide-react';
import { listAiTasks, retryAiTask, AiTask } from '../api/aiTasks';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { ScrollArea } from "@/src/components/ui/scroll-area";

export default function AiTasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [tasks, setTasks] = React.useState<AiTask[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRetrying, setIsRetrying] = React.useState<string | null>(null);

  // Pagination and Filter State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
  const statusFilter = searchParams.get('status') || 'all';
  const [totalItems, setTotalItems] = React.useState(0);

  // Content Modal State
  const [viewModalContent, setViewModalContent] = React.useState<{ title: string; content: string } | null>(null);

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
  };

  const openViewModal = (title: string, content: string) => {
    setViewModalContent({ title, content });
  };

  const fetchTasks = React.useCallback(async (silent = false) => {
    if (!token || !user) return;
    if (!silent) setIsLoading(true);
    try {
      const filter = statusFilter === "all" ? null : statusFilter;
      const res = await listAiTasks(user.id, filter, token, page, pageSize);
      if (res.data) {
        setTasks(res.data.items);
        setTotalItems(res.data.total);
      }
    } catch (err) {
      if (!silent) toast.error("Error loading tasks");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [token, user, statusFilter, page, pageSize]);

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Polling for processing tasks
  React.useEffect(() => {
    const hasActive = tasks.some(t => t.status === 'Pending' || t.status === 'Processing');
    if (!hasActive) return;

    const interval = setInterval(() => {
      fetchTasks(true);
    }, 10000); // Poll every 10s on this page for better feedback

    return () => clearInterval(interval);
  }, [tasks, fetchTasks]);

  const handleRetry = async (taskId: string) => {
    if (!token || !user) return;
    setIsRetrying(taskId);
    try {
      const res = await retryAiTask(user.id, taskId, token);
      if (!res.error) {
        toast.success("Task re-queued for generation");
        fetchTasks(true);
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error("Retry failed");
    } finally {
      setIsRetrying(null);
    }
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            AI Task Manager
          </h1>
          <p className="text-muted-foreground">Monitor and manage background text generation tasks.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => fetchTasks()} 
          className="rounded-xl border-muted-foreground/10"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card/40 backdrop-blur-sm p-4 rounded-2xl border border-muted-foreground/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground/70">Task Filter</span>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(val) => { updateQueryParams({ status: val, page: 1 }); }}>
                <SelectTrigger className="w-[180px] h-8 bg-muted/30 border-muted-foreground/5 rounded-lg border-none shadow-none font-bold text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-muted-foreground/10">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Succeeded">Succeeded</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-muted/40 px-4 py-2 rounded-xl border border-muted-foreground/5 shadow-inner">
          Total Queue: {totalItems}
        </div>
      </div>

      <Card className="border-muted-foreground/10 shadow-2xl overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm">
        {isLoading && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-primary/40" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary animate-pulse" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-lg font-bold tracking-tight">Syncing Tasks</p>
              <p className="text-sm text-muted-foreground animate-pulse">Contacting the AI processing unit...</p>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="h-20 w-20 bg-muted/50 rounded-3xl flex items-center justify-center shadow-inner border border-muted-foreground/5">
              <PlayCircle className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <div className="space-y-2 px-6">
              <h3 className="text-xl font-bold tracking-tight">No active tasks</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                All systems quiet. Start some AI generation in your campaigns to see progress here!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* List Header - Desktop Only */}
            <div className="hidden lg:grid lg:grid-cols-[80px_1fr_1fr_160px_180px] items-center gap-4 px-6 py-4 bg-muted/40 border-b border-muted-foreground/10 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
              <span className="text-center">Status</span>
              <span>Prompt</span>
              <span>Result / Error</span>
              <span>Started</span>
              <span className="text-right">Actions</span>
            </div>

            {/* List Items */}
            <div className="divide-y divide-muted-foreground/5">
              {tasks.map((task) => (
                <div key={task.id} className="group hover:bg-primary/[0.02] transition-all duration-300 px-6 py-5 flex flex-col gap-4 lg:grid lg:grid-cols-[80px_1fr_1fr_160px_180px] lg:items-center lg:gap-4">

                  {/* Col 1: Status Icon + ID + Badge */}
                  <div className="flex lg:flex-col items-center lg:items-center gap-3 lg:gap-2">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center shadow-md transition-all group-hover:scale-105 duration-500 border border-muted-foreground/5 flex-shrink-0",
                      task.status === 'Pending' ? "bg-muted/50 text-muted-foreground" :
                      task.status === 'Processing' ? "bg-blue-500/10 text-blue-500 animate-pulse" :
                      task.status === 'Succeeded' ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10" :
                      "bg-destructive/10 text-destructive shadow-destructive/10"
                    )}>
                      {task.status === 'Pending' && <Timer className="w-6 h-6 opacity-40 text-muted-foreground" />}
                      {task.status === 'Processing' && <Loader2 className="w-6 h-6 animate-spin" />}
                      {task.status === 'Succeeded' && <CheckCircle2 className="w-6 h-6" />}
                      {task.status === 'Failed' && <AlertCircle className="w-6 h-6" />}
                    </div>
                    <div className="flex lg:flex-col items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-muted-foreground/10 transition-colors group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/10">
                        {task.id.split('-')[0].toUpperCase()}
                      </span>
                      <Badge variant="outline" className={cn(
                        "text-[9px] uppercase font-black px-1.5 h-4 border-none shadow-sm",
                        task.status === 'Pending' ? "bg-muted text-muted-foreground" :
                        task.status === 'Processing' ? "bg-blue-500/10 text-blue-500" :
                        task.status === 'Succeeded' ? "bg-emerald-500/10 text-emerald-500" :
                        "bg-destructive/10 text-destructive"
                      )}>
                        {task.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Col 2: Prompt */}
                  <div className="min-w-0 flex flex-col gap-1">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground/50">Prompt</p>
                    {task.promptText ? (
                      <p
                        className="text-sm font-semibold text-foreground leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => openViewModal("Prompt", task.promptText)}
                        title="Click to view full prompt"
                      >
                        {task.promptText}
                      </p>
                    ) : (
                      <p className="text-sm italic font-normal text-muted-foreground/40">No prompt</p>
                    )}
                  </div>

                  {/* Col 3: Result or Error */}
                  <div className="min-w-0 flex flex-col gap-1">
                    {task.status === 'Succeeded' && task.resultText ? (
                      <>
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-500/60">Generated</p>
                        <p
                          className="text-sm text-emerald-600 dark:text-emerald-400 font-medium leading-snug line-clamp-2 cursor-pointer hover:text-emerald-500 transition-colors"
                          onClick={() => openViewModal("Generated Result", task.resultText!)}
                          title="Click to view full result"
                        >
                          {task.resultText}
                        </p>
                      </>
                    ) : task.status === 'Failed' ? (
                      <>
                        <p className="text-xs font-black uppercase tracking-wider text-destructive/60">Error</p>
                        <p
                          className="text-xs text-destructive font-semibold line-clamp-2 flex items-start gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => task.errorMessage && openViewModal("Error Message", task.errorMessage)}
                          title="Click to view full error"
                        >
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          {task.errorMessage || "Unknown error"}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground/30 italic">—</p>
                    )}
                  </div>

                  {/* Col 4: Time */}
                  <div className="flex flex-row lg:flex-col gap-3 lg:gap-1 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                      <CalendarIcon className="w-3.5 h-3.5 text-primary/50" />
                      {new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5 font-black text-foreground/70">
                      <Clock className="w-3.5 h-3.5 text-primary/50" />
                      {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                  </div>

                  {/* Col 5: Actions */}
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-4 h-9 rounded-xl bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 font-bold"
                      onClick={() => navigate(`/campaigns/${task.campaignId}/posts/${task.postId}`)}
                    >
                      View Post
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>

                    {task.status === 'Failed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive shadow-sm shadow-destructive/5 hover:text-white transition-all"
                        onClick={() => handleRetry(task.id)}
                        disabled={isRetrying === task.id}
                        title="Retry Task"
                      >
                        {isRetrying === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Pagination Controller */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card/40 backdrop-blur-sm rounded-2xl border border-muted-foreground/10 shadow-lg">
          <div className="text-sm text-muted-foreground font-medium">
            Showing <span className="font-black text-foreground">{(page - 1) * pageSize + 1}</span> to <span className="font-black text-foreground">{Math.min(page * pageSize, totalItems)}</span> of <span className="font-black text-foreground">{totalItems}</span> tasks
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 mr-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Limit:</span>
              <select
                className="bg-muted/40 text-xs font-black p-1 rounded border-none focus:ring-0 cursor-pointer"
                value={pageSize}
                onChange={(e) => { updateQueryParams({ pageSize: Number(e.target.value), page: 1 }); }}
              >
                {[10, 25, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-muted-foreground/10 bg-card/60 hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-30"
              onClick={() => updateQueryParams({ page: Math.max(1, page - 1) })}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-xs font-black min-w-[100px] text-center bg-muted/40 h-10 flex items-center justify-center rounded-xl border border-muted-foreground/10 shadow-inner">
              PAGE {page} OF {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-muted-foreground/10 bg-card/60 hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-30"
              onClick={() => updateQueryParams({ page: Math.min(totalPages, page + 1) })}
              disabled={page >= totalPages || isLoading}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Content Modal */}
      <Dialog open={!!viewModalContent} onOpenChange={(open) => !open && setViewModalContent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col rounded-2xl border-muted-foreground/10 shadow-2xl">
          <DialogHeader className="pb-4 border-b border-muted-foreground/5">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {viewModalContent?.title === "Prompt" ? (
                <Sparkles className="w-5 h-5 text-primary" />
              ) : viewModalContent?.title === "Generated Result" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
              {viewModalContent?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-4 rounded-xl bg-muted/30 p-4">
            <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground/90">
              {viewModalContent?.content}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
