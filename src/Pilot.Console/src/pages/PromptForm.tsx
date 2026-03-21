import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { 
  ArrowLeft, 
  Save, 
  X,
  Info,
  Terminal,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { getPrompt, createPrompt, updatePrompt } from '../api/prompts';

export default function PromptFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const isEditing = !!id;
  
  const [formData, setFormData] = React.useState({
    title: '',
    text: ''
  });
  const [isLoading, setIsLoading] = React.useState(isEditing);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchPrompt = React.useCallback(async () => {
    if (!token || !id) return;
    setIsLoading(true);
    try {
      const { data, error } = await getPrompt(id, token);
      if (error) {
        toast.error("Failed to load prompt", { description: error });
        navigate('/prompts');
      } else if (data) {
        setFormData({
          title: data.title,
          text: data.text
        });
      }
    } catch (err) {
      toast.error("Error loading prompt");
      navigate('/prompts');
    } finally {
      setIsLoading(false);
    }
  }, [token, id, navigate]);

  React.useEffect(() => {
    if (isEditing) {
      fetchPrompt();
    }
  }, [isEditing, fetchPrompt]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!formData.title || !formData.text) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && id) {
        const { error } = await updatePrompt(id, formData, token);
        if (error) {
          toast.error("Failed to update prompt", { description: error });
        } else {
          toast.success("Prompt updated successfully");
          navigate('/prompts');
        }
      } else {
        const { error } = await createPrompt(formData, token);
        if (error) {
          toast.error("Failed to create prompt", { description: error });
        } else {
          toast.success("Prompt created successfully");
          navigate('/prompts');
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
            <p className="text-muted-foreground font-medium animate-pulse">Loading template...</p>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/prompts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {isEditing ? 'Edit Template' : 'New Template'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update your existing prompt template.' : 'Create a new reusable prompt template.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/prompts')} className="gap-2">
            <X className="w-4 h-4" /> Cancel
          </Button>
          <Button 
            className="gap-2 font-bold" 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-muted-foreground/10 shadow-sm space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold text-foreground">Template Title</Label>
              <Input 
                id="title" 
                placeholder="e.g. Product Announcement" 
                className="h-12 border-muted-foreground/10 focus:border-primary text-lg rounded-xl bg-muted/20"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="text" className="text-sm font-semibold text-foreground">Prompt Text</Label>
              <Textarea 
                id="text" 
                placeholder="Write your prompt here..." 
                className="min-h-[400px] resize-none border-muted-foreground/10 focus:border-primary p-4 text-base leading-relaxed rounded-xl bg-muted/20"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-muted/30 p-6 rounded-3xl border border-muted-foreground/10 space-y-4">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Info className="w-4 h-4" />
              <span>Quick Tips</span>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-muted-foreground/50 font-mono">•</span>
                <span>Use curly braces for variables like <code className="bg-muted px-1 rounded text-foreground">{"{product_name}"}</code>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-muted-foreground/50 font-mono">•</span>
                <span>Be specific about the tone and audience in your prompt.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-muted-foreground/50 font-mono">•</span>
                <span>Include constraints like word count or specific keywords.</span>
              </li>
            </ul>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-muted-foreground/10 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Terminal className="w-4 h-4" />
              <span>Preview</span>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl border border-muted-foreground/5 min-h-[100px]">
              {formData.text ? (
                <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">
                  {formData.text.length > 200 ? formData.text.substring(0, 200) + '...' : formData.text}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">Start typing to see a preview...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
