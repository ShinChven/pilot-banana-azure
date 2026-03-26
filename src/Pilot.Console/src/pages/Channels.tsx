import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import {
  Instagram,
  Linkedin,
  Facebook,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Search,
  Loader2,
  Trash2,
  KeyRound,
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
import { XIcon } from '@/src/components/XIcon';
import { Channel } from '@/src/types';
import { toast } from "sonner";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";
import { useAuth } from '../context/AuthContext';
import { listChannels, updateChannel, getConnectUrl, deleteChannel, refreshChannelToken, type ChannelLinkResponse } from '../api/channels';

function mapChannelResponse(c: ChannelLinkResponse): Channel {
  return {
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
  };
}

export default function ChannelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [refreshingChannelId, setRefreshingChannelId] = React.useState<string | null>(null);

  // Pagination State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '24', 10);
  const [totalItems, setTotalItems] = React.useState(0);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [channelToDelete, setChannelToDelete] = React.useState<Channel | null>(null);

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
  };

  const fetchChannels = React.useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const { data, error } = await listChannels(token, page, pageSize);
      if (error) {
        toast.error('Failed to load channels', { description: error });
      } else if (data) {
        setTotalItems(data.total);
        const mapped: Channel[] = data.items.map(mapChannelResponse);
        setChannels(mapped);
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  }, [token, page, pageSize]);

  React.useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const totalPages = Math.ceil(totalItems / pageSize);

  const filteredChannels = channels.filter(channel =>
    channel.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSync = async () => {
    setIsSyncing(true);
    await fetchChannels();
    setIsSyncing(false);
    toast.success("Channels refreshed successfully");
  };

  const handleRefreshToken = async (id: string) => {
    if (!token) return;
    setRefreshingChannelId(id);
    try {
      const { data, error } = await refreshChannelToken(id, token);
      if (error) {
        toast.error('Token refresh failed', { description: error });
      } else if (data && data.success) {
        if (data.channel) {
          setChannels(prev => prev.map(ch => ch.id === id ? mapChannelResponse(data.channel!) : ch));
        }
        toast.success('Token refreshed successfully');
      } else {
        toast.error('Token refresh failed', { description: 'The platform rejected the refresh attempt.' });
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred during refresh' });
    } finally {
      setRefreshingChannelId(null);
    }
  };

  const toggleChannelEnabled = async (id: string, currentEnabled: boolean) => {
    if (!token) return;
    try {
      const { error } = await updateChannel(id, { isEnabled: !currentEnabled }, token);
      if (error) {
        toast.error('Failed to update channel', { description: error });
      } else {
        setChannels(prev => prev.map(ch =>
          ch.id === id ? { ...ch, enabled: !currentEnabled, status: !currentEnabled ? 'Connected' : 'Disconnected' } : ch
        ));
        toast.success(`Channel ${!currentEnabled ? 'activated' : 'deactivated'}`);
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred' });
    }
  };

  const handleDeleteChannel = async () => {
    if (!token || !channelToDelete) return;
    const id = channelToDelete.id;
    try {
      const { status, error } = await deleteChannel(id, token);
      if (error) {
        toast.error('Failed to delete channel', { description: error });
      } else {
        setChannels(prev => prev.filter(ch => ch.id !== id));
        toast.success('Channel deleted');
        setIsDeleteDialogOpen(false);
        setChannelToDelete(null);
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred' });
    }
  }

  const openDeleteDialog = (channel: Channel) => {
    setChannelToDelete(channel);
    setIsDeleteDialogOpen(true);
  };

  const connectAccount = async (platform: string) => {
    if (!token) return;
    if (platform !== 'X') {
        toast.info(`${platform} connection is not yet implemented in the API.`);
        return;
    }

    try {
      const { data, error } = await getConnectUrl(platform.toLowerCase(), token);
      if (error) {
        toast.error(`Failed to connect ${platform}`, { description: error });
      } else if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else if (data?.message) {
        toast.warning(data.message);
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred' });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Channels</h1>
          <p className="text-muted-foreground">Manage your connected social media accounts and automation status.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search channels..."
              className="pl-10 w-64 h-10 bg-card border-muted-foreground/10"
              value={searchQuery}
              onChange={(e) => { 
                const q = e.target.value;
                setSearchQuery(q); 
                updateQueryParams({ q, page: 1 });
              }}
            />
          </div>
          <Button onClick={handleSync} disabled={isSyncing || isLoading} variant="outline" className="gap-2 h-10">
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync All
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Connection Cards */}
        <Card className="border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Connect New Account</CardTitle>
            <CardDescription>Expand your reach by adding more platforms.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" size="sm" className="h-10 w-full min-w-0 justify-start gap-2 overflow-hidden" onClick={() => connectAccount('X')}>
              <XIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">X (formerly Twitter)</span>
            </Button>
            <Button variant="outline" size="sm" className="h-10 w-full min-w-0 justify-start gap-2 overflow-hidden text-muted-foreground/50" disabled onClick={() => connectAccount('Instagram')}>
              <Instagram className="w-4 h-4 shrink-0" />
              <span className="truncate">Instagram</span>
            </Button>
            <Button variant="outline" size="sm" className="h-10 w-full min-w-0 justify-start gap-2 overflow-hidden text-muted-foreground/50" disabled onClick={() => connectAccount('LinkedIn')}>
              <Linkedin className="w-4 h-4 shrink-0" />
              <span className="truncate">LinkedIn</span>
            </Button>
            <Button variant="outline" size="sm" className="h-10 w-full min-w-0 justify-start gap-2 overflow-hidden text-muted-foreground/50" disabled onClick={() => connectAccount('Facebook')}>
              <Facebook className="w-4 h-4 shrink-0" />
              <span className="truncate">Facebook</span>
            </Button>
          </CardContent>
        </Card>

        {/* Existing Channels */}
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredChannels.map((channel) => (
          <Card key={channel.id} className={cn("relative overflow-hidden flex flex-col h-full transition-all duration-300 border-muted-foreground/10 hover:shadow-lg", !channel.enabled && "opacity-60")}>
            <div className={`absolute top-0 left-0 w-1 h-full z-10 ${
              !channel.enabled ? 'bg-muted' : (channel.status === 'Connected' ? 'bg-emerald-500' : 'bg-destructive')
            }`} />
            <CardHeader className="flex flex-row items-center gap-4 pb-2 h-[90px] shrink-0">
              <Avatar className={cn("h-12 w-12 border shadow-sm", !channel.enabled && "grayscale")}>
                <AvatarImage src={channel.avatar} alt={channel.username} />
                <AvatarFallback className="text-lg font-bold">{channel.username[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {channel.profileUrl ? (
                  <a
                    href={channel.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/link block"
                  >
                    <CardTitle className="text-lg font-bold truncate text-foreground leading-tight group-hover/link:text-primary transition-colors">
                      {channel.username}
                    </CardTitle>
                    {channel.handle && (
                      <p className="text-sm text-muted-foreground truncate leading-tight mt-1 font-medium group-hover/link:opacity-80">
                        {channel.handle}
                      </p>
                    )}
                  </a>
                ) : (
                  <>
                    <CardTitle className="text-lg font-bold truncate text-foreground leading-tight">
                      {channel.username}
                    </CardTitle>
                    {channel.handle && (
                      <p className="text-sm text-muted-foreground truncate leading-tight mt-1 font-medium">
                        {channel.handle}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="shrink-0 opacity-60">
                {getPlatformIcon(channel.platform)}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 justify-between pt-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground/60 mb-4 px-1">
                 <span>Added {channel.lastSync}</span>
                 <span className={cn(
                   "font-bold uppercase tracking-tight",
                   !channel.enabled ? "text-muted-foreground" : (channel.status === 'Connected' ? "text-emerald-500" : "text-destructive")
                 )}>
                   {!channel.enabled ? 'Deactivated' : (channel.status === 'Connected' ? 'Connected' : 'Auth Required')}
                 </span>
              </div>
              <div className="flex items-center justify-between h-14 pt-2 border-t border-muted-foreground/5 mt-auto">
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30", channel.enabled && channel.status === 'Connected' ? "text-emerald-500" : "text-muted-foreground")}>
                  {channel.enabled && channel.status === 'Connected' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span className="text-xs font-black uppercase tracking-wider">
                    {channel.enabled && channel.status === 'Connected' ? 'Ready' : (!channel.enabled ? 'Paused' : 'Error')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                    onClick={() => openDeleteDialog(channel)}
                    title="Delete Channel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground"
                    onClick={() => handleRefreshToken(channel.id)}
                    disabled={refreshingChannelId === channel.id}
                    title="Refresh Auth Token"
                  >
                    <KeyRound className={cn("w-4 h-4", refreshingChannelId === channel.id && "animate-spin")} />
                  </Button>
                  <Button
                    variant={channel.enabled ? "outline" : "default"}
                    size="sm"
                    className="h-8 text-[10px] px-3 font-bold uppercase tracking-wider rounded-full shadow-sm"
                    onClick={() => toggleChannelEnabled(channel.id, channel.enabled)}
                  >
                    {channel.enabled ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Controller */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card rounded-3xl border border-muted-foreground/10 shadow-sm mt-6">
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          Showing <span className="font-semibold text-foreground">{channels.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-semibold text-foreground">{(page - 1) * pageSize + channels.length}</span> of <span className="font-semibold text-foreground">{totalItems}</span> channels
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
            <DialogTitle>Delete Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the channel <strong>{channelToDelete?.username}</strong> ({channelToDelete?.platform})? This action cannot be undone and will stop all automated posts for this channel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteChannel}>
              Delete Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
