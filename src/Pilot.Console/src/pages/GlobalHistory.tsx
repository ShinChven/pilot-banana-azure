import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
import {
  ExternalLink,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  History
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getGlobalHistory } from '../api/history';
import { PostHistoryItem } from '../types';
import { toast } from 'sonner';
import { XIcon } from '@/src/components/XIcon';
import { Instagram, Linkedin, Facebook } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function GlobalHistoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [history, setHistory] = React.useState<PostHistoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Pagination State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
  };

  const fetchData = React.useCallback(async () => {
    if (!token || user?.role !== 'Admin') return;
    setIsLoading(true);
    try {
      const histRes = await getGlobalHistory(token, page, pageSize);

      if (histRes.data) {
        setHistory(histRes.data.items);
        setTotalCount(histRes.data.total);
        setTotalPages(Math.ceil(histRes.data.total / (histRes.data.pageSize || pageSize)));
      } else if (histRes.error) {
        toast.error('Failed to load global history', { description: histRes.error });
      }
    } catch (err) {
      toast.error('Error loading history data');
    } finally {
      setIsLoading(false);
    }
  }, [token, user, page, pageSize]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPlatformIcon = (platform: string, className: string = "w-4 h-4") => {
    switch (platform.toUpperCase()) {
      case 'X': return <XIcon className={className} />;
      case 'INSTAGRAM': return <Instagram className={className} />;
      case 'LINKEDIN': return <Linkedin className={className} />;
      case 'FACEBOOK': return <Facebook className={className} />;
      default: return null;
    }
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">This page is for administrators only.</p>
        <Button variant="link" onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System History</h1>
          <p className="text-muted-foreground">Full audit log of all post-sending attempts</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <History className="w-6 h-6 text-primary" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Sending Log</CardTitle>
          <CardDescription>Total {totalCount} attempts recorded across all campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              No history found in the system.
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="bg-muted/50 grid grid-cols-12 gap-4 p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b">
                <div className="col-span-2">Account</div>
                <div className="col-span-2">Campaign</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-4">Audit Message</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div className="divide-y">
                {history.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 p-3 text-sm items-center hover:bg-muted/30 transition-colors">
                    <div className="col-span-2 flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9 border border-muted-foreground/10">
                          <AvatarImage src={item.avatarUrl} alt={item.displayName || item.username} />
                          <AvatarFallback className="bg-primary/5 text-primary text-[10px]">
                            {(item.displayName || item.username || "??").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background flex items-center justify-center border border-muted-foreground/10 shadow-sm">
                          {getPlatformIcon(item.platform, "h-2 w-2")}
                        </div>
                      </div>
                      <div className="flex flex-col overflow-hidden min-w-0">
                        <span className="font-medium text-xs truncate" title={item.displayName || item.username}>{item.displayName || item.username || "Deleted Account"}</span>
                        <span className="text-[9px] text-muted-foreground truncate" title={item.userId}>ID: {item.userId.slice(0, 8)}...</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex flex-col overflow-hidden min-w-0">
                        {item.campaignName ? (
                          <Button 
                            variant="link" 
                            className="h-auto p-0 text-xs font-semibold truncate justify-start text-foreground hover:text-primary transition-colors" 
                            onClick={() => navigate(`/campaigns/${item.campaignId}`)}
                            title={item.campaignName}
                          >
                            {item.campaignName}
                          </Button>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground truncate italic">Unknown Campaign</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={cn(
                          "text-[9px] uppercase font-bold w-fit px-1.5 h-4",
                          item.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                          {item.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.postedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-4">
                      {item.status === 'Failed' ? (
                        <span className="text-xs text-destructive font-medium line-clamp-2 italic" title={item.errorMessage || "Unknown error"}>
                          {item.errorMessage || "Error occurred during posting."}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground line-clamp-2 italic">
                          Published
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      {item.postUrl && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-3 rounded-full" asChild>
                          <a href={item.postUrl} target="_blank" rel="noopener noreferrer">
                            View <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination Controller */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-muted/20 border-t border-muted-foreground/10 -mx-6 -mb-6 mt-6">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Showing <span className="font-semibold text-foreground">{history.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-semibold text-foreground">{(page - 1) * pageSize + history.length}</span> of <span className="font-semibold text-foreground">{totalCount}</span> attempts
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
        </CardContent>
      </Card>
    </div>
  );
}
