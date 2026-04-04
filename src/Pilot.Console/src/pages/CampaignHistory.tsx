import * as React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
// Card imports removed
import { Button } from "@/src/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCampaignHistory } from '../api/history';
import { getCampaign } from '../api/campaigns';
import { PostHistoryItem } from '../types';
import { toast } from 'sonner';
import { XIcon } from '@/src/components/XIcon';
import { Instagram, Linkedin, Facebook } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function CampaignHistoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [history, setHistory] = React.useState<PostHistoryItem[]>([]);
  const [campaignName, setCampaignName] = React.useState('');
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
    if (!token || !id || !user) return;
    setIsLoading(true);
    try {
      const [histRes, campRes] = await Promise.all([
        getCampaignHistory(user.id, id, token, page, pageSize),
        getCampaign(id, token)
      ]);

      if (histRes.data) {
        setHistory(histRes.data.items);
        setTotalCount(histRes.data.total);
        setTotalPages(Math.ceil(histRes.data.total / (histRes.data.pageSize || pageSize)));
      } else if (histRes.error) {
        toast.error('Failed to load history', { description: histRes.error });
      }

      if (campRes.data) {
        setCampaignName(campRes.data.name);
      }
    } catch (err) {
      toast.error('Error loading history data');
    } finally {
      setIsLoading(false);
    }
  }, [token, id, user, page, pageSize]);

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

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sending History</h1>
          <p className="text-muted-foreground">Campaign: {campaignName || '...'}</p>
        </div>
      </div>

      <div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/10">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No History Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              There is no sending history recorded for this campaign yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* List Header - Desktop Only */}
            <div className="hidden lg:grid lg:grid-cols-[180px_1fr_120px_180px] items-center gap-4 px-6 py-4 bg-muted/40 border-b border-muted-foreground/10 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
              <span className="text-center">Account</span>
              <span>Status / Message</span>
              <span>Time</span>
              <span className="text-right">Actions</span>
            </div>

            {/* List Items */}
            <div className="divide-y divide-muted-foreground/5">
              {history.map((item) => (
                <div key={item.id} className="group hover:bg-primary/[0.02] transition-all duration-300 px-6 py-5 flex flex-col gap-4 lg:grid lg:grid-cols-[180px_1fr_120px_180px] lg:items-center lg:gap-4">
                  
                  {/* Col 1: Account / Avatar */}
                  <div className="flex lg:flex-row items-center gap-3">
                    <div className="relative shrink-0 transition-transform group-hover:scale-105 duration-500">
                      <Avatar className="h-10 w-10 border border-muted-foreground/10 shadow-sm">
                        <AvatarImage src={item.avatarUrl} alt={item.displayName || item.username} />
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                          {(item.displayName || item.username || "??").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background flex items-center justify-center border border-muted-foreground/10 shadow-sm">
                        {getPlatformIcon(item.platform, "h-2.5 w-2.5")}
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm truncate text-foreground/90 group-hover:text-primary transition-colors" title={item.displayName || item.username}>
                        {item.displayName || item.username || "Deleted Account"}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground/70 truncate flex items-center gap-1">
                        ID: {item.userId.slice(0, 8)}...
                      </span>
                    </div>
                  </div>

                  {/* Col 2: Status / Message */}
                  <div className="min-w-0 flex flex-col gap-1.5">
                    <Badge variant="outline" className={cn(
                      "text-[9px] uppercase font-black px-1.5 h-4 border-none shadow-sm w-fit",
                      item.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                    )}>
                      {item.status}
                    </Badge>
                    {item.status === 'Failed' ? (
                      <p className="text-xs text-destructive font-semibold line-clamp-2 mt-0.5 flex items-start gap-1" title={item.errorMessage || "Unknown error"}>
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        {item.errorMessage || "Error occurred during posting."}
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium line-clamp-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                        Published Successfully
                      </p>
                    )}
                  </div>

                  {/* Col 3: Time */}
                  <div className="flex flex-row lg:flex-col gap-3 lg:gap-1 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                      <CalendarIcon className="w-3.5 h-3.5 text-primary/50" />
                      {new Date(item.postedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5 font-black text-foreground/70">
                      <Clock className="w-3.5 h-3.5 text-primary/50" />
                      {new Date(item.postedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                  </div>

                  {/* Col 4: Actions */}
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    {item.postUrl && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="px-3 h-9 rounded-xl bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all font-bold group/link" 
                        asChild 
                        title="View on platform"
                      >
                        <a href={item.postUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                          View
                          <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover/link:opacity-100" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-4 h-9 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all font-bold"
                      onClick={() => navigate(`/campaigns/${id}/posts/${item.postId}`)}
                    >
                      Manage
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controller */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-muted/20 border-t border-muted-foreground/10 border-b border-b-muted-foreground/5">
              <div className="text-sm text-muted-foreground font-medium text-center sm:text-left">
                Showing <span className="font-bold text-foreground">{history.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-bold text-foreground">{(page - 1) * pageSize + history.length}</span> of <span className="font-bold text-foreground">{totalCount}</span> attempts
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Rows per page:</span>
                  <select
                    className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer hover:text-primary transition-colors"
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
                    className="h-8 w-8 rounded-lg border-muted-foreground/10 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all"
                    onClick={() => updateQueryParams({ page: Math.max(1, page - 1) })}
                    disabled={page === 1 || isLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-sm font-bold min-w-[80px] text-center text-muted-foreground">
                    Page <span className="text-foreground">{page}</span> of {totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-muted-foreground/10 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all"
                    onClick={() => updateQueryParams({ page: Math.min(totalPages, page + 1) })}
                    disabled={page >= totalPages || isLoading}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
