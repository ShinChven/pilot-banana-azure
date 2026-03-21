import * as React from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Separator } from "@/src/components/ui/separator";
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
  Calendar,
  Clock,
  Layers,
  Share2,
  Settings,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Instagram,
  Linkedin,
  Facebook,
  Search,
  Plus,
  ImagePlus,
  GripVertical,
  Trash2,
  Send,
  Pause,
  Play,
  ChevronDown,
  Filter,
  SortAsc,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from "motion/react";
import { XIcon } from '@/src/components/XIcon';
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/src/components/ui/dialog";
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { ScheduledPost, Campaign, Channel } from '../types';
import { useAuth } from '../context/AuthContext';
import { getCampaign, updateCampaign, type CampaignResponse } from '../api/campaigns';
import { listPosts, deletePost, sendPost, updatePost, batchUnschedulePosts, type PostResponse } from '../api/posts';
import { listChannels } from '../api/channels';
import { BatchAiGenerateModal } from '../components/BatchAiGenerateModal';

/**
 * Formats a Date object to the YYYY-MM-DDTHH:mm format required by <input type="datetime-local" />
 * while respecting the user's local timezone.
 */
function toDatetimeLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function isVideo(url: string) {
  return url.toLowerCase().endsWith('.mp4') || url.includes('video');
}

const MediaElement = ({ 
  src, 
  className, 
  alt, 
  onClick,
  controls = false,
  autoPlay = false,
  loop = false,
  muted = false
}: { 
  src: string; 
  className?: string; 
  alt?: string; 
  onClick?: () => void;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  key?: React.Key;
}) => {
  if (isVideo(src)) {
    return (
      <video
        src={src}
        className={className}
        onClick={onClick}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      referrerPolicy="no-referrer"
    />
  );
};

const Lightbox = ({
  images,
  initialIndex,
  isOpen,
  onClose
}: {
  images: string[],
  initialIndex: number,
  isOpen: boolean,
  onClose: () => void
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const handleNext = React.useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = React.useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95 backdrop-blur-md z-[100]" />
        <div className="fixed inset-0 z-[101] flex items-center justify-center outline-none">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 right-6 text-white hover:bg-white/10 z-[102] rounded-full h-12 w-12"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </Button>

          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-6 text-white hover:bg-white/10 z-[102] rounded-full h-14 w-14 hidden md:flex"
                onClick={handlePrev}
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-6 text-white hover:bg-white/10 z-[102] rounded-full h-14 w-14 hidden md:flex"
                onClick={handleNext}
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </>
          )}

          <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: -20 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) handlePrev();
                  else if (info.offset.x < -100) handleNext();
                }}
                className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
              >
                <MediaElement 
                  src={images[currentIndex]} 
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                  controls={isVideo(images[currentIndex])}
                  autoPlay={isVideo(images[currentIndex])}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-[102]">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  i === currentIndex ? "bg-white w-6" : "bg-white/30 hover:bg-white/50"
                )}
              />
            ))}
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
};

