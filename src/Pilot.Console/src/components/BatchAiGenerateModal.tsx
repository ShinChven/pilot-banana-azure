import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Sparkles, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { listPrompts, PromptResponse } from '../api/prompts';
import { batchGenerateText } from '../api/posts';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

interface BatchAiGenerateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  selectedPostIds: string[];
  onSuccess: () => void;
}

export function BatchAiGenerateModal({
  isOpen,
  onOpenChange,
  campaignId,
  selectedPostIds,
  onSuccess
}: BatchAiGenerateModalProps) {
  const { token, user } = useAuth();
  const [prompts, setPrompts] = React.useState<PromptResponse[]>([]);
  const [selectedPromptId, setSelectedPromptId] = React.useState<string>("");
  const [promptText, setPromptText] = React.useState<string>("");
  const [includeImages, setIncludeImages] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingPrompts, setIsLoadingPrompts] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && token) {
      loadPrompts();
    }
  }, [isOpen, token]);

  const loadPrompts = async () => {
    setIsLoadingPrompts(true);
    try {
      const res = await listPrompts(token!, 1, 100);
      if (res.data) {
        setPrompts(res.data.items);
      }
    } catch (err) {
      toast.error("Failed to load prompt templates");
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  const handlePromptSelect = (id: string) => {
    const prompt = prompts.find(p => p.id === id);
    if (prompt) {
      setSelectedPromptId(id);
      setPromptText(prompt.text);
    }
  };

  const handleSubmit = async () => {
    if (!token || !user || !promptText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await batchGenerateText(user.id, campaignId, selectedPostIds, promptText.trim(), token, includeImages);
      if (res.data) {
        toast.success(`Started generation for ${res.data.count} posts`, {
          description: "You can track progress in the AI Task Manager."
        });
        onSuccess();
        onOpenChange(false);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl bg-card border-muted-foreground/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Batch AI Text Generation
          </DialogTitle>
          <DialogDescription>
            Generate post content for {selectedPostIds.length} selected posts using Gemini 3.1 Flash-Lite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Template</label>
            <Select onValueChange={handlePromptSelect} value={selectedPromptId}>
              <SelectTrigger className="w-full bg-muted/30 border-muted-foreground/10 rounded-xl">
                <SelectValue placeholder={isLoadingPrompts ? "Loading templates..." : "Choose a template"}>
                  {(val: string) => {
                    if (!val) return undefined;
                    const prompt = prompts.find(p => p.id === val);
                    return prompt ? prompt.title : undefined;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-muted-foreground/10">
                {prompts.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="rounded-lg">
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Prompt Content</label>
              {promptText && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                  Editable
                </span>
              )}
            </div>
            <Textarea
              placeholder="Describe how the AI should generate the post text. Mention that it should look at the images if provided."
              className="min-h-[200px] bg-muted/30 border-muted-foreground/10 rounded-xl focus-visible:ring-primary"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground flex gap-1.5 items-start px-1">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {includeImages 
                ? "This prompt will be sent to Gemini along with any images attached to each selected post."
                : "This prompt will be sent to Gemini. No images will be provided for this generation."}
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-muted-foreground/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="include-images" className="text-sm font-bold cursor-pointer">Provide images for generation</Label>
                <span className="text-xs text-muted-foreground">Toggle whether AI should analyze post images</span>
              </div>
            </div>
            <Switch 
              id="include-images" 
              checked={includeImages} 
              onCheckedChange={setIncludeImages}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="rounded-xl gap-2"
            disabled={isSubmitting || !promptText.trim()}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Start Generation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
