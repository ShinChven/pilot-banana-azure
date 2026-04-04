import * as React from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
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
  ArrowLeft,
  Clock,
  Trash2,
  Send,
  Sparkles,
  ExternalLink,
  Pencil,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Instagram,
  Linkedin,
  Facebook
} from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";
import { XIcon } from '@/src/components/XIcon';
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import { Input } from "@/src/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/src/components/ui/dialog";
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { ScheduledPost, Campaign, Channel } from '../types';
import { useAuth } from '../context/AuthContext';
import { getCampaign } from '../api/campaigns';
import { getPost, deletePost, sendPost, updatePost, batchUnschedulePosts } from '../api/posts';
import { listChannels } from '../api/channels';
import { BatchAiGenerateModal } from '../components/BatchAiGenerateModal';
import { getPostMediaKindFromUrl, getPostPreviewUrl } from '@/src/lib/post-media';

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
  return getPostMediaKindFromUrl(url) === 'video';
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
}) => {
  if (isVideo(src)) {
    return (
      <video
        src={src}
        className={cn(className, onClick && "cursor-pointer")}
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
      className={cn(className, onClick && "cursor-pointer")}
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
      <div className="fixed inset-0 z-[101] flex items-center justify-center outline-none bg-black/95 backdrop-blur-md">
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
              <ArrowLeft className="w-8 h-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-6 text-white hover:bg-white/10 z-[102] rounded-full h-14 w-14 hidden md:flex"
              onClick={handleNext}
            >
              <ArrowLeft className="w-8 h-8 rotate-180" />
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
              className="w-full h-full flex items-center justify-center"
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
      </div>
    </Dialog>
  );
};

const PostMedia = ({ images, thumbs, opts }: { images?: string[], thumbs?: string[], opts?: string[] }) => {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  if (!images || images.length === 0) return null;

  const previewItems = images.map((image, index) => ({
    source: getPostPreviewUrl(image, thumbs?.[index], opts?.[index]),
    kind: getPostMediaKindFromUrl(image)
  }));
  const fullImages = images;

  const renderPreview = (index: number, className?: string, alt?: string, featured = false) => {
    const item = previewItems[index];
    if (!item) return null;

    if (item.kind === 'video') {
      const previewKind = getPostMediaKindFromUrl(item.source);
      return (
        <div className={cn("relative overflow-hidden", featured && "bg-black/5")}>
          {previewKind === 'image' ? (
            <img
              src={item.source}
              alt={alt}
              className={cn(className, "cursor-pointer")}
              onClick={() => openLightbox(index)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <video
              src={item.source}
              className={cn(className, "cursor-pointer")}
              onClick={() => openLightbox(index)}
              muted
              playsInline
              autoPlay
              loop
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="rounded-full bg-white/20 p-2 backdrop-blur-sm">
              <div className="ml-0.5 h-0 w-0 border-b-[6px] border-l-[10px] border-t-[6px] border-b-transparent border-l-white border-t-transparent" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <MediaElement
        src={item.source}
        alt={alt}
        className={className}
        onClick={() => openLightbox(index)}
      />
    );
  };

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setLightboxOpen(true);
  };

  const count = images.length;

  return (
    <>
      <div className={cn(
        "grid gap-1.5 aspect-video w-full overflow-hidden rounded-xl border border-slate-200/60 shadow-sm",
        count === 1 ? "grid-cols-1" :
        count === 2 ? "grid-cols-2" :
        count === 3 ? "grid-cols-3 grid-rows-2" :
        "grid-cols-2 grid-rows-2"
      )}>
        {count === 1 && renderPreview(0, "h-full w-full object-cover cursor-zoom-in")}
        {count === 2 && previewItems.map((_, i) => renderPreview(i, "h-full w-full object-cover cursor-zoom-in"))}
        {count === 3 && (
          <>
            {renderPreview(0, "col-span-2 row-span-2 h-full w-full object-cover cursor-zoom-in")}
            {renderPreview(1, "h-full w-full object-cover cursor-zoom-in")}
            {renderPreview(2, "h-full w-full object-cover cursor-zoom-in")}
          </>
        )}
        {count >= 4 && (
          <>
            {renderPreview(0, "h-full w-full object-cover cursor-zoom-in")}
            {renderPreview(1, "h-full w-full object-cover cursor-zoom-in")}
            {renderPreview(2, "h-full w-full object-cover cursor-zoom-in")}
            <div className="relative h-full w-full overflow-hidden cursor-zoom-in" onClick={() => openLightbox(3)}>
                {renderPreview(3, "h-full w-full object-cover")}
                {count > 4 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] text-white font-bold text-xl">
                        +{count - 4}
                    </div>
                )}
            </div>
          </>
        )}
      </div>
      <Lightbox
        images={fullImages}
        initialIndex={selectedIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
};

export default function PostProfilePage() {
  const { campaignId, postId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [post, setPost] = React.useState<ScheduledPost | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const [quickSchedulingId, setQuickSchedulingId] = React.useState<string | null>(null);
  const [quickDate, setQuickDate] = React.useState('');
  const [quickSchedulingSavingId, setQuickSchedulingSavingId] = React.useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!token || !campaignId || !postId || !user) return;
    setIsLoading(true);
    try {
      const [campRes, chanRes, postRes] = await Promise.all([
        getCampaign(campaignId, token),
        listChannels(token, 1, 100),
        getPost(user.id, campaignId, postId, token)
      ]);

      if (campRes.data) {
        const c = campRes.data;
        setCampaign({
          id: c.id,
          name: c.name,
          description: c.description || `Created on ${new Date(c.createdAt).toLocaleDateString()}`,
          status: c.status === 'Active' ? 'Active' : 'Inactive',
          startDate: new Date(c.createdAt).toLocaleDateString(),
          endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : '-',
          channels: c.channelLinkIds,
          posts: [],
          thumbnail: '',
          totalPosts: c.totalPosts,
          postedPosts: c.postedPosts,
          draftPosts: c.draftPosts,
          scheduledPosts: c.scheduledPosts,
          failedPosts: c.failedPosts,
          generatingPosts: c.generatingPosts
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
        const p = postRes.data;
        setPost({
          id: p.id,
          content: p.text || '',
          images: p.mediaUrls || [],
          thumbnailUrls: p.thumbnailUrls || [],
          optimizedUrls: p.optimizedUrls || [],
          scheduledAt: p.scheduledTime || '',
          status: p.status as any,
          channels: campRes.data?.channelLinkIds || [],
          postUrl: p.postUrl || undefined
        });
      }
    } catch (err) {
      toast.error('Error loading post data');
    } finally {
      setIsLoading(false);
    }
  }, [token, campaignId, postId, user]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditPost = () => {
    navigate(`/campaigns/${campaignId}/posts/edit/${postId}`);
  };

  const handleDeletePost = async () => {
    if (!token || !user || !campaignId || !postId) return;
    try {
        const { error } = await deletePost(user.id, campaignId, postId, token);
        if (error) {
            toast.error('Failed to delete post', { description: error });
        } else {
            toast.success("Post deleted");
            navigate(`/campaigns/${campaignId}`);
        }
    } catch (err) {
        toast.error('Error deleting post');
    }
  };

  const handleSendNow = async () => {
    if (!token || !user || !campaignId || !postId) return;
    if (campaign?.status !== 'Active') {
      toast.error('Campaign is inactive', { description: 'Activate the campaign before sending posts.' });
      return;
    }

    toast.promise(
      sendPost(user.id, campaignId, postId, token),
      {
        loading: 'Sending post to target channels...',
        success: () => {
          fetchData();
          return 'Post has been sent successfully!';
        },
        error: (err) => `Failed to send post: ${err.message}`,
      }
    );
  };

  const handleUnschedule = async () => {
    if (!token || !user || !campaignId || !postId) return;
    const { error } = await batchUnschedulePosts(user.id, campaignId, [postId], token);
    if (error) {
      toast.error("Failed to unschedule post");
      return;
    }
    toast.success("Post unscheduled");
    fetchData();
  };

  const handleQuickScheduleSave = async () => {
    if (!token || !user || !campaignId || !postId || !post) return;
    if (!quickDate) {
      toast.error('Please select a schedule time');
      return;
    }

    setQuickSchedulingSavingId(postId);
    try {
      const nextStatus = 'Scheduled';
      const utcDate = new Date(quickDate).toISOString();
      const { error } = await updatePost(
        user.id,
        campaignId,
        postId,
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

      toast.success('Post scheduled');
      setQuickSchedulingId(null);
      setQuickDate('');
      fetchData();
    } catch (err) {
      toast.error('Error scheduling post');
    } finally {
      setQuickSchedulingSavingId(null);
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

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium animate-pulse">Loading post details...</p>
        </div>
    );
  }

  if (!post) {
    return (
        <div className="text-center py-12">
            <h2 className="text-2xl font-bold">Post not found</h2>
            <Button variant="link" onClick={() => navigate(`/campaigns/${campaignId}`)}>Back to Campaign</Button>
        </div>
    );
  }

  const connectedChannels = channels.filter(ch => campaign?.channels.includes(ch.id));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${campaignId}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Post Details</h1>
          <p className="text-muted-foreground">Campaign: <Link to={`/campaigns/${campaignId}`} className="text-primary hover:underline">{campaign?.name}</Link></p>
        </div>
      </div>

      <Card className="overflow-hidden border border-muted-foreground/5 shadow-xl bg-card rounded-2xl">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              {connectedChannels.length > 0 && (
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
              )}
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-foreground">
                    {connectedChannels.length} {connectedChannels.length === 1 ? 'Channel' : 'Channels'}
                  </span>
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
                    {post.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                  <Clock className="w-3 h-3" />
                  {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'Not scheduled'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full"
                title="Edit Post"
                onClick={handleEditPost}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary hover:bg-primary/5 rounded-full"
                title="AI Generate"
                onClick={() => setIsAiModalOpen(true)}
              >
                <Sparkles className="w-4.5 h-4.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4.5 h-4.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-foreground text-lg leading-relaxed whitespace-pre-wrap font-medium tracking-tight">
              {post.content}
            </p>

            <PostMedia images={post.images} thumbs={post.thumbnailUrls} opts={post.optimizedUrls} />
          </div>

          <div className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-muted-foreground/5">
            <div className="flex flex-wrap items-center gap-2">
              {quickSchedulingId === post.id ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                  <Input
                    type="datetime-local"
                    className="h-10 w-48 text-xs rounded-full border-primary/20 focus:border-primary bg-background"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="h-10 px-4 rounded-full font-bold"
                    onClick={handleQuickScheduleSave}
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
                    className="gap-2 transition-all font-bold h-10 px-6 rounded-full shadow-lg shadow-primary/20"
                    onClick={handleSendNow}
                    disabled={campaign?.status !== 'Active'}
                  >
                    <Send className="w-3.5 h-3.5" /> {post.status === 'Posted' ? 'Send Again' : 'Send Now'}
                  </Button>
                  {!post.scheduledAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 h-10 px-4 rounded-full font-bold"
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
                        className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 h-10 px-4 rounded-full font-bold"
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
                        className="text-muted-foreground hover:text-foreground h-10 px-4 rounded-full font-bold"
                        onClick={handleUnschedule}
                      >
                        Unschedule
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            {post.status === 'Posted' ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-xs text-emerald-500 font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Published
                </div>
                {post.postUrl && (
                  <a 
                    href={post.postUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                  >
                    View Post <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground font-bold uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {post.status}
                </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePost}>Delete Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchAiGenerateModal
        isOpen={isAiModalOpen}
        onOpenChange={setIsAiModalOpen}
        campaignId={campaignId!}
        selectedPostIds={[postId!]}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}