const PostMedia = ({ images }: { images?: string[] }) => {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  if (!images || images.length === 0) return null;

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setLightboxOpen(true);
  };

  const count = images.length;

  if (count === 1) {
    return (
      <>
        <div
          className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200/60 shadow-sm cursor-zoom-in"
          onClick={() => openLightbox(0)}
        >
          <MediaElement
            src={images[0]}
            alt="Post content"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </div>
        <Lightbox
          images={images}
          initialIndex={selectedIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  if (count === 2) {
    return (
      <>
        <div className="grid grid-cols-2 gap-1.5 aspect-video w-full overflow-hidden rounded-xl border border-slate-200/60 shadow-sm">
          {images.map((img, i) => (
            <MediaElement
              key={i}
              src={img}
              alt={`Post content ${i + 1}`}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105 cursor-zoom-in"
              onClick={() => openLightbox(i)}
            />
          ))}
        </div>
        <Lightbox
          images={images}
          initialIndex={selectedIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  if (count === 3) {
    return (
      <>
        <div className="grid grid-cols-3 grid-rows-2 gap-1.5 aspect-video w-full overflow-hidden rounded-xl border border-slate-200/60 shadow-sm">
          <MediaElement
            src={images[0]}
            alt="Post content 1"
            className="col-span-2 row-span-2 h-full w-full object-cover transition-transform duration-500 hover:scale-105 cursor-zoom-in"
            onClick={() => openLightbox(0)}
          />
          <MediaElement
            src={images[1]}
            alt="Post content 2"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105 cursor-zoom-in"
            onClick={() => openLightbox(1)}
          />
          <MediaElement
            src={images[2]}
            alt="Post content 3"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105 cursor-zoom-in"
            onClick={() => openLightbox(2)}
          />
        </div>
        <Lightbox
          images={images}
          initialIndex={selectedIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  if (count === 4) {
    return (
      <>
        <div className="grid grid-cols-2 grid-rows-2 gap-1.5 aspect-video w-full overflow-hidden rounded-xl border border-slate-200/60 shadow-sm">
          {images.map((img, i) => (
            <MediaElement
              key={i}
              src={img}
              alt={`Post content ${i + 1}`}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105 cursor-zoom-in"
              onClick={() => openLightbox(i)}
            />
          ))}
        </div>
        <Lightbox
          images={images}
          initialIndex={selectedIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  // 5 or more images
  return (
    <>
      <div className="grid grid-cols-3 grid-rows-2 gap-1.5 aspect-video w-full overflow-hidden rounded-xl border border-slate-200/60 shadow-sm">
        <MediaElement
          src={images[0]}
          alt="Post content 1"
          className="col-span-2 row-span-2 h-full w-full object-cover transition-transform duration-500 hover:scale-105 cursor-zoom-in"
          onClick={() => openLightbox(0)}
        />
        <MediaElement
          src={images[1]}
          alt="Post content 2"
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105 cursor-zoom-in"
          onClick={() => openLightbox(1)}
        />
        <div
          className="relative h-full w-full overflow-hidden cursor-zoom-in"
          onClick={() => openLightbox(2)}
        >
          <MediaElement
            src={images[2]}
            alt="Post content 3"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
          {count > 3 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] text-white font-bold text-xl transition-colors hover:bg-black/40">
              +{count - 3}
            </div>
          )}
        </div>
      </div>
      <Lightbox
        images={images}
        initialIndex={selectedIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
};

export default function CampaignProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = React.useState<'date-desc' | 'date-asc' | 'content'>('date-desc');
  const statusFilter = searchParams.get('status');

  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [posts, setPosts] = React.useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Pagination State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
  const [totalItems, setTotalItems] = React.useState(0);

  const [quickSchedulingId, setQuickSchedulingId] = React.useState<string | null>(null);
  const [quickDate, setQuickDate] = React.useState('');
  const [quickSchedulingSavingId, setQuickSchedulingSavingId] = React.useState<string | null>(null);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [postToDelete, setPostToDelete] = React.useState<ScheduledPost | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [currentAiPostId, setCurrentAiPostId] = React.useState<string | null>(null);

  const updateQueryParams = (newParams: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value.toString());
      }
    });
    setSearchParams(params);
  };

  const fetchData = React.useCallback(async (silent = false) => {
    if (!token || !id || !user) return;
    if (!silent) setIsLoading(true);
    try {
      const [campRes, chanRes, postRes] = await Promise.all([
        getCampaign(id, token),
        listChannels(token, 1, 100),
        listPosts(user.id, id, token, page, pageSize, statusFilter || undefined, searchParams.get('q') || undefined)
      ]);

      if (campRes.data) {
        const c = campRes.data;
        setCampaign({
          id: c.id,
          name: c.name,
          description: c.description || `Created on ${new Date(c.createdAt).toLocaleDateString()}`,
          status: c.status === 'Active' ? 'Active' : 'Inactive',
          startDate: new Date(c.createdAt).toLocaleDateString(),
          endDate: '-',
          channels: c.channelLinkIds,
          posts: [],
          thumbnail: ''
        });
      }

      if (chanRes.data) {
        setChannels(chanRes.data.items.map(c => ({
          id: c.id,
          platform: c.platform.toUpperCase() as any,
          username: c.displayName || c.username || c.externalId,
          handle: c.username ? `@${c.username}` : undefined,
          avatar: c.avatarUrl || c.profileUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.id}`,
          profileUrl: c.profileUrl || undefined,
          status: c.isEnabled ? 'Connected' : 'Disconnected',
          followers: 0,
          lastSync: new Date(c.createdAt).toLocaleDateString(),
          enabled: c.isEnabled
        })));
      }

      if (postRes.data) {
        setTotalItems(postRes.data.total);
        setPosts(postRes.data.items.map(p => ({
          id: p.id,
          content: p.text || '',
          images: p.mediaUrls || [],
          scheduledAt: p.scheduledTime || '',
          status: p.status as any,
          channels: campRes.data?.channelLinkIds || [],
          postUrl: p.postUrl
        })));
      }
    } catch (err) {
      if (!silent) toast.error('Error loading campaign data');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [token, id, user, page, pageSize, statusFilter, searchParams]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling for generating posts
  React.useEffect(() => {
    const hasGenerating = posts.some(p => p.status === 'Generating');
    if (!hasGenerating) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [posts, fetchData]);

  const connectedChannels = channels.filter(ch => campaign?.channels.includes(ch.id));

  const filteredPosts = [...posts]
    .sort((a, b) => {
      if (sortBy === 'date-desc') {
        if (!a.scheduledAt) return 1;
        if (!b.scheduledAt) return -1;
        return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
      }
      if (sortBy === 'date-asc') {
        if (!a.scheduledAt) return 1;
        if (!b.scheduledAt) return -1;
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      }
      if (sortBy === 'content') return a.content.localeCompare(b.content);
      return 0;
    });

  const totalPages = Math.ceil(totalItems / pageSize);

  const handleAddPost = () => {
    navigate(`/campaigns/${id}/posts/new`);
  };

  const handleEditPost = (post: ScheduledPost) => {
    navigate(`/campaigns/${id}/posts/edit/${post.id}`);
  };

  const openDeleteDialog = (post: ScheduledPost) => {
    setPostToDelete(post);
    setIsDeleteDialogOpen(true);
  };

  const handleDeletePost = async () => {
    if (!token || !user || !id || !postToDelete) return;
    const postId = postToDelete.id;
    try {
        const { error } = await deletePost(user.id, id, postId, token);
        if (error) {
            toast.error('Failed to delete post', { description: error });
        } else {
            setPosts(prev => prev.filter(p => p.id !== postId));
            toast.success("Post deleted");
            setIsDeleteDialogOpen(false);
            setPostToDelete(null);
        }
    } catch (err) {
        toast.error('Error deleting post');
    }
  }

  const handleSendNow = async (postId: string) => {
    if (!token || !user || !id) return;
    if (campaign?.status !== 'Active') {
      toast.error('Campaign is inactive', { description: 'Activate the campaign before sending posts.' });
      return;
    }

    toast.promise(
      sendPost(user.id, id, postId, token),
      {
        loading: 'Sending post to target channels...',
        success: 'Post has been sent successfully!',
        error: (err) => `Failed to send post: ${err.message}`,
      }
    );
  };

  const handleUnschedule = async (postId: string) => {
    if (!token || !user || !id) return;
    
    const { error } = await batchUnschedulePosts(user.id, id, [postId], token);
    
    if (error) {
      toast.error("Failed to unschedule post");
      return;
    }

    toast.success("Post unscheduled");
    fetchData();
  };

  const handleQuickScheduleSave = async (post: ScheduledPost) => {
    if (!token || !user || !id) return;
    if (!quickDate) {
      toast.error('Please select a schedule time');
      return;
    }

    setQuickSchedulingSavingId(post.id);
    try {
      const nextStatus = 'Scheduled';
      const utcDate = new Date(quickDate).toISOString();
      const { error } = await updatePost(
        user.id,
        id,
        post.id,
        post.content,
        [],
        token,
        post.images || [],
        nextStatus,
        utcDate
      );

      if (error) {
        toast.error('Failed to schedule post', { description: error });
        return;
      }

      const formattedSchedule = new Date(quickDate).toLocaleString();
      setPosts(prev => prev.map(p => p.id === post.id ? {
        ...p,
        scheduledAt: formattedSchedule,
        status: 'Scheduled'
      } : p));

      toast.success('Post scheduled');
      setQuickSchedulingId(null);
      setQuickDate('');
    } catch (err) {
      toast.error('Error scheduling post');
    } finally {
      setQuickSchedulingSavingId(null);
    }
  };

  const toggleCampaignStatus = async () => {
    if (!token || !id || !campaign) return;
    const shouldActivate = campaign.status !== 'Active';
    const apiStatus = shouldActivate ? 'Active' : 'Paused';
    const nextStatus = shouldActivate ? 'Active' : 'Inactive';
    try {
      const { error } = await updateCampaign(id, { status: apiStatus }, token);
        if (error) {
            toast.error('Failed to update campaign', { description: error });
        } else {
        setCampaign({ ...campaign, status: nextStatus });
        toast.success(`Campaign ${shouldActivate ? 'resumed' : 'paused'}`);
        }
    } catch (err) {
        toast.error('Error updating campaign');
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toUpperCase()) {
      case 'X': return <XIcon className="w-4 h-4" />;
      case 'INSTAGRAM': return <Instagram className="w-4 h-4" />;
      case 'LINKEDIN': return <Linkedin className="w-4 h-4" />;
      case 'FACEBOOK': return <Facebook className="w-4 h-4" />;
      default: return null;
    }
  };

  if (isLoading && !campaign) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium animate-pulse">Loading campaign details...</p>
        </div>
    );
  }

  if (!campaign) {
    return (
        <div className="text-center py-12">
            <h2 className="text-2xl font-bold">Campaign not found</h2>
            <Button variant="link" onClick={() => navigate('/campaigns')}>Back to Campaigns</Button>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{campaign.name}</h1>
              <Badge variant="outline" className={cn(
                "h-6",
                campaign.status === 'Active' ? "border-emerald-500 text-emerald-500" : "border-amber-500 text-amber-500"
              )}>{campaign.status}</Badge>
            </div>
            <p className="text-muted-foreground">{campaign.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/campaigns/edit/${campaign.id}`)}>
            <Settings className="w-4 h-4" /> Settings
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/campaigns/${campaign.id}/batch`)}>
            <Layers className="w-4 h-4" /> Batch Actions
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/campaigns/${campaign.id}/history`)}>
            <Clock className="w-4 h-4" /> History
          </Button>
          <Button className="gap-2" onClick={handleAddPost}>
            <Plus className="w-4 h-4" /> Add Post
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-primary text-primary-foreground border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-80">Campaign Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {posts.length > 0
                    ? Math.round((posts.filter(p => p.status === 'Posted').length / posts.length) * 100)
                    : 0}%
              </div>
              <div className="mt-2 h-1.5 w-full bg-primary-foreground/20 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary-foreground w-[0%]"
                    style={{ width: `${posts.length > 0 ? (posts.filter(p => p.status === 'Posted').length / posts.length) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs opacity-80">
                {posts.filter(p => p.status === 'Posted').length} of {posts.length} posts published
              </p>
              <Button
                variant={campaign.status === 'Active' ? "outline" : "secondary"}
                className={cn(
                  "w-full mt-4 gap-2 transition-colors",
                  campaign.status === 'Active'
                    ? "border-primary-foreground/20 hover:bg-primary-foreground/10 bg-transparent text-primary-foreground"
                    : "bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-none"
                )}
                onClick={toggleCampaignStatus}
              >
                {campaign.status === 'Active' ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause Campaign
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Resume Campaign
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-muted-foreground/10 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Campaign Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-medium text-foreground">{campaign.startDate}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">End Date</span>
                <span className="font-medium text-foreground">{campaign.endDate}</span>
              </div>
              <Separator className="bg-muted-foreground/5" />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connected Channels</p>
                <div className="space-y-2">
                  {connectedChannels.map(channel => (
                    <div key={channel.id} className={cn(
                      "flex items-center justify-between p-2 rounded-lg border transition-all",
                      channel.enabled ? "bg-muted/30 border-muted-foreground/5" : "bg-muted/10 border-muted-foreground/5 opacity-60 grayscale"
                    )}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6 border shrink-0">
                          <AvatarImage src={channel.avatar} />
                          <AvatarFallback>{channel.username[0]}</AvatarFallback>
                        </Avatar>
                        {channel.profileUrl ? (
                          <a 
                            href={channel.profileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex flex-col min-w-0 hover:text-primary transition-colors group/link"
                          >
                            <span className="text-xs font-medium truncate max-w-[100px] text-foreground group-hover/link:text-primary">{channel.username}</span>
                            {channel.handle && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[100px] leading-tight">{channel.handle}</span>
                            )}
                          </a>
                        ) : (
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium truncate max-w-[100px] text-foreground">{channel.username}</span>
                            {channel.handle && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[100px] leading-tight">{channel.handle}</span>
                            )}
                          </div>
                        )}
                        {!channel.enabled && <span className="text-[8px] uppercase font-bold text-muted-foreground ml-1 shrink-0">Disabled</span>}
                      </div>
                      <div className="text-muted-foreground shrink-0">
                        {getPlatformIcon(channel.platform)}
                      </div>
                    </div>
                  ))}
                  {connectedChannels.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No channels connected.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Scheduled Posts */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-foreground">Scheduled Posts</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  className="pl-10 w-full sm:w-64 h-9 bg-card border-muted-foreground/10 transition-all"
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
                  <Button {...props} variant="outline" size="sm" className="h-9 gap-2 border-muted-foreground/10 text-muted-foreground flex-1 sm:flex-none justify-between sm:justify-center min-w-[140px]">
                    <Filter className="w-3.5 h-3.5" />
                    {statusFilter || 'All Status'}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                )} nativeButton={true} />
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => updateQueryParams({ status: null, page: 1 })}>All Status</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateQueryParams({ status: 'Scheduled', page: 1 })}>Scheduled</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateQueryParams({ status: 'Posted', page: 1 })}>Posted</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateQueryParams({ status: 'Draft', page: 1 })}>Draft</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateQueryParams({ status: 'Failed', page: 1 })}>Failed</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger render={(props) => (
                  <Button {...props} variant="outline" size="sm" className="h-9 gap-2 border-muted-foreground/10 text-muted-foreground flex-1 sm:flex-none justify-between sm:justify-center min-w-[110px]">
                    <SortAsc className="w-3.5 h-3.5" />
                    Sort
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                )} nativeButton={true} />
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSortBy('date-desc')}>Newest First</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('date-asc')}>Oldest First</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('content')}>Content (A-Z)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-8">
            {filteredPosts.map((post) => (
              <Card key={post.id} className="overflow-hidden border border-muted-foreground/5 shadow-xl hover:shadow-primary/5 transition-all duration-300 group bg-card rounded-2xl">
                <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-3">
                        {connectedChannels.map(ch => (
                            <div
                              key={ch.id}
                              className={cn(
                                "h-10 w-10 rounded-full ring-4 ring-card bg-muted overflow-hidden border border-muted-foreground/5 shadow-sm transition-all",
                                !ch.enabled && "opacity-40 grayscale"
                              )}
                              title={ch.platform + (ch.enabled ? "" : " (Disabled)")}
                            >
                              <img src={ch.avatar} alt={ch.username} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-bold text-foreground tracking-tight">
                            {connectedChannels.length} {connectedChannels.length === 1 ? 'Channel' : 'Channels'}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase tracking-widest font-bold h-5 px-2 border-none",
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
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                          <Clock className="w-3 h-3" />
                          {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'Not scheduled'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 sm:transform sm:translate-x-2 sm:group-hover:translate-x-0 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-primary hover:bg-primary/5 rounded-full"
                        title="AI Generate"
                        onClick={() => {
                          setCurrentAiPostId(post.id);
                          setIsAiModalOpen(true);
                        }}
                      >
                        <Sparkles className="w-4.5 h-4.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                        onClick={() => openDeleteDialog(post)}
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap font-medium tracking-tight">
                      {post.content}
                    </p>

                    <PostMedia images={post.images} />
                  </div>

                  <div className="pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-muted-foreground/5">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {quickSchedulingId === post.id ? (
                        <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-left-2 w-full sm:w-auto">
                          <Input
                            type="datetime-local"
                            className="h-10 w-full sm:w-48 text-xs rounded-full border-primary/20 focus:border-primary bg-background"
                            value={quickDate}
                            onChange={(e) => setQuickDate(e.target.value)}
                          />
                          <Button
                            size="sm"
                            className="h-10 px-4 rounded-full font-bold"
                            onClick={() => handleQuickScheduleSave(post)}
                            disabled={quickSchedulingSavingId === post.id}
                          >
                            {quickSchedulingSavingId === post.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-full text-muted-foreground"
                            onClick={() => setQuickSchedulingId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2 transition-all font-bold h-10 px-5 rounded-full shadow-lg shadow-primary/20 w-full sm:w-auto"
                            onClick={() => handleSendNow(post.id)}
                            disabled={campaign.status !== 'Active'}
                          >
                            <Send className="w-3.5 h-3.5" /> {post.status === 'Posted' ? 'Send Again' : 'Send Now'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground h-10 px-5 rounded-full border-muted-foreground/10 font-bold w-full sm:w-auto"
                            onClick={() => handleEditPost(post)}
                          >
                            Edit Post
                          </Button>
                          {!post.scheduledAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 h-10 px-4 rounded-full font-bold w-full sm:w-auto"
                              onClick={() => {
                                setQuickSchedulingId(post.id);
                                const defaultTime = new Date();
                                defaultTime.setHours(defaultTime.getHours() + 1);
                                setQuickDate(toDatetimeLocal(defaultTime));
                              }}
                            >
                              Schedule
                            </Button>
                          )}
                          {post.scheduledAt && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 h-10 px-4 rounded-full font-bold w-full sm:w-auto"
                                onClick={() => {
                                  setQuickSchedulingId(post.id);
                                  const defaultTime = new Date(post.scheduledAt || new Date());
                                  if (isNaN(defaultTime.getTime())) {
                                      defaultTime.setHours(new Date().getHours() + 1);
                                  }
                                  setQuickDate(toDatetimeLocal(defaultTime));
                                }}
                              >
                                Reschedule
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground h-10 px-4 rounded-full font-bold w-full sm:w-auto"
                                onClick={() => handleUnschedule(post.id)}
                              >
                                Unschedule
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {post.status === 'Posted' ? (
                      <div className="flex items-center gap-4 self-start sm:self-auto">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-[11px] text-emerald-500 font-bold uppercase tracking-wider">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Published
                        </div>
                        {post.postUrl && (
                          <a 
                            href={post.postUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                          >
                            View Post <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-[11px] text-muted-foreground font-bold uppercase tracking-wider self-start sm:self-auto">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {post.status}
                        </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {filteredPosts.length === 0 && !isLoading && (
                <div className="text-center py-12 bg-muted/20 border border-dashed rounded-3xl">
                    <p className="text-muted-foreground">No posts found in this campaign.</p>
                    <Button variant="link" onClick={handleAddPost}>Create your first post</Button>
                </div>
            )}

            {/* Pagination Controller */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card rounded-3xl border border-muted-foreground/10 shadow-sm mt-6">
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
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground italic line-clamp-3 border-l-2 pl-3">
              "{postToDelete?.content}"
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePost}>Delete Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchAiGenerateModal
        isOpen={isAiModalOpen}
        onOpenChange={(open) => {
          setIsAiModalOpen(open);
          if (!open) setCurrentAiPostId(null);
        }}
        campaignId={id!}
        selectedPostIds={currentAiPostId ? [currentAiPostId] : []}
        onSuccess={() => {
          setCurrentAiPostId(null);
          fetchData();
        }}
      />
    </div>
  );
}
