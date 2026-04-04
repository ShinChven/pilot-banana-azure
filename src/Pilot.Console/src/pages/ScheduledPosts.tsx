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
              <div className="bg-amber-500/10 text-amber-600 text-xs font-bold px-1.5 py-0.5 rounded flex items-center justify-between">
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
          <Card className="border-muted-foreground/10 shadow-xl overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary/80" />
                <p className="text-muted-foreground animate-pulse font-medium">Loading scheduled posts...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                <div className="h-20 w-20 bg-muted/50 rounded-3xl flex items-center justify-center shadow-inner border border-muted-foreground/5">
                  <Send className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold tracking-tight">No scheduled posts</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    You don't have any posts scheduled. Create some high-impact content in your campaigns!
                  </p>
                </div>
                <Button variant="outline" className="rounded-xl px-8 font-bold border-muted-foreground/10 hover:bg-primary/5 hover:text-primary transition-all" onClick={() => navigate('/campaigns')}>
                  Explore Campaigns
                </Button>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* List Header - Desktop Only */}
                <div className="hidden lg:grid lg:grid-cols-[80px_1fr_180px_100px] items-center gap-6 px-6 py-4 bg-muted/40 border-b border-muted-foreground/10 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
                  <span>Preview</span>
                  <span>Post Details</span>
                  <span>Schedule</span>
                  <span className="text-right">Action</span>
                </div>

                {/* List Items */}
                <div className="divide-y divide-muted-foreground/5">
                  {posts.map((post) => {
                    const mediaUrl = post.mediaUrls?.[0] || '';
                    const thumbnailUrl = post.thumbnailUrls?.[0] || '';
                    const optimizedUrl = post.optimizedUrls?.[0] || '';
                    const mediaKind = getPostMediaKindFromUrl(mediaUrl);
                    const previewUrl = getPostPreviewUrl(mediaUrl, thumbnailUrl, optimizedUrl);

                    return (
                      <div key={post.id} className="group hover:bg-primary/[0.02] transition-all duration-300 px-4 py-4 sm:px-6 sm:py-5 flex items-center gap-4 sm:gap-6 lg:grid lg:grid-cols-[80px_1fr_180px_100px]">
                        {/* Media Thumbnail */}
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-muted-foreground/5 shadow-md transition-transform group-hover:scale-105 duration-500">
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
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="bg-white/30 backdrop-blur-md p-1.5 rounded-full shadow-lg">
                                    <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img src={previewUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            )
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground/20 bg-muted/10">
                              <ImageIcon className="w-8 h-8" />
                            </div>
                          )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5 lg:gap-2">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/10 shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                              {post.campaignName || 'General Campaign'}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[9px] uppercase font-black px-2 h-5 border-none shadow-sm",
                              post.status === 'Draft' ? "bg-muted text-muted-foreground" :
                              post.status === 'Scheduled' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                              post.status === 'Posted' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                              post.status === 'Generating' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                              "bg-destructive/10 text-destructive"
                            )}>
                              {post.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                              {post.text || <span className="italic font-normal text-muted-foreground/40">No caption provided</span>}
                            </p>
                            {post.text && post.text.length > 80 && (
                              <p className="text-xs text-muted-foreground line-clamp-1 opacity-70">
                                {post.text.substring(0, 150)}...
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Scheduling Info */}
                        <div className="hidden lg:flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold tracking-tight">
                            <CalendarIcon className="w-3.5 h-3.5 text-primary/60" />
                            {post.scheduledTime ? new Date(post.scheduledTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Date'}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-black text-foreground/80">
                            <Clock className="w-3.5 h-3.5 text-primary/60" />
                            {post.scheduledTime ? new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0 flex items-center justify-end">
                          {/* Mobile-only scheduling info */}
                          <div className="flex flex-col items-end mr-4 lg:hidden">
                             <span className="text-[10px] font-bold text-muted-foreground">
                               {post.scheduledTime ? new Date(post.scheduledTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                             </span>
                             <span className="text-[10px] font-black text-foreground">
                               {post.scheduledTime ? new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                             </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                            onClick={() => navigate(`/campaigns/${post.campaignId}`)}
                            title="Go to Campaign"
                          >
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card/40 backdrop-blur-sm rounded-2xl border border-muted-foreground/10 shadow-lg">
              <div className="text-sm text-muted-foreground font-medium">
                Showing <span className="font-black text-foreground">{(page - 1) * pageSize + 1}</span> to <span className="font-black text-foreground">{Math.min(page * pageSize, totalItems)}</span> of <span className="font-black text-foreground">{totalItems}</span> posts
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-muted-foreground/10 bg-card/60 hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-30"
                  onClick={() => updateQueryParams({ page: Math.max(1, page - 1) })}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-xs font-black min-w-[100px] text-center bg-muted/40 h-10 flex items-center justify-center rounded-xl border border-muted-foreground/5 shadow-inner">
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
                  <div key={day} className="py-3 text-center text-xs font-black uppercase tracking-[0.2em] text-muted-foreground border-r last:border-r-0">
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
