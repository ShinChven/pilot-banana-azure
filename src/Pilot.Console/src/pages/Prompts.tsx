import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Terminal, 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  MessageSquare, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  ArrowRight,
  Eye,
  Clock,
  Zap
} from 'lucide-react';
import { Prompt } from '../types';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { listPrompts, deletePrompt } from '../api/prompts';

export default function PromptsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const [prompts, setPrompts] = React.useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '');
  const [isLoading, setIsLoading] = React.useState(true);

  // Pagination State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
  const [totalItems, setTotalItems] = React.useState(0);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [promptToDelete, setPromptToDelete] = React.useState<Prompt | null>(null);

  // View Modal State
  const [viewModalContent, setViewModalContent] = React.useState<{ title: string; content: string } | null>(null);

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
  };

  const openViewModal = (title: string, content: string) => {
    setViewModalContent({ title, content });
  };

  const fetchPrompts = React.useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const { data, error } = await listPrompts(token, page, pageSize);
      if (error) {
        toast.error("Failed to load prompts", { description: error });
      } else if (data) {
        setTotalItems(data.total);
        setPrompts(data.items.map(p => ({
          id: p.id,
          title: p.title,
          text: p.text,
          author: p.author,
          authorEmail: p.authorEmail,
          createdAt: new Date(p.createdAt).toLocaleDateString(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()
        })));
      }
    } catch (err) {
      toast.error("Error loading prompts");
    } finally {
      setIsLoading(false);
    }
  }, [token, page, pageSize]);

  React.useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const totalPages = Math.ceil(totalItems / pageSize);

  const filteredPrompts = prompts.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (!token || !promptToDelete) return;
    const id = promptToDelete.id;
    try {
      const { error } = await deletePrompt(id, token);
      if (error) {
        toast.error("Failed to delete prompt", { description: error });
      } else {
        setPrompts(prompts.filter(p => p.id !== id));
        toast.success("Prompt deleted");
        setIsDeleteDialogOpen(false);
        setPromptToDelete(null);
      }
    } catch (err) {
      toast.error("Error deleting prompt");
    }
  };

  const openDeleteDialog = (prompt: Prompt) => {
    setPromptToDelete(prompt);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Prompt Templates</h1>
          <p className="text-muted-foreground">Manage and reuse your AI prompt templates for consistent content generation.</p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              className="h-10 w-full bg-card border-muted-foreground/10 pl-10 sm:w-64"
              value={searchQuery}
              onChange={(e) => { 
                const q = e.target.value;
                setSearchQuery(q); 
                updateQueryParams({ q, page: 1 });
              }}
            />
          </div>
          <Button
            className="h-10 w-full gap-2 sm:w-auto"
            onClick={() => navigate('/prompts/new')}
          >
            <Plus className="w-4 h-4" /> New Template
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-3xl border border-muted-foreground/10 bg-card text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-bold">Loading prompts...</p>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/10">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No Templates Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              {searchQuery ? `No results found for "${searchQuery}".` : "You haven't created any prompt templates yet."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* List Header - Desktop Only */}
            <div className="hidden lg:grid lg:grid-cols-[1.5fr_2.5fr_160px_120px_160px] items-center gap-4 px-6 py-4 bg-muted/40 border-b border-muted-foreground/10 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
              <span>Title</span>
              <span>Prompt Definition</span>
              <span>Author</span>
              <span>Updated</span>
              <span className="text-right">Actions</span>
            </div>

            {/* List Items */}
            <div className="divide-y divide-muted-foreground/5">
              {filteredPrompts.map((prompt) => (
                <div key={prompt.id} className="group hover:bg-primary/[0.02] transition-all duration-300 px-6 py-5 flex flex-col gap-4 lg:grid lg:grid-cols-[1.5fr_2.5fr_160px_120px_160px] lg:items-center lg:gap-4">
                  
                  {/* Col 1: Title */}
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                        {prompt.title}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                        Template ID: {prompt.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  {/* Col 2: Content Preview */}
                  <div className="min-w-0 flex flex-col gap-1">
                    <p 
                      className="text-sm font-medium text-muted-foreground leading-relaxed line-clamp-2 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => openViewModal(prompt.title, prompt.text)}
                    >
                      {prompt.text}
                    </p>
                  </div>

                  {/* Col 3: Author */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium truncate">
                    <UserIcon className="w-3.5 h-3.5 opacity-50" />
                    <span className="truncate">{prompt.author || prompt.authorEmail || 'Unknown'}</span>
                  </div>

                  {/* Col 4: Time */}
                  <div className="flex flex-row lg:flex-col gap-3 lg:gap-1 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground/70 font-semibold uppercase tracking-wider">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {prompt.updatedAt}
                    </div>
                  </div>

                  {/* Col 5: Actions */}
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 rounded-xl bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all font-bold"
                      onClick={() => navigate(`/prompts/edit/${prompt.id}`)}
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive shadow-sm shadow-destructive/5 hover:text-white transition-all transform hover:rotate-12"
                      onClick={() => openDeleteDialog(prompt)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Pagination Controller */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-muted/20 border-t border-muted-foreground/10 border-b border-b-muted-foreground/5 mt-6">
        <div className="text-sm text-muted-foreground font-medium text-center sm:text-left">
          Showing <span className="font-bold text-foreground">{filteredPrompts.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-bold text-foreground">{(page - 1) * pageSize + filteredPrompts.length}</span> of <span className="font-bold text-foreground">{totalItems}</span> templates
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Rows per page:</span>
            <select
              className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer hover:text-primary transition-colors"
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
              className="h-8 w-8 rounded-lg border-muted-foreground/10 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all font-bold"
              onClick={() => updateQueryParams({ page: Math.max(1, page - 1) })}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-sm font-bold min-w-[80px] text-center text-muted-foreground">
              Page <span className="text-foreground">{page}</span> of {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-muted-foreground/10 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all font-bold"
              onClick={() => updateQueryParams({ page: Math.min(totalPages, page + 1) })}
              disabled={page >= totalPages || isLoading}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-2xl border-muted-foreground/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete Prompt Template
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete the prompt template <strong>{promptToDelete?.title}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl font-bold" onClick={handleDelete}>
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewModalContent} onOpenChange={(open) => !open && setViewModalContent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col rounded-2xl border-muted-foreground/10 shadow-2xl">
          <DialogHeader className="pb-4 border-b border-muted-foreground/5">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-primary">
              <Terminal className="w-5 h-5" />
              {viewModalContent?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-6">
            <pre className="text-sm leading-relaxed text-foreground whitespace-pre-wrap font-sans bg-muted/30 p-4 rounded-xl border border-muted-foreground/5">
              {viewModalContent?.content}
            </pre>
          </div>
          <DialogFooter className="pt-4 border-t border-muted-foreground/5">
            <Button 
              variant="outline" 
              className="rounded-xl font-bold px-8"
              onClick={() => setViewModalContent(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
