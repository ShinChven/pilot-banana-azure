import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/src/components/ui/dropdown-menu";
import {
  Plus,
  Calendar,
  Layers,
  ArrowRight,
  MoreVertical,
  Clock,
  Search,
  Megaphone,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Input } from "@/src/components/ui/input";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/src/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Campaign } from '../types';
import { useAuth } from '../context/AuthContext';
import { listCampaigns, deleteCampaign, updateCampaign } from '../api/campaigns';
import { listChannels } from '../api/channels';
import { toast } from 'sonner';

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '');
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [channelsById, setChannelsById] = React.useState<Record<string, { username: string; avatar: string }>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  // Pagination State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '12', 10);
  const [totalItems, setTotalItems] = React.useState(0);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [campaignToDelete, setCampaignToDelete] = React.useState<Campaign | null>(null);

  const fetchCampaigns = React.useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [campaignRes, channelRes] = await Promise.all([
        listCampaigns(token, page, pageSize),
        listChannels(token, 1, 100),
      ]);

      if (campaignRes.error) {
        toast.error('Failed to load campaigns', { description: campaignRes.error });
      } else if (campaignRes.data) {
        setTotalItems(campaignRes.data.total);
        const mapped: Campaign[] = campaignRes.data.items.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || `Campaign created on ${new Date(c.createdAt).toLocaleDateString()}`,
          status: c.status === 'Active' ? 'Active' : 'Inactive',
          startDate: new Date(c.createdAt).toLocaleDateString(),
          endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : '-',
          channels: c.channelLinkIds,
          posts: [], // Not returned in list
          thumbnail: `https://api.dicebear.com/7.x/shapes/svg?seed=${c.id}&backgroundColor=f1f5f9`,
          totalPosts: c.totalPosts,
          postedPosts: c.postedPosts
        }));
        setCampaigns(mapped);
      }

      if (channelRes.error) {
        toast.error('Failed to load channels', { description: channelRes.error });
      } else if (channelRes.data) {
        setChannelsById(
          Object.fromEntries(
            channelRes.data.items.map(channel => [
              channel.id,
              {
                username: channel.displayName || channel.username || channel.externalId,
                avatar: channel.avatarUrl || channel.profileUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${channel.id}`,
              },
            ])
          )
        );
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  }, [token, page, pageSize]);

  React.useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const totalPages = Math.ceil(totalItems / pageSize);

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
  };

  const openDeleteDialog = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCampaign = async () => {
    if (!token || !campaignToDelete) return;
    const id = campaignToDelete.id;
    try {
        const { error } = await deleteCampaign(id, token);
        if (error) {
            toast.error('Failed to delete campaign', { description: error });
        } else {
            setCampaigns(prev => prev.filter(c => c.id !== id));
            toast.success('Campaign deleted');
            setIsDeleteDialogOpen(false);
            setCampaignToDelete(null);
        }
    } catch (err) {
        toast.error('Error deleting campaign');
    }
  };

  const handleToggleCampaignStatus = async (campaign: Campaign) => {
    if (!token) return;

    const shouldActivate = campaign.status !== 'Active';
    const apiStatus = shouldActivate ? 'Active' : 'Paused';
    const uiStatus: Campaign['status'] = shouldActivate ? 'Active' : 'Inactive';

    try {
      const { error } = await updateCampaign(campaign.id, { status: apiStatus }, token);
      if (error) {
        toast.error('Failed to update campaign', { description: error });
        return;
      }

      setCampaigns(prev => prev.map(c =>
        c.id === campaign.id ? { ...c, status: uiStatus } : c
      ));
      toast.success(`Campaign ${shouldActivate ? 'resumed' : 'paused'}`);
    } catch (err) {
      toast.error('Error updating campaign');
    }
  };

  const getCampaignProgress = (campaign: Campaign) => {
    const totalPosts = campaign.totalPosts ?? 0;
    const postedPosts = campaign.postedPosts ?? 0;
    const completedPosts = Math.min(postedPosts, totalPosts);
    const progress = totalPosts > 0 ? Math.round((completedPosts / totalPosts) * 100) : 0;

    return { totalPosts, completedPosts, progress };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Campaigns</h1>
          <p className="text-muted-foreground">Organize your posts into projects and track their progress.</p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
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
            onClick={() => navigate('/campaigns/new')}
          >
            <Plus className="w-4 h-4" /> New Campaign
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-card border border-dashed rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No campaigns yet</h3>
          <p className="text-muted-foreground max-w-sm mt-2 mb-8">
            Create your first campaign to start scheduling and automating your posts across channels.
          </p>
          <Button onClick={() => navigate('/campaigns/new')} className="gap-2">
            <Plus className="w-4 h-4" /> Create Campaign
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.map((campaign) => {
            const { totalPosts, completedPosts, progress } = getCampaignProgress(campaign);
            const campaignChannels = campaign.channels
              .map((channelId) => channelsById[channelId])
              .filter((channel): channel is { username: string; avatar: string } => Boolean(channel));
            const visibleChannels = campaignChannels.slice(0, 3);
            const extraChannelCount = Math.max(campaignChannels.length - 3, 0);

            return (
              <Card key={campaign.id} className="group overflow-hidden border-muted-foreground/10 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 p-0">
                <div className="relative h-40 overflow-hidden bg-muted">
                  <img
                    src={campaign.thumbnail}
                    alt={campaign.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge className={`${
                      campaign.status === 'Active' ? 'bg-emerald-500 hover:bg-emerald-600' :
                      'bg-amber-500 hover:bg-amber-600'
                    } text-white border-none shadow-lg`}>
                      {campaign.status}
                    </Badge>
                  </div>
                </div>

                <CardHeader className="pt-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">{campaign.name}</CardTitle>
                      <CardDescription className="line-clamp-1 mt-1">{campaign.description}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={(props) => (
                        <Button {...props} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      )} nativeButton={true} />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/campaigns/edit/${campaign.id}`)}>
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleToggleCampaignStatus(campaign)}>
                          {campaign.status === 'Active' ? 'Pause Campaign' : 'Resume Campaign'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(campaign)}>Delete Campaign</DropdownMenuItem>                    </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>{campaign.startDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>Ends {campaign.endDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      <span>{campaign.channels.length} Channels</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-muted-foreground/10 bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Channels</p>
                    </div>
                    <AvatarGroup className="items-center">
                      {visibleChannels.map((channel) => (
                        <Avatar key={channel.username} size="sm">
                          <AvatarImage src={channel.avatar} alt={channel.username} referrerPolicy="no-referrer" />
                          <AvatarFallback>{channel.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ))}
                      {extraChannelCount > 0 && (
                        <AvatarGroupCount className="size-6 text-xs">
                          ...
                        </AvatarGroupCount>
                      )}
                    </AvatarGroup>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">Progress</span>
                      <span className="text-muted-foreground">{completedPosts}/{totalPosts} posts</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {totalPosts > 0 ? `${progress}% completed` : 'No posts yet'}
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="py-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-muted-foreground hover:text-foreground hover:bg-accent group/btn"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    View Campaign
                    <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controller */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card rounded-3xl border border-muted-foreground/10 shadow-sm mt-6">
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          Showing <span className="font-semibold text-foreground">{campaigns.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-semibold text-foreground">{(page - 1) * pageSize + campaigns.length}</span> of <span className="font-semibold text-foreground">{totalItems}</span> campaigns
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <select
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
              value={pageSize}
              onChange={(e) => { updateQueryParams({ pageSize: Number(e.target.value), page: 1 }); }}
            >
              {[12, 24, 48, 96].map(size => (
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
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the campaign <strong>{campaignToDelete?.name}</strong>? This action cannot be undone and will delete all associated posts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCampaign}>
              Delete Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
