import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Separator } from "@/src/components/ui/separator";
import { Badge } from "@/src/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  ArrowLeft,
  ImagePlus,
  GripVertical,
  Trash2,
  X,
  Calendar,
  Send,
  Loader2,
  Upload
} from 'lucide-react';
import { Reorder } from "motion/react";
import { Campaign, Channel } from '../types';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { POST_MEDIA_ACCEPT, mergeAndValidatePostMedia, getPostMediaKind, getPostMediaKindFromUrl, getPostPreviewUrl } from '@/src/lib/post-media';
import { useAuth } from '../context/AuthContext';
import { getCampaign } from '../api/campaigns';
import { getPost, createPost, updatePost } from '../api/posts';
import { listChannels } from '../api/channels';

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

function NewFilePreview({ file }: { file: File }) {
  const [preview, setPreview] = React.useState<string>('');

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!preview) return <div className="h-full w-full bg-muted animate-pulse" />;

  if (file.type.startsWith('video/')) {
    return <video src={preview} className="h-full w-full object-cover" />;
  }

  return <img src={preview} alt="" className="h-full w-full object-cover" />;
}

export default function PostFormPage() {
  const { campaignId, postId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isEditing = !!postId;

  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [content, setContent] = React.useState('');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [existingImageItems, setExistingImageItems] = React.useState<Array<{ id: string; url: string; thumbUrl: string; optUrl: string; kind: 'image' | 'gif' | 'video' | 'unknown' }>>([]);
  const [newFiles, setNewFiles] = React.useState<File[]>([]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [mediaToRemove, setMediaToRemove] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchData = React.useCallback(async () => {
    if (!token || !campaignId || !user) return;
    setIsLoading(true);
    try {
      const [campRes, chanRes] = await Promise.all([
        getCampaign(campaignId, token),
        listChannels(token, 1, 100)
      ]);

      if (campRes.data) {
        const c = campRes.data;
        setCampaign({
          id: c.id,
          name: c.name,
          description: `Campaign created on ${new Date(c.createdAt).toLocaleDateString()}`,
          status: c.status === 'Active' ? 'Active' : 'Inactive',
          startDate: new Date(c.createdAt).toLocaleDateString(),
          endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : '-',
          channels: c.channelLinkIds || [],
          posts: [],
          thumbnail: ''
        });
      }

      if (chanRes.data) {
        setChannels(chanRes.data.items.map(c => ({
          id: c.id,
          platform: c.platform as any,
          username: c.displayName || c.username || c.externalId,
          handle: c.username ? `@${c.username}` : undefined,
          avatar: c.avatarUrl || c.profileUrl || '',
          status: 'Connected',
          followers: 0,
          lastSync: '',
          enabled: true
        })));
      }

      if (isEditing && postId) {
        const postRes = await getPost(user.id, campaignId, postId, token);
        if (postRes.data) {
          setContent(postRes.data.text || '');
          setScheduledAt(postRes.data.scheduledTime ? toDatetimeLocal(new Date(postRes.data.scheduledTime)) : '');
          
          const media = postRes.data.mediaUrls || [];
          const thumbs = postRes.data.thumbnailUrls || [];
          const opts = postRes.data.optimizedUrls || [];

          setExistingImageItems(media.map((url, i) => ({
            id: `existing-${i}`,
            url,
            thumbUrl: thumbs[i] || url,
            optUrl: opts[i] || url,
            kind: getPostMediaKindFromUrl(url)
          })));


        } else {
          toast.error("Post not found");
          navigate(`/campaigns/${campaignId}`);
        }
      }
    } catch (err) {
      toast.error("Error loading data");
    } finally {
      setIsLoading(false);
    }
  }, [token, campaignId, postId, isEditing, user, navigate]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const error = mergeAndValidatePostMedia(existingImageItems.length + newFiles.length, files);
      if (error) {
        toast.error(error);
        e.target.value = '';
        return;
      }
      setNewFiles(prev => [...prev, ...files]);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const error = mergeAndValidatePostMedia(existingImageItems.length + newFiles.length, files);
      if (error) {
        toast.error(error);
        return;
      }
      setNewFiles(prev => [...prev, ...files]);
    }
  };

  const handleRemoveExistingImage = (id: string) => {
    setMediaToRemove(id);
  };

  const confirmRemoveExistingImage = () => {
    if (mediaToRemove) {
      setExistingImageItems(prev => prev.filter(item => item.id !== mediaToRemove));
      setMediaToRemove(null);
    }
  };

  const handleRemoveNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!token || !user || !campaignId) return;
    if (!content && existingImageItems.length === 0 && newFiles.length === 0) {
      toast.error("Post must have text or media");
      return;
    }

    setIsSaving(true);
    try {
      const orderedExistingImages = existingImageItems.map(item => item.url);
      const utcScheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : undefined;

      if (isEditing && postId) {
        // mediaOrder is for existing images
        const { error } = await updatePost(
          user.id,
          campaignId,
          postId,
          content,
          newFiles,
          token,
          orderedExistingImages,
          scheduledAt ? 'Scheduled' : 'Draft',
          utcScheduledAt
        );
        if (error) {
          toast.error("Failed to update post", { description: error });
        } else {
          toast.success("Post updated successfully");
          navigate(`/campaigns/${campaignId}`);
        }
      } else {
        const { error } = await createPost(
          user.id,
          campaignId,
          content,
          newFiles,
          token,
          scheduledAt ? 'Scheduled' : 'Draft',
          utcScheduledAt
        );
        if (error) {
          toast.error("Failed to create post", { description: error });
        } else {
          toast.success("Post created successfully");
          navigate(`/campaigns/${campaignId}`);
        }
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium animate-pulse">Loading...</p>
        </div>
    );
  }

  if (!campaign) return null;

  const targetChannels = channels.filter(ch => campaign.channels.includes(ch.id));

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${campaignId}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isEditing ? 'Edit Post' : 'Create New Post'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update your campaign post.' : 'Add a new post to your campaign.'}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Post Content */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <Card className="border-muted-foreground/10 bg-card shadow-sm overflow-hidden rounded-2xl p-0 gap-0">
            <CardHeader className="bg-muted/30 border-b border-muted-foreground/5 p-6">
              <CardTitle className="text-lg">Content & Media</CardTitle>
              <CardDescription>What would you like to share?</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="content" className="text-foreground font-semibold">Post Content</Label>
                <Textarea
                  id="content"
                  placeholder="Type your post content here..."
                  className="min-h-[200px] resize-none border-muted-foreground/10 focus:border-primary rounded-xl p-4 text-base leading-relaxed bg-muted/20"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <div className="grid gap-4 min-w-0">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground font-semibold">Media</Label>
                  <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full border-muted-foreground/10" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="w-4 h-4" /> Add Files
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept={POST_MEDIA_ACCEPT}
                    onChange={handleFileChange}
                  />
                </div>

                {(existingImageItems.length > 0 || newFiles.length > 0) ? (
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "space-y-3 p-2 rounded-2xl transition-all relative min-h-[100px] min-w-0",
                      isDragging && "bg-primary/5 ring-2 ring-primary ring-dashed shadow-inner"
                    )}
                  >
                    {isDragging ? (
                      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-primary rounded-xl bg-primary/5 gap-2">
                        <Upload className="w-8 h-8 text-primary animate-bounce" />
                        <p className="text-primary font-bold">Drop files to add</p>
                      </div>
                    ) : (
                      <>
                        {/* Existing Images */}
                        {existingImageItems.length > 0 && (
                          <>
                            <p className="text-xs text-muted-foreground">Drag existing images to change their posting order.</p>
                            <Reorder.Group
                              axis="y"
                              values={existingImageItems}
                              onReorder={setExistingImageItems}
                              className="space-y-3 w-full min-w-0"
                            >
                              {existingImageItems.map((item) => (
                                <Reorder.Item
                                  key={item.id}
                                  value={item}
                                  className="flex w-full min-w-0 items-center gap-4 p-3 rounded-xl border border-muted-foreground/10 bg-muted/30 group shadow-sm overflow-hidden"
                                  whileDrag={{ scale: 1.01 }}
                                >
                                  <button
                                    type="button"
                                    className="h-8 w-8 shrink-0 rounded-full text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                                    aria-label="Drag to reorder image"
                                  >
                                    <GripVertical className="w-4 h-4 mx-auto" />
                                  </button>
                                  <div className="h-16 w-16 rounded-lg overflow-hidden border border-muted-foreground/10 shrink-0 shadow-inner bg-muted">
                                    {item.kind === 'video' ? (
                                      <div className="relative h-full w-full">
                                        {getPostMediaKindFromUrl(getPostPreviewUrl(item.url, item.thumbUrl, item.optUrl)) === 'image' ? (
                                          <img src={getPostPreviewUrl(item.url, item.thumbUrl, item.optUrl)} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                          <video
                                            src={getPostPreviewUrl(item.url, item.thumbUrl, item.optUrl)}
                                            className="h-full w-full object-cover"
                                            muted
                                            playsInline
                                            autoPlay
                                            loop
                                            preload="metadata"
                                          />
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                          <div className="rounded-full bg-white/20 p-1 backdrop-blur-sm">
                                            <div className="ml-0.5 h-0 w-0 border-b-[4px] border-l-[6px] border-t-[4px] border-b-transparent border-l-white border-t-transparent" />
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <img src={getPostPreviewUrl(item.url, item.thumbUrl, item.optUrl)} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 truncate text-xs text-muted-foreground font-mono">
                                    {item.url.split('/').pop()}
                                  </div>
                                  {item.kind === 'video' && <Badge variant="secondary" className="text-[10px] uppercase">Video</Badge>}
                                  {item.kind === 'gif' && <Badge variant="secondary" className="text-[10px] uppercase">GIF</Badge>}
                                  <Badge variant="outline" className="text-[10px] uppercase">Existing</Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                    onClick={() => handleRemoveExistingImage(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </Reorder.Item>
                              ))}
                            </Reorder.Group>
                          </>
                        )}

                        {/* New Files */}
                        {newFiles.map((file, index) => (
                          <div
                            key={`new-${index}`}
                            className="flex w-full min-w-0 items-center gap-4 p-3 rounded-xl border border-primary/20 bg-primary/5 group shadow-sm overflow-hidden"
                          >
                            <div className="h-16 w-16 rounded-lg overflow-hidden border border-muted-foreground/10 shrink-0 shadow-inner bg-muted flex items-center justify-center">
                              <NewFilePreview file={file} />
                            </div>
                            <div className="flex-1 min-w-0 truncate text-xs text-foreground font-medium">
                              {file.name}
                            </div>
                            {getPostMediaKind(file) === 'video' && <Badge variant="secondary" className="text-[10px] uppercase">Video</Badge>}
                            {getPostMediaKind(file) === 'gif' && <Badge variant="secondary" className="text-[10px] uppercase">GIF</Badge>}
                            <Badge className="text-[10px] uppercase bg-primary text-primary-foreground border-none">New</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                              onClick={() => handleRemoveNewFile(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "border-2 border-dashed rounded-2xl py-12 text-center transition-all cursor-pointer",
                      isDragging 
                        ? "border-primary bg-primary/5 shadow-inner scale-[0.99]" 
                        : "border-muted-foreground/10 bg-muted/10 hover:bg-muted/20 hover:border-primary/30"
                    )}
                  >
                    <div className={cn(
                      "inline-flex h-12 w-12 items-center justify-center rounded-full mb-3 transition-all",
                      isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {isDragging ? <Upload className="h-6 w-6 animate-bounce" /> : <ImagePlus className="h-6 w-6" />}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {isDragging ? "Drop files to upload" : "No media added yet. Drag and drop or click to upload."}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">Add images, GIFs, or video. Limits vary by platform.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Scheduling & Settings */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-muted-foreground/10 bg-card shadow-sm overflow-hidden rounded-2xl p-0 gap-0">
            <CardHeader className="bg-muted/30 border-b border-muted-foreground/5 p-6">
              <CardTitle className="text-lg">Scheduling</CardTitle>
              <CardDescription>When should this be published?</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="scheduledAt" className="text-foreground font-semibold">Scheduled Time</Label>
                  {scheduledAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-full"
                      onClick={() => setScheduledAt('')}
                    >
                      <X className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
                <div className="relative h-11 flex items-center rounded-xl border border-muted-foreground/10 bg-muted/20 overflow-hidden focus-within:border-primary transition-colors">
                  <Calendar className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
                  <input
                    id="scheduledAt"
                    type="datetime-local"
                    className="absolute inset-0 w-full h-full pl-10 pr-3 bg-transparent text-sm text-foreground outline-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    style={!scheduledAt ? { color: 'transparent' } : undefined}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  {!scheduledAt && (
                    <span className="pl-10 text-sm text-muted-foreground pointer-events-none">
                      Not scheduled
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Leave empty to save as a draft. Posts will be automatically published at the selected time.
                </p>
              </div>

              <Separator className="bg-muted-foreground/5" />

              <div className="space-y-3">
                <Label className="text-foreground font-semibold">Target Channels</Label>
                <div className="flex -space-x-2">
                  {targetChannels.map(ch => (
                    <div key={ch.id} className="h-10 w-10 rounded-full ring-4 ring-card bg-muted overflow-hidden border border-muted-foreground/5 shadow-sm" title={`${ch.username} ${ch.handle || ''} (${ch.platform})`}>
                      {ch.avatar ? <img src={ch.avatar} alt={ch.username} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <div className="h-full w-full flex items-center justify-center font-bold text-xs">{ch.username[0]}</div>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  This post will be sent to all {targetChannels.length} channels connected to this campaign.
                </p>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t border-muted-foreground/5 p-6">
              <div className="flex flex-col w-full gap-3">
                <Button
                    onClick={handleSave}
                    className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold shadow-lg shadow-primary/20"
                    disabled={isSaving}
                >
                  {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                      isEditing ? 'Update Post' : 'Create Post'
                  )}
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => navigate(`/campaigns/${campaignId}`)}
                    className="w-full h-11 rounded-xl text-muted-foreground hover:text-foreground"
                    disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card className="bg-emerald-500/5 border-emerald-500/10 rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-600">Ready to go?</h4>
                  <p className="text-sm text-emerald-600/70 mt-1">
                    You can also send this post immediately from the campaign dashboard.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={!!mediaToRemove} onOpenChange={(open) => { if (!open) setMediaToRemove(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Media</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this existing media file? It will be removed when you save the post.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMediaToRemove(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemoveExistingImage}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
