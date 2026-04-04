import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { 
  ArrowLeft, 
  Upload, 
  X, 
  Plus, 
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { POST_MEDIA_ACCEPT, validatePostMediaFiles, getPostMediaKind } from '@/src/lib/post-media';
import { useAuth } from '../context/AuthContext';
import { getCampaign } from '../api/campaigns';
import { createPost } from '../api/posts';
import { Campaign } from '../types';

interface BatchPost {
  id: string;
  file: File;
  preview: string;
  content: string;
}

export default function BatchCreatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [posts, setPosts] = React.useState<BatchPost[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchCampaign = React.useCallback(async () => {
    if (!token || !id) return;
    setIsLoading(true);
    try {
      const { data, error } = await getCampaign(id, token);
      if (data) {
        setCampaign({
          id: data.id,
          name: data.name,
          description: '',
          status: 'Active',
          startDate: '',
          endDate: data.endDate ? new Date(data.endDate).toLocaleDateString() : '',
          channels: data.channelLinkIds || [],
          posts: [],
          thumbnail: ''
        });
      } else {
        toast.error("Campaign not found");
        navigate('/campaigns');
      }
    } catch (err) {
      toast.error("Error loading campaign");
    } finally {
      setIsLoading(false);
    }
  }, [token, id, navigate]);

  React.useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files) as File[];
    for (const file of nextFiles) {
      const error = validatePostMediaFiles([file]);
      if (error) {
        toast.error(error);
        return;
      }
    }

    const newPosts: BatchPost[] = nextFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      content: ''
    }));
    
    setPosts(prev => [...prev, ...newPosts]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
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
      handleFiles(e.dataTransfer.files);
    }
  };

  const removePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const updateContent = (postId: string, content: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content } : p));
  };

  const handleConfirm = async () => {
    if (!token || !user || !id) return;
    if (posts.length === 0) {
      toast.error("Please add at least one media file");
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    
    try {
        for (const post of posts) {
            const { error } = await createPost(
                user.id,
                id,
                post.content,
                [post.file],
                token,
                'Draft'
            );
            if (!error) successCount++;
        }
        
        toast.success(`Successfully created ${successCount} posts for ${campaign?.name}`);
        navigate(`/campaigns/${id}/batch`);
    } catch (err) {
        toast.error("An error occurred during batch creation");
    } finally {
        setIsUploading(false);
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

  return (
    <div className="w-full space-y-8 pb-32">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${id}/batch`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Batch</h1>
            <p className="text-muted-foreground">Upload image, GIF, or video posts for <span className="font-semibold text-primary">{campaign.name}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-muted-foreground/10" onClick={() => navigate(`/campaigns/${id}/batch`)}>Cancel</Button>
          <Button 
            className="gap-2 min-w-[140px] font-bold" 
            onClick={handleConfirm}
            disabled={isUploading || posts.length === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm Batch
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "group relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/5 shadow-inner scale-[0.99]" 
            : "border-muted-foreground/10 bg-muted/10 hover:bg-muted/20 hover:border-primary/30"
        )}
      >
        <input 
          type="file" 
          multiple 
          accept={POST_MEDIA_ACCEPT}
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <div className={cn(
          "w-16 h-16 rounded-2xl shadow-sm border flex items-center justify-center transition-all",
          isDragging ? "bg-primary text-primary-foreground border-primary" : "bg-card border-muted-foreground/5 text-muted-foreground group-hover:text-primary"
        )}>
          <Upload className={cn("w-8 h-8", isDragging && "animate-bounce")} />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            {isDragging ? "Drop files to upload" : "Drag and drop images, GIFs, or video here"}
          </p>
          <p className="text-sm text-muted-foreground">or click to browse from your computer</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          <span>JPG, PNG, WEBP, GIF, MP4</span>
          <span className="w-1 h-1 bg-muted-foreground/30 rounded-full"></span>
          <span>1 media file per post</span>
        </div>
      </div>

      {/* Post List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            Batch Items
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-bold">
              {posts.length}
            </span>
          </h2>
          {posts.length > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setPosts([])}>
              Clear All
            </Button>
          )}
        </div>

        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <div key={post.id} className="bg-card border border-muted-foreground/10 rounded-2xl overflow-hidden shadow-sm group">
                <div className="flex h-48">
                  <div className="w-1/3 relative bg-muted">
                    {getPostMediaKind(post.file) === 'video' ? (
                      <video src={post.preview} className="h-full w-full object-cover" />
                    ) : (
                      <img src={post.preview} alt="" className="h-full w-full object-cover" />
                    )}
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-2 left-2 h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePost(post.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex-1 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Post Content</span>
                      {getPostMediaKind(post.file) === 'video' ? (
                        <span className="text-[8px] bg-primary/10 text-primary px-1 rounded font-bold uppercase">Video</span>
                      ) : getPostMediaKind(post.file) === 'gif' ? (
                        <span className="text-[8px] bg-primary/10 text-primary px-1 rounded font-bold uppercase">GIF</span>
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-muted-foreground/30" />
                      )}
                    </div>
                    <Textarea 
                      placeholder="Enter caption for this post..." 
                      className="flex-1 resize-none border-none bg-muted/30 focus-visible:ring-0 p-3 text-sm rounded-xl"
                      value={post.content}
                      onChange={(e) => updateContent(post.id, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="h-48 border-2 border-dashed border-muted-foreground/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/20 hover:border-muted-foreground/10 transition-all bg-muted/5"
            >
              <Plus className="w-6 h-6" />
              <span className="text-sm font-medium">Add more items</span>
            </button>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center bg-muted/5 rounded-3xl border border-muted-foreground/5">
            <ImageIcon className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">No files uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
