import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Terminal,
  Calendar,
  User as UserIcon,
  MessageSquare,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
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

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
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

      <div className="space-y-3">
        {!isLoading && filteredPrompts.length > 0 && (
          <div className="hidden md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_160px_120px_80px] md:items-center md:gap-4 rounded-2xl border border-muted-foreground/10 bg-muted/20 px-4 py-3 text-sm font-semibold text-muted-foreground">
            <span>Title</span>
            <span>Prompt Text</span>
            <span>Author</span>
            <span>Updated</span>
            <span className="text-right">Actions</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-3xl border border-muted-foreground/10 bg-card text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading prompts...</p>
          </div>
        ) : filteredPrompts.length > 0 ? (
          filteredPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-3xl border border-muted-foreground/10 bg-card p-4 shadow-sm transition-colors hover:bg-muted/20 sm:p-5"
            >
              <div className="md:hidden">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{prompt.title}</span>
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {prompt.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => navigate(`/prompts/edit/${prompt.id}`)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => openDeleteDialog(prompt)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>{prompt.author || prompt.authorEmail || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{prompt.updatedAt}</span>
                  </div>
                </div>
              </div>

              <div className="hidden md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_160px_120px_80px] md:items-center md:gap-4">
                <div className="min-w-0 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{prompt.title}</span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {prompt.text}
                </p>
                <div className="truncate text-sm text-muted-foreground">
                  {prompt.author || prompt.authorEmail || 'Unknown'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {prompt.updatedAt}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(`/prompts/edit/${prompt.id}`)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => openDeleteDialog(prompt)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex h-40 flex-col items-center justify-center rounded-3xl border border-muted-foreground/10 bg-card text-center text-muted-foreground">
            <MessageSquare className="mb-2 w-8 h-8 opacity-20" />
            <p>No prompt templates found.</p>
          </div>
        )}
      </div>

      {/* Pagination Controller */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card rounded-3xl border border-muted-foreground/10 shadow-sm">
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          Showing <span className="font-semibold text-foreground">{prompts.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-semibold text-foreground">{(page - 1) * pageSize + prompts.length}</span> of <span className="font-semibold text-foreground">{totalItems}</span> templates
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Prompt Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the prompt template <strong>{promptToDelete?.title}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
