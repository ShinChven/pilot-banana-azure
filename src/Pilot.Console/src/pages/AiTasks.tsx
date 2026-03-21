import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/src/components/ui/table";
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
  Eye
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-muted-foreground/10 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Filter by Status:</span>
          <Select value={statusFilter} onValueChange={(val) => { updateQueryParams({ status: val, page: 1 }); }}>
            <SelectTrigger className="w-[180px] bg-muted/30 border-muted-foreground/5 rounded-xl">
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
        <div className="text-sm text-muted-foreground font-medium bg-muted/50 px-3 py-1 rounded-full">
          Total Tasks: {totalItems}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-muted-foreground/10 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-muted-foreground/10">
              <TableHead className="w-[150px]">Task ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="min-w-[200px] max-w-[300px]">Prompt Content</TableHead>
              <TableHead className="min-w-[200px] max-w-[300px]">Error Message</TableHead>
              <TableHead className="text-right px-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && tasks.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse border-muted-foreground/5">
                  <TableCell colSpan={6}>
                    <div className="h-10 bg-muted/50 rounded-lg w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : tasks.length > 0 ? (
              tasks.map((task) => (
                <TableRow key={task.id} className="border-muted-foreground/5 hover:bg-muted/5 transition-colors">
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    <span title={task.id}>{task.id.substring(0, 8)}...</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase tracking-widest font-bold h-5 px-2 border-none",
                        task.status === 'Pending' ? "bg-muted text-muted-foreground" :
                        task.status === 'Processing' ? "bg-blue-500/10 text-blue-500" :
                        task.status === 'Succeeded' ? "bg-emerald-500/10 text-emerald-500" :
                        "bg-destructive/10 text-destructive"
                      )}
                    >
                      {task.status === 'Processing' ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          {task.status}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          {task.status === 'Succeeded' ? <CheckCircle2 className="w-2.5 h-2.5" /> : 
                           task.status === 'Failed' ? <AlertCircle className="w-2.5 h-2.5" /> : 
                           <Timer className="w-2.5 h-2.5" />}
                          {task.status}
                        </span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-[10px] text-muted-foreground font-medium">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(task.createdAt).toLocaleDateString()}
                      </div>
                      <div>{new Date(task.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="flex flex-col gap-1.5 py-1">
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {task.promptText}
                      </div>
                      {task.promptText?.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-fit px-2 text-[10px] gap-1 opacity-70 hover:opacity-100 rounded-md hover:bg-primary/5 hover:text-primary transition-all"
                          onClick={() => openViewModal("Prompt Content", task.promptText)}
                        >
                          <Eye className="w-3 h-3" /> View Full
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="flex flex-col gap-1.5 py-1">
                      <div 
                        className={cn(
                          "text-xs font-medium line-clamp-2",
                          task.status === 'Failed' ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {task.errorMessage || "-"}
                      </div>
                      {task.errorMessage && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-fit px-2 text-[10px] gap-1 opacity-70 hover:opacity-100 rounded-md hover:bg-primary/5 hover:text-primary transition-all"
                          onClick={() => openViewModal("Error Message", task.errorMessage)}
                        >
                          <Eye className="w-3 h-3" /> View Detail
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-[10px] font-mono hover:bg-muted rounded-lg"
                        onClick={() => navigate(`/campaigns/${task.campaignId}/batch`)}
                      >
                        Go to Batch
                      </Button>
                      {task.status === 'Failed' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 gap-2 rounded-lg text-primary hover:bg-primary/5"
                          onClick={() => handleRetry(task.id)}
                          disabled={isRetrying === task.id}
                        >
                          {isRetrying === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          Retry
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-60 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Sparkles className="w-12 h-12 mb-4 opacity-10" />
                    <p className="text-lg font-medium">No tasks found</p>
                    <p className="text-sm opacity-70">AI generation tasks will appear here once started.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Controller */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-muted/20 border-t border-muted-foreground/10">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            Showing <span className="font-semibold text-foreground">{tasks.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-semibold text-foreground">{(page - 1) * pageSize + tasks.length}</span> of <span className="font-semibold text-foreground">{totalItems}</span> tasks
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <select
                className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
                value={pageSize}
                onChange={(e) => { updateQueryParams({ pageSize: Number(e.target.value), page: 1 }); }}
              >
                {[10, 25, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-muted-foreground/10"
                onClick={() => updateQueryParams({ page: Math.max(1, page - 1) })}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-medium min-w-[60px] text-center">
                Page {page} of {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-muted-foreground/10"
                onClick={() => updateQueryParams({ page: Math.min(totalPages, page + 1) })}
                disabled={page >= totalPages || isLoading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Modal */}
      <Dialog open={!!viewModalContent} onOpenChange={(open) => !open && setViewModalContent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col rounded-2xl border-muted-foreground/10 shadow-2xl">
          <DialogHeader className="pb-4 border-b border-muted-foreground/5">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {viewModalContent?.title === "Prompt Content" ? (
                <Sparkles className="w-5 h-5 text-primary" />
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
