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
import { Badge } from "@/src/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  Calendar as CalendarIcon,
  Clock,
  List,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Layers,
  Send,
  ArrowRight,
  SortAsc,
  ChevronDown,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listUserPosts, type PostResponse } from '../api/posts';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Input } from "@/src/components/ui/input";
import { getPostMediaKindFromUrl, getPostPreviewUrl } from '@/src/lib/post-media';

export default function ScheduledPostsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [posts, setPosts] = React.useState<PostResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '');
  const sortBy = searchParams.get('sortBy') || 'scheduledTime';
  const sortOrder = searchParams.get('sortOrder') || 'asc';

  // Pagination State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
  const [totalItems, setTotalItems] = React.useState(0);

  // Calendar state
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
  };

  const fetchPosts = React.useCallback(async (silent = false) => {
    if (!token || !user) return;
    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await listUserPosts(
        user.id,
        token,
        page,
        pageSize,
        'Scheduled',
        searchParams.get('q') || undefined,
        sortBy,
        sortOrder
      );

      if (data) {
        setPosts(data.items);
        setTotalItems(data.total);
      } else if (error) {
        toast.error('Failed to load scheduled posts', { description: error });
      }
    } catch (err) {
      toast.error('Error loading scheduled posts');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [token, user, page, pageSize, searchParams, sortBy, sortOrder]);

  // Fetch all scheduled posts for calendar (simplified: just fetch 100 for now)
  const [allScheduledPosts, setAllScheduledPosts] = React.useState<PostResponse[]>([]);
  const fetchAllScheduled = React.useCallback(async () => {
    if (!token || !user) return;
    try {
      const { data } = await listUserPosts(user.id, token, 1, 1000, 'Scheduled');
      if (data) {
        setAllScheduledPosts(data.items);
      }
    } catch (err) {
      console.error('Error fetching all scheduled posts', err);
    }
  }, [token, user]);

  React.useEffect(() => {
    fetchPosts();
    fetchAllScheduled();
  }, [fetchPosts, fetchAllScheduled]);

  const totalPages = Math.ceil(totalItems / pageSize);

  // Calendar logic
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);

    const calendarDays = [];
    // Padding for first day
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<div key={`pad-${i}`} className="h-24 border-r border-b bg-muted/5" />);
    }

    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d);
      // Compare by local date (year, month, day) regardless of time zone or string format
      const dayPosts = allScheduledPosts.filter(p => {
        if (!p.scheduledTime) return false;
        const sched = new Date(p.scheduledTime);
        return sched.getFullYear() === date.getFullYear() &&
               sched.getMonth() === date.getMonth() &&
               sched.getDate() === date.getDate();
      });
      const isToday = new Date().toDateString() === date.toDateString();

      calendarDays.push(
        <div key={d} className={cn(
          "h-24 border-r border-b p-2 flex flex-col gap-1 transition-colors hover:bg-muted/30",
          isToday && "bg-primary/5"
        )}>
          <span className={cn(
            "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
            isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          )}>{d}</span>

          {dayPosts.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              <div className="bg-amber-500/10 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center justify-between">
                <span>{dayPosts.length} {dayPosts.length === 1 ? 'Post' : 'Posts'}</span>
                <Clock className="w-2.5 h-2.5" />
              </div>
            </div>
          )}
        </div>
      );
    }

    return calendarDays;
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Scheduled Posts</h1>
          <p className="text-muted-foreground">Manage all your upcoming content across campaigns.</p>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="list" className="rounded-lg gap-2">
              <List className="w-4 h-4" /> List View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-lg gap-2">
              <CalendarIcon className="w-4 h-4" /> Calendar View
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                className="pl-10 h-10 bg-card border-muted-foreground/10 transition-all rounded-xl"
                value={searchQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setSearchQuery(q);
                  updateQueryParams({ q, page: 1 });
                }}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger render={(props) => (
                <Button {...props} variant="outline" size="sm" className="h-10 gap-2 border-muted-foreground/10 text-muted-foreground flex-1 sm:flex-none justify-between sm:justify-center min-w-[140px] rounded-xl">
                  <SortAsc className="w-3.5 h-3.5" />
                  {sortBy === 'scheduledTime' ? 'Scheduled Time' : 'Creation Date'}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              )} nativeButton={true} />
              <DropdownMenuContent align="end" className="min-w-[14rem] rounded-xl border-muted-foreground/10">
                <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => updateQueryParams({ sortBy: 'scheduledTime', sortOrder: 'asc', page: 1 })}
                  className="grid grid-cols-[1fr_20px] items-center gap-2"
                >
                  <span>Scheduled (Soonest First)</span>
                  <div className="flex justify-center text-primary font-bold">
                    {sortBy === 'scheduledTime' && sortOrder === 'asc' && '✓'}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateQueryParams({ sortBy: 'scheduledTime', sortOrder: 'desc', page: 1 })}
                  className="grid grid-cols-[1fr_20px] items-center gap-2"
                >
                  <span>Scheduled (Latest First)</span>
                  <div className="flex justify-center text-primary font-bold">
                    {sortBy === 'scheduledTime' && sortOrder === 'desc' && '✓'}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => updateQueryParams({ sortBy: 'createdAt', sortOrder: 'desc', page: 1 })}
                  className="grid grid-cols-[1fr_20px] items-center gap-2"
                >
                  <span>Created (Newest First)</span>
                  <div className="flex justify-center text-primary font-bold">
                    {sortBy === 'createdAt' && sortOrder === 'desc' && '✓'}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateQueryParams({ sortBy: 'createdAt', sortOrder: 'asc', page: 1 })}
                  className="grid grid-cols-[1fr_20px] items-center gap-2"
                >
                  <span>Created (Oldest First)</span>
                  <div className="flex justify-center text-primary font-bold">
                    {sortBy === 'createdAt' && sortOrder === 'asc' && '✓'}
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TabsContent value="list" className="space-y-6">
          <div className="grid gap-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading scheduled posts...</p>
              </div>
            ) : posts.length === 0 ? (
              <Card className="border-dashed border-2 bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                    <Send className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">No scheduled posts</h3>
                    <p className="text-muted-foreground max-w-xs">You don't have any posts scheduled for the future. Create some in your campaigns!</p>
                  </div>
                  <Button variant="outline" className="rounded-xl px-8" onClick={() => navigate('/campaigns')}>
                    View Campaigns
                  </Button>
                </CardContent>
              </Card>
            ) : (
              posts.map((post) => {
                const mediaUrl = post.mediaUrls?.[0] || '';
                const thumbnailUrl = post.thumbnailUrls?.[0] || '';
                const optimizedUrl = post.optimizedUrls?.[0] || '';
                const mediaKind = getPostMediaKindFromUrl(mediaUrl);
                const previewUrl = getPostPreviewUrl(mediaUrl, thumbnailUrl, optimizedUrl);

                return (
                <Card key={post.id} className="overflow-hidden border-muted-foreground/10 hover:border-primary/30 transition-all group hover:shadow-md rounded-xl bg-card">
                  <div className="flex items-center p-3 gap-4">
                    {/* Media Thumbnail */}
                    <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-muted-foreground/5 shadow-inner">
                      {previewUrl ? (
                        mediaKind === 'video' ? (
                          <div className="relative h-full w-full">
                             {getPostMediaKindFromUrl(previewUrl) === 'image' ? (
                               <img src={previewUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                               <video
                                 src={previewUrl}
                                 className="h-full w-full object-cover"
                                 muted
                                 playsInline
                                 autoPlay
                                 loop
                                 preload="metadata"
                               />
                             )}
                             <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                               <div className="bg-white/20 backdrop-blur-sm p-1 rounded-full">
                                 <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-0.5" />
                               </div>
                             </div>
                          </div>
                        ) : (
                          <img src={previewUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        )
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground/20">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                            {post.campaignName || 'Campaign'}
                          </span>
                          <Badge variant="outline" className={cn(
                            "text-[9px] uppercase font-bold px-1.5 h-4 border-none",
                            post.status === 'Draft' ? "bg-muted text-muted-foreground" :
                            post.status === 'Scheduled' ? "bg-amber-500/10 text-amber-500" :
                            post.status === 'Posted' ? "bg-emerald-500/10 text-emerald-500" :
                            post.status === 'Generating' ? "bg-blue-500/10 text-blue-500" :
                            "bg-destructive/10 text-destructive"
                          )}>
                            {post.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-foreground truncate max-w-md">
                          {post.text || <span className="italic text-muted-foreground/50">No text content</span>}
                        </p>
                      </div>

                      {/* Scheduling Info */}
                      <div className="flex flex-col sm:items-end sm:text-right shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                          <Clock className="w-3 h-3" />
                          {post.scheduledTime ? new Date(post.scheduledTime).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-[10px] text-foreground font-medium">
                          {post.scheduledTime ? new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="shrink-0 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5"
                        onClick={() => navigate(`/campaigns/${post.campaignId}`)}
                        title="Go to Campaign"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card rounded-2xl border border-muted-foreground/10 shadow-sm">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</span> to <span className="font-semibold text-foreground">{Math.min(page * pageSize, totalItems)}</span> of <span className="font-semibold text-foreground">{totalItems}</span> posts
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-muted-foreground/10"
                  onClick={() => updateQueryParams({ page: Math.max(1, page - 1) })}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-sm font-bold min-w-[80px] text-center">
                  Page {page} of {totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-muted-foreground/10"
                  onClick={() => updateQueryParams({ page: Math.min(totalPages, page + 1) })}
                  disabled={page >= totalPages || isLoading}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card className="border-muted-foreground/10 shadow-xl overflow-hidden rounded-2xl">
            <CardHeader className="bg-muted/30 border-b space-y-0 flex flex-row items-center justify-between p-6">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </CardTitle>
                <CardDescription>Scheduled post density per day</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={prevMonth}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button variant="outline" className="rounded-xl font-bold h-9" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={nextMonth}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b bg-muted/20">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-r last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l last:border-b-0">
                {renderCalendar()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
