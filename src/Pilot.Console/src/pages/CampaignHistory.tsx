import * as React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  ArrowLeft,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sending History</h1>
          <p className="text-muted-foreground">Campaign: {campaignName || '...'}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>History Log</CardTitle>
          <CardDescription>Total {totalCount} attempts found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              No history found for this campaign.
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl hover:bg-muted/50 border border-transparent hover:border-muted-foreground/10 transition-colors gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10 border border-muted-foreground/10">
                        <AvatarImage src={item.avatarUrl} alt={item.displayName || item.username} />
                        <AvatarFallback className="bg-primary/5 text-primary text-[10px]">
                          {(item.displayName || item.username || "??").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background flex items-center justify-center border border-muted-foreground/10 shadow-sm">
                        {getPlatformIcon(item.platform, "h-2 w-2")}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold truncate max-w-[120px]" title={item.displayName || item.username}>{item.displayName || item.username || "Deleted Account"}</span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase font-black px-2 h-5 border-none",
                          item.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                        )}>
                          {item.status}
                        </Badge>
                      </div>
                      {item.status === 'Failed' ? (
                        <p className="text-xs text-destructive font-medium line-clamp-2 italic mb-1" title={item.errorMessage}>
                          {item.errorMessage || "Unknown error occurred"}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground line-clamp-1 italic mb-1">
                          Published
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        {new Date(item.postedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {item.postUrl && (
                      <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-4 rounded-full font-bold hover:bg-primary/5 text-primary" asChild>
                        <a href={item.postUrl} target="_blank" rel="noopener noreferrer">
                          View Post <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
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
