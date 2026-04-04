import * as React from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  ArrowLeft,
  Search,
  Check,
  X,
  Filter,
  CheckCircle2,
  Globe,
  Loader2
} from 'lucide-react';
import { Campaign, Channel } from '../types';
import { cn } from '@/src/lib/utils';
import { XIcon } from '../components/XIcon';
import { Instagram, Linkedin, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { createCampaign, updateCampaign, getCampaign } from '../api/campaigns';
import { listChannels } from '../api/channels';

export default function CampaignFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const isEditing = !!id;

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    channels: [] as string[]
  });

  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [channelSearch, setChannelSearch] = React.useState('');
  const [platformFilter, setPlatformFilter] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const chanRes = await listChannels(token, 1, 100);
      if (chanRes.data) {
        setChannels(chanRes.data.items.map(c => ({
          id: c.id,
          platform: c.platform.toUpperCase() as any,
          username: c.displayName || c.username || c.externalId,
          handle: c.username ? `@${c.username}` : undefined,
          avatar: c.avatarUrl || c.profileUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.id}`,
          status: c.isEnabled ? 'Connected' : 'Disconnected',
          followers: 0,
          lastSync: new Date(c.createdAt).toLocaleDateString(),
          enabled: c.isEnabled
        })));
      }

      if (isEditing && id) {
        const campRes = await getCampaign(id, token);
        if (campRes.data) {
          const c = campRes.data;
          const loadedChannels = chanRes.data?.items ?? [];
          const loadedChannelIdByLower = new Map(loadedChannels.map(ch => [ch.id.toLowerCase(), ch.id]));
          const normalizedCampaignChannelIds = Array.from(new Set(
            (c.channelLinkIds || [])
              .map(channelId => loadedChannelIdByLower.get(channelId.toLowerCase()))
              .filter((id): id is string => !!id)
          ));

          setFormData({
            name: c.name,
            description: c.description,
            channels: normalizedCampaignChannelIds
          });
        } else {
          toast.error("Campaign not found");
          navigate('/campaigns');
        }
      }
    } catch (err) {
      toast.error("Error loading data");
    } finally {
      setIsLoading(false);
    }
  }, [token, id, isEditing, navigate]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredChannels = channels.filter(channel => {
    if (!channel.enabled) return false;
    const matchesSearch = channel.username.toLowerCase().includes(channelSearch.toLowerCase()) ||
                         channel.platform.toLowerCase().includes(channelSearch.toLowerCase());
    const selectedPlatform = platformFilter?.toLowerCase();
    const channelPlatform = channel.platform.toLowerCase();
    const matchesPlatform = selectedPlatform
      ? channelPlatform === selectedPlatform || (selectedPlatform === 'x' && channelPlatform === 'twitter')
      : true;
    return matchesSearch && matchesPlatform;
  });

  const isChannelSelected = React.useCallback((channelId: string) => {
    const channelIdLower = channelId.toLowerCase();
    return formData.channels.some(selectedId => selectedId.toLowerCase() === channelIdLower);
  }, [formData.channels]);

  const toggleChannel = (channelId: string) => {
    const channelIdLower = channelId.toLowerCase();
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.some(id => id.toLowerCase() === channelIdLower)
        ? prev.channels.filter(id => id.toLowerCase() !== channelIdLower)
        : [...prev.channels, channelId]
    }));
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredChannels.map(c => c.id);
    setFormData(prev => ({
      ...prev,
      channels: [
        ...prev.channels,
        ...filteredIds.filter(id => !prev.channels.some(existingId => existingId.toLowerCase() === id.toLowerCase()))
      ]
    }));
  };

  const deselectAllFiltered = () => {
    const filteredIdSet = new Set(filteredChannels.map(c => c.id.toLowerCase()));
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.filter(id => !filteredIdSet.has(id.toLowerCase()))
    }));
  };

  const getUniqueChannelIds = React.useCallback((channelIds: string[]) => {
    const seen = new Set<string>();
    const uniqueIds: string[] = [];

    for (const channelId of channelIds) {
      const key = channelId.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueIds.push(channelId);
    }

    return uniqueIds;
  }, []);

  const handleSave = async () => {
    if (!token) return;
    if (!formData.name) {
      toast.error("Campaign name is required");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && id) {
        const { error } = await updateCampaign(id, {
          name: formData.name,
          description: formData.description,
          channelLinkIds: getUniqueChannelIds(formData.channels)
        }, token);
        if (error) {
          toast.error("Failed to update campaign", { description: error });
        } else {
          toast.success("Campaign updated successfully");
          navigate(`/campaigns/${id}`);
        }
      } else {
        const { data, error } = await createCampaign({
          name: formData.name,
          description: formData.description,
          channelLinkIds: getUniqueChannelIds(formData.channels)
        }, token);
        if (error) {
          toast.error("Failed to create campaign", { description: error });
        } else if (data) {
          toast.success("Campaign created successfully");
          navigate(`/campaigns/${data.id}`);
        }
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'x':
      case 'twitter':
        return <XIcon className="w-4 h-4" />;
      case 'instagram':
        return <Instagram className="w-4 h-4" />;
      case 'linkedin':
        return <Linkedin className="w-4 h-4" />;
      case 'facebook':
        return <Facebook className="w-4 h-4" />;
      default: return null;
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

  return (
    <div className="w-full space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(isEditing ? `/campaigns/${id}` : '/campaigns')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isEditing ? 'Edit Campaign' : 'Create New Campaign'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update your campaign settings and target channels.' : 'Set up a new campaign and select which channels will participate.'}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-muted-foreground/10 bg-card">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>General details about your campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Q4 Growth Sprint"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="bg-muted/30 border-muted-foreground/5"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What is the goal of this campaign?"
                  className="min-h-[120px] resize-none bg-muted/30 border-muted-foreground/5"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground border-none shadow-xl">
            <CardHeader>
              <CardTitle className="text-primary-foreground/70 text-sm font-medium uppercase tracking-wider">Selection Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold">{formData.channels.length}</span>
                <span className="text-primary-foreground/70 mb-1">Channels Selected</span>
              </div>
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary-foreground/70">Total Available</span>
                  <span>{channels.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary-foreground/70">Coverage</span>
                  <span>{Math.round((formData.channels.length / channels.length) * 100) || 0}%</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-primary-foreground/10">
              <Button
                className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    isEditing ? 'Save Changes' : 'Launch Campaign'
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Bot Selection */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="h-full flex flex-col border-muted-foreground/10 bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Channel Selection</CardTitle>
                  <CardDescription>Select which accounts will be used for this campaign.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs border-muted-foreground/10" onClick={selectAllFiltered}>Select All</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs border-muted-foreground/10" onClick={deselectAllFiltered}>Deselect All</Button>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username or platform..."
                    className="pl-10 h-10 bg-muted/30 border-muted-foreground/5"
                    value={channelSearch}
                    onChange={e => setChannelSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {[
                    { value: 'X', label: 'X (formerly Twitter)' },
                    { value: 'Instagram', label: 'Instagram' },
                    { value: 'LinkedIn', label: 'LinkedIn' },
                    { value: 'Facebook', label: 'Facebook' }
                  ].map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={platformFilter === value ? 'default' : 'outline'}
                      size="sm"
                      className="h-10 px-3 border-muted-foreground/10"
                      onClick={() => setPlatformFilter(platformFilter === value ? null : value)}
                    >
                      {getPlatformIcon(value)}
                      <span className="ml-1">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto max-h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredChannels.length > 0 ? (
                  filteredChannels.map(channel => (
                    <div
                      key={channel.id}
                      onClick={() => toggleChannel(channel.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200",
                        isChannelSelected(channel.id)
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                          : "border-muted-foreground/10 hover:border-muted-foreground/20 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full overflow-hidden border border-muted-foreground/5 shrink-0 bg-muted">
                          <img src={channel.avatar} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate text-foreground">{channel.username}</p>
                          {channel.handle && (
                            <p className="text-xs text-muted-foreground truncate leading-tight mb-0.5">{channel.handle}</p>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {getPlatformIcon(channel.platform)}
                            <span>{channel.platform}</span>
                          </div>
                        </div>
                      </div>
                      {isChannelSelected(channel.id) ? (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full border border-muted-foreground/10 shrink-0" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
                      <Search className="h-6 w-6" />
                    </div>
                    <p className="text-muted-foreground font-medium">No accounts found matching your search.</p>
                    <Button variant="link" onClick={() => {setChannelSearch(''); setPlatformFilter(null);}}>
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
