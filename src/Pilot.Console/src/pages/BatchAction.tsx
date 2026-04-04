import * as React from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/src/components/ui/table";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Search,
  Image as ImageIcon,
  Trash2,
  Send,
  Clock,
  MoreHorizontal,
  CheckCircle2,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Filter,
  SortAsc,
  ChevronDown,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";
import { Campaign, ScheduledPost } from '../types';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/src/components/ui/dialog";
import { useAuth } from '../context/AuthContext';
import { getCampaign } from '../api/campaigns';
import { listPosts, deletePost, sendPost, batchSchedulePosts, batchUnschedulePosts } from '../api/posts';
import { BatchAiGenerateModal } from '../components/BatchAiGenerateModal';
import { BatchScheduleModal } from '../components/BatchScheduleModal';

export default function BatchActionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();

  // Search and Filter State from URL
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchParams.get('q') || '');
  const statusFilter = searchParams.get('status') || 'all';
  const sortBy = searchParams.get('sortBy') || 'scheduledTime';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Pagination State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
  const [totalItems, setTotalItems] = React.useState(0);

  const [selectedPosts, setSelectedPosts] = React.useState<string[]>([]);
  const [previewImages, setPreviewImages] = React.useState<string[] | null>(null);

  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [posts, setPosts] = React.useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
  };

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery !== (searchParams.get('q') || '')) {
        updateQueryParams({ q: searchQuery, page: 1 });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = React.useCallback(async (silent = false) => {
    if (!token || !id || !user) return;
    if (!silent) setIsLoading(true);
    try {
      const [campRes, postRes] = await Promise.all([
        getCampaign(id, token),
        listPosts(
          user.id, 
          id, 
          token, 
          page, 
          pageSize, 
          statusFilter === 'all' ? undefined : statusFilter, 
          debouncedSearch,
          sortBy,
          sortOrder
        )
      ]);

      if (campRes.data) {
        const c = campRes.data;
        setCampaign({
          id: c.id,
          name: c.name,
          description: '',
          status: c.status === 'Active' ? 'Active' : 'Inactive',
          startDate: '',
          endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : '',
          channels: c.channelLinkIds || [],
          posts: [],
          thumbnail: '',
          totalPosts: c.totalPosts,
          postedPosts: c.postedPosts
        });
      }

      if (postRes.data) {
        setPosts(postRes.data.items.map(p => ({
          id: p.id,
          content: p.text || '',
          images: p.mediaUrls || [],
          optimizedUrls: p.optimizedUrls || [],
          thumbnailUrls: p.thumbnailUrls || [],
          scheduledAt: p.scheduledTime || '',
          status: p.status as any,
          channels: campRes.data?.channelLinkIds || []
        })));
        setTotalItems(postRes.data.total);
      }
    } catch (err) {
      if (!silent) toast.error("Error loading data");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [token, id, user, page, pageSize, statusFilter, debouncedSearch, sortBy, sortOrder]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling for generating posts
  React.useEffect(() => {
    const hasGenerating = posts.some(p => p.status === 'Generating');
    if (!hasGenerating) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, 10000); // 10 seconds for more responsive updates when generating

    return () => clearInterval(interval);
  }, [posts, fetchData]);

  if (isLoading && !campaign) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium animate-pulse">Loading batch actions...</p>
        </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-2xl font-bold">Campaign not found</h2>
        <Button variant="link" onClick={() => navigate('/campaigns')}>Back to Campaigns</Button>
      </div>
    );
  }

  const toggleSelectAll = () => {
    if (selectedPosts.length === posts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(posts.map(p => p.id));
    }
  };

  const toggleSelectPost = (postId: string) => {
    setSelectedPosts(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const handleBatchDelete = () => {
    if (selectedPosts.length === 0 || !token || !user || !id) return;
    setIsDeleteDialogOpen(true);
  };

  const confirmBatchDelete = async () => {
    if (selectedPosts.length === 0 || !token || !user || !id) return;

    setIsDeleting(true);
    try {
        let successCount = 0;
        for (const postId of selectedPosts) {
            const { error } = await deletePost(user.id, id, postId, token);
            if (!error) successCount++;
        }

        toast.success(`Deleted ${successCount} posts`);
        setSelectedPosts([]);
        fetchData(true);
    } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
    }
  };

  const handleBatchSend = async () => {
    if (selectedPosts.length === 0 || !token || !user || !id) return;
    if (campaign?.status !== 'Active') {
      toast.error('Campaign is inactive', { description: 'Activate the campaign before sending posts.' });
      return;
    }

    let successCount = 0;
    for (const postId of selectedPosts) {
        try {
            await sendPost(user.id, id, postId, token);
            successCount++;
        } catch {}
    }

    toast.success(`Sent ${successCount} posts to all channels`);
    setSelectedPosts([]);
    fetchData(true);
  };

  const handleBatchSchedule = async (schedules: { postId: string; scheduledTime: string }[]) => {
    if (!token || !user || !id) return;
    
    const { data, error } = await batchSchedulePosts(user.id, id, schedules, token);
    
    if (error) {
      toast.error("Failed to schedule posts");
      return;
    }

    toast.success(`Successfully scheduled ${data?.count} posts`);
    setSelectedPosts([]);
    fetchData(true);
  };

  const handleBatchUnschedule = async () => {
    if (selectedPosts.length === 0 || !token || !user || !id) return;

    const { data, error } = await batchUnschedulePosts(user.id, id, selectedPosts, token);
    
    if (error) {
      toast.error("Failed to unschedule posts");
      return;
    }

    toast.success(`Successfully unscheduled ${data?.count} posts`);
    setSelectedPosts([]);
    fetchData(true);
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Batch Actions</h1>
          <p className="text-muted-foreground">Manage multiple posts for <span className="font-semibold text-primary">{campaign.name}</span></p>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button
            className="gap-2 h-10 rounded-xl"
            onClick={() => navigate(`/campaigns/${id}/batch/create`)}
          >
            <Plus className="w-4 h-4" /> Create Batch
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-card p-4 rounded-2xl border border-muted-foreground/10 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search posts by content..."
              className="pl-10 h-10 bg-muted/30 border-muted-foreground/5 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={(val) => { updateQueryParams({ status: val, page: 1 }); }}>
              <SelectTrigger className="w-full sm:w-[160px] h-10 bg-muted/30 border-muted-foreground/5 rounded-xl">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Status" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-muted-foreground/10">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Posted">Posted</SelectItem>
                <SelectItem value="Generating">Generating</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger render={(props) => (
                <Button {...props} variant="outline" size="sm" className="h-10 gap-2 bg-muted/30 border-muted-foreground/5 text-muted-foreground flex-1 sm:flex-none justify-between sm:justify-center min-w-[140px] rounded-xl">
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

        <div className="flex items-center justify-between border-t border-muted-foreground/5 pt-4">
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {selectedPosts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 flex-wrap"
                >
                  <span className="text-sm font-semibold text-primary mr-2 px-2 py-0.5 bg-primary/10 rounded-full">
                    {selectedPosts.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                    onClick={() => setIsAiModalOpen(true)}
                  >
                    <Sparkles className="w-4 h-4" /> AI Generate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                    onClick={() => setIsScheduleModalOpen(true)}
                  >
                    <Clock className="w-4 h-4" /> Schedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 rounded-xl border-muted-foreground/20 text-muted-foreground hover:bg-muted/5"
                    onClick={handleBatchUnschedule}
                  >
                    <X className="w-4 h-4" /> Unschedule
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9 gap-2 rounded-xl"
                    onClick={handleBatchDelete}
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 gap-2 rounded-xl shadow-md shadow-primary/20"
                    onClick={handleBatchSend}
                    disabled={campaign.status !== 'Active'}
                  >
                    <Send className="w-4 h-4" /> Send Now
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-muted-foreground/10 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-muted-foreground/10">
              <TableHead className="w-[50px]">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-muted-foreground/20 text-primary focus:ring-primary bg-background"
                    checked={posts.length > 0 && selectedPosts.length === posts.length}
                    onChange={toggleSelectAll}
                  />
                </div>
              </TableHead>
              <TableHead className="min-w-[300px]">Post Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Media</TableHead>
              <TableHead className="text-right px-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell colSpan={6}>
                    <div className="h-12 bg-muted/50 rounded-lg w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <TableRow key={post.id} className={cn("border-muted-foreground/5 transition-colors", selectedPosts.includes(post.id) && "bg-primary/5")}>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-muted-foreground/20 text-primary focus:ring-primary bg-background"
                        checked={selectedPosts.includes(post.id)}
                        onChange={() => toggleSelectPost(post.id)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[400px]">
                    <p className="text-sm text-foreground line-clamp-2 font-medium">{post.content || <span className="text-muted-foreground italic">No content</span>}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs uppercase tracking-widest font-bold h-5 px-2 border-none",
                        post.status === 'Draft' ? "bg-muted text-muted-foreground" :
                        post.status === 'Scheduled' ? "bg-amber-500/10 text-amber-500" :
                        post.status === 'Posted' ? "bg-emerald-500/10 text-emerald-500" :
                        post.status === 'Generating' ? "bg-blue-500/10 text-blue-500" :
                        "bg-destructive/10 text-destructive"
                      )}
                    >
                      {post.status === 'Generating' ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Generating
                        </span>
                      ) : post.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'Not scheduled'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {post.images && post.images.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 rounded-full border-muted-foreground/10 hover:bg-muted/50"
                        onClick={() => setPreviewImages(post.optimizedUrls || post.images || [])}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span className="text-xs">{post.images.length}</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No media</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full" onClick={() => navigate(`/campaigns/${id}/posts/edit/${post.id}`)}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-60 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Search className="w-12 h-12 mb-4 opacity-10" />
                    <p className="text-lg font-medium">No posts found</p>
                    <p className="text-sm opacity-70">Try adjusting your filters or search query.</p>
                    <Button variant="link" className="mt-2 text-primary" onClick={() => { setSearchQuery(''); updateQueryParams({ q: '', status: 'all', page: 1 }); }}>Clear all filters</Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Controller */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-muted/20 border-t border-muted-foreground/10">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            Showing <span className="font-semibold text-foreground">{posts.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-semibold text-foreground">{(page - 1) * pageSize + posts.length}</span> of <span className="font-semibold text-foreground">{totalItems}</span> posts
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

      <Dialog open={!!previewImages} onOpenChange={(open) => !open && setPreviewImages(null)}>
        <DialogContent className="max-w-3xl rounded-3xl bg-card border-muted-foreground/10">
          <DialogHeader>
            <DialogTitle>Post Media</DialogTitle>
            <DialogDescription>Viewing all images attached to this post.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {previewImages?.map((img, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-muted-foreground/10 shadow-sm bg-muted">
                <img src={img} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-2xl border-muted-foreground/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Confirm Batch Delete
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete <span className="font-bold text-foreground">{selectedPosts.length}</span> selected posts?
              <br /><br />
              This action <span className="font-bold text-destructive underline">cannot be undone</span> and will permanently remove these posts and their media from the campaign.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-xl border-muted-foreground/10"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBatchDelete}
              className="rounded-xl font-bold gap-2"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Posts
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchAiGenerateModal
        isOpen={isAiModalOpen}
        onOpenChange={setIsAiModalOpen}
        campaignId={id!}
        selectedPostIds={selectedPosts}
        onSuccess={() => {
          setSelectedPosts([]);
          fetchData();
        }}
      />
      <BatchScheduleModal
        isOpen={isScheduleModalOpen}
        onOpenChange={setIsScheduleModalOpen}
        postIds={selectedPosts}
        onSchedule={handleBatchSchedule}
      />
    </div>
  );
}
