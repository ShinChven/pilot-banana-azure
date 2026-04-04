import * as React from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import { Separator } from "@/src/components/ui/separator";
import { Badge } from "@/src/components/ui/badge";
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Key, 
  Smartphone, 
  Monitor, 
  Trash2, 
  Plus,
  Loader2,
  RefreshCw,
  LogOut,
  Camera,
  CheckCircle2,
  Fingerprint,
  Smile,
  Pencil,
  Copy,
  KeyRound,
  ShieldCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Info,
  HelpCircle,
  ExternalLink,
  Globe
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { cn } from '@/src/lib/utils';
import { toast } from "sonner";
import { useAuth } from '../context/AuthContext';
import { listPasskeys, deletePasskey, getRegisterOptions, registerPasskey } from '../api/passkeys';
import { updateMe } from '../api/users';
import { useSearchParams } from 'react-router-dom';
import { listAccessTokens, createAccessToken, revokeAccessToken, type AccessToken } from '../api/accessTokens';
import { listApiClients, createApiClient, revokeApiClient, type ApiClient, type ApiClientCreated } from '../api/apiClients';
import { AvatarPicker } from '../components/AvatarPicker';

type Passkey = {
  id: string;
  name: string;
  device: string;
  createdAt: string;
  lastUsed: string;
  type: 'mobile' | 'desktop';
};

// Helper to convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper to convert string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Helper to convert ArrayBuffer to base64url
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export default function SettingsPage() {
  const { user, token, refreshUser, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  const handleTabChange = (value: any) => {
    setSearchParams({ tab: value });
  };

  const [name, setName] = React.useState('');
  const [passkeys, setPasskeys] = React.useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRegistering, setIsRegistering] = React.useState(false);

  // Password state
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [isDeletingPassword, setIsDeletingPassword] = React.useState(false);

  // Avatar state
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = React.useState(false);

  // Access Token state
  const [accessTokens, setAccessTokens] = React.useState<AccessToken[]>([]);
  const [tokenTotal, setTokenTotal] = React.useState(0);
  const [tokenPage, setTokenPage] = React.useState(1);
  const tokenPageSize = 5; // Smaller for settings page
  const [isLoadingTokens, setIsLoadingTokens] = React.useState(true);
  const [isCreatingToken, setIsCreatingToken] = React.useState(false);
  const [newTokenName, setNewTokenName] = React.useState('');
  const [newTokenExpiry, setNewTokenExpiry] = React.useState<string>('90');
  const [isCreateTokenDialogOpen, setIsCreateTokenDialogOpen] = React.useState(false);
  const [createdTokenValue, setCreatedTokenValue] = React.useState<string | null>(null);
  const [isRevokeTokenDialogOpen, setIsRevokeTokenDialogOpen] = React.useState(false);
  const [tokenToRevoke, setTokenToRevoke] = React.useState<AccessToken | null>(null);

  // API Client state
  const [apiClients, setApiClients] = React.useState<ApiClient[]>([]);
  const [clientTotal, setClientTotal] = React.useState(0);
  const [clientPage, setClientPage] = React.useState(1);
  const clientPageSize = 5;
  const [isLoadingClients, setIsLoadingClients] = React.useState(true);
  const [isCreatingClient, setIsCreatingClient] = React.useState(false);
  const [newClientName, setNewClientName] = React.useState('');
  const [newClientRedirectUri, setNewClientRedirectUri] = React.useState('');
  const [isCreateClientDialogOpen, setIsCreateClientDialogOpen] = React.useState(false);
  const [createdClient, setCreatedClient] = React.useState<ApiClientCreated | null>(null);
  const [isRevokeClientDialogOpen, setIsRevokeClientDialogOpen] = React.useState(false);
  const [clientToRevoke, setClientToRevoke] = React.useState<ApiClient | null>(null);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeletePasswordDialogOpen, setIsDeletePasswordDialogOpen] = React.useState(false);
  const [passkeyToDelete, setPasskeyToDelete] = React.useState<Passkey | null>(null);

  React.useEffect(() => {
    if (user) {
        setName(user.name);
    }
  }, [user]);

  const fetchPasskeys = React.useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const { data, error } = await listPasskeys(token);
      if (data) {
        setPasskeys(data.map((pk: any) => ({
          id: pk.credentialId || pk.id,
          name: pk.label || 'Passkey',
          device: pk.userAgent || 'Unknown Device',
          createdAt: new Date(pk.createdAt).toLocaleDateString(),
          lastUsed: pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleDateString() : 'Never',
          type: (pk.userAgent || '').toLowerCase().includes('mobile') ? 'mobile' : 'desktop'
        })));
      }
    } catch (err) {
      toast.error("Failed to load passkeys");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;
    setIsSaving(true);
    try {
        const { error } = await updateMe({ name }, token);
        if (error) {
            toast.error('Failed to update profile', { description: error });
        } else {
            toast.success('Profile updated successfully');
            await refreshUser();
        }
    } catch (err) {
        toast.error("Error updating profile");
    } finally {
        setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
    }
    if (!token) return;
    setIsChangingPassword(true);
    try {
        const { error } = await updateMe({ password: newPassword }, token);
        if (error) {
            toast.error('Failed to change password', { description: error });
        } else {
            toast.success('Password changed successfully');
            setNewPassword('');
            setConfirmPassword('');
            await refreshUser();
        }
    } catch (err) {
        toast.error("Error changing password");
    } finally {
        setIsChangingPassword(false);
    }
  };

  const handleDeletePassword = async () => {
    if (!token) return;
    setIsDeletingPassword(true);
    try {
      const { error } = await updateMe({ deletePassword: true } as any, token);
      if (error) {
        toast.error('Failed to delete password', { description: error });
      } else {
        toast.success('Password deleted successfully');
        await refreshUser();
        setIsDeletePasswordDialogOpen(false);
      }
    } catch (err) {
      toast.error("Error deleting password");
    } finally {
      setIsDeletingPassword(false);
    }
  };

  const openDeleteDialog = (passkey: Passkey) => {
    setPasskeyToDelete(passkey);
    setIsDeleteDialogOpen(true);
  };

  const removePasskey = async () => {
    if (!token || !passkeyToDelete) return;
    const id = passkeyToDelete.id;
    try {
        const { error } = await deletePasskey(id, token);
        if (error) {
            toast.error("Failed to remove passkey", { description: error });
        } else {
            setPasskeys(passkeys.filter(pk => pk.id !== id));
            toast.success('Passkey removed');
            setIsDeleteDialogOpen(false);
            setPasskeyToDelete(null);
        }
    } catch (err) {
        toast.error("Error removing passkey");
    }
  };

  const addPasskey = async () => {
    if (!token || !user) return;
    setIsRegistering(true);
    try {
      const { data: options, error: optError } = await getRegisterOptions(token);
      if (optError || !options) {
        toast.error("Failed to get registration options", { description: optError });
        return;
      }

      const credentialOptions: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: stringToUint8Array(options.challenge as unknown as string),
        user: {
          ...options.user,
          id: stringToUint8Array(options.user.id as unknown as string)
        }
      };

      const credential = await navigator.credentials.create({
        publicKey: credentialOptions
      }) as any;

      if (credential) {
        const response = credential.response as AuthenticatorAttestationResponse;
        
        let publicKey = '';
        // Try Level 3 getPublicKey()
        if (typeof response.getPublicKey === 'function') {
          const pkBuffer = response.getPublicKey();
          if (pkBuffer) {
            publicKey = arrayBufferToBase64Url(pkBuffer);
          }
        }
        
        // If not available (rare in modern browsers), we would need a CBOR library to parse attestationObject.
        // For this simplified implementation, we'll fall back to empty if we can't get it, 
        // but modern browsers should support getPublicKey().
        if (!publicKey) {
          toast.error("Your browser does not support public key extraction. Please try a different browser.");
          return;
        }

        const registrationRequest = {
          id: credential.id,
          publicKey: publicKey,
          clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
          label: `${user.name}'s Passkey`
        };

        const { error: regError } = await registerPasskey(registrationRequest, token);
        if (regError) {
          toast.error("Failed to register passkey", { description: regError });
        } else {
          toast.success("Passkey registered successfully");
          fetchPasskeys();
        }
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        toast.error("Error registering passkey", { description: err.message });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleAvatarSelect = async (seed: string) => {
    if (!token) return;
    try {
      await updateMe({ avatarSeed: seed }, token);
      await refreshUser();
      setIsAvatarPickerOpen(false);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error("Failed to update avatar");
    }
  };

  // Access Token handlers
  const fetchAccessTokens = React.useCallback(async () => {
    if (!token) return;
    setIsLoadingTokens(true);
    try {
      const { data } = await listAccessTokens(token, tokenPage, tokenPageSize);
      if (data) {
        setAccessTokens(data.items);
        setTokenTotal(data.total);
      }
    } catch {
      toast.error("Failed to load access tokens");
    } finally {
      setIsLoadingTokens(false);
    }
  }, [token, tokenPage, tokenPageSize]);

  React.useEffect(() => {
    fetchAccessTokens();
  }, [fetchAccessTokens]);

  const handleCreateToken = async () => {
    if (!token || !newTokenName.trim()) return;
    setIsCreatingToken(true);
    try {
      const expiresInDays = newTokenExpiry ? parseInt(newTokenExpiry) : null;
      const { data, error } = await createAccessToken({ name: newTokenName.trim(), expiresInDays }, token);
      if (error) {
        toast.error("Failed to create access token", { description: error });
      } else if (data) {
        setCreatedTokenValue(data.token);
        setNewTokenName('');
        setNewTokenExpiry('90');
        fetchAccessTokens();
        toast.success("Access token created");
      }
    } catch {
      toast.error("Error creating access token");
    } finally {
      setIsCreatingToken(false);
    }
  };

  const handleRevokeToken = async () => {
    if (!token || !tokenToRevoke) return;
    try {
      const { error } = await revokeAccessToken(tokenToRevoke.id, token);
      if (error) {
        toast.error("Failed to revoke token", { description: error });
      } else {
        toast.success("Access token revoked");
        setIsRevokeTokenDialogOpen(false);
        setTokenToRevoke(null);
        fetchAccessTokens();
      }
    } catch {
      toast.error("Error revoking token");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // API Client handlers
  const fetchApiClients = React.useCallback(async () => {
    if (!token) return;
    setIsLoadingClients(true);
    try {
      const { data } = await listApiClients(token, clientPage, clientPageSize);
      if (data) {
        setApiClients(data.items);
        setClientTotal(data.total);
      }
    } catch {
      toast.error("Failed to load API clients");
    } finally {
      setIsLoadingClients(false);
    }
  }, [token, clientPage, clientPageSize]);

  React.useEffect(() => {
    fetchApiClients();
  }, [fetchApiClients]);

  const handleCreateClient = async () => {
    if (!token || !newClientName.trim() || !newClientRedirectUri.trim()) return;
    setIsCreatingClient(true);
    try {
      const { data, error } = await createApiClient(
        { name: newClientName.trim(), redirectUri: newClientRedirectUri.trim() },
        token
      );
      if (error) {
        toast.error("Failed to create API client", { description: error });
      } else if (data) {
        setCreatedClient(data);
        setNewClientName('');
        setNewClientRedirectUri('');
        fetchApiClients();
        toast.success("API client created");
      }
    } catch {
      toast.error("Error creating API client");
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleRevokeClient = async () => {
    if (!token || !clientToRevoke) return;
    try {
      const { error } = await revokeApiClient(clientToRevoke.clientId, token);
      if (error) {
        toast.error("Failed to revoke API client", { description: error });
      } else {
        toast.success("API client revoked");
        setIsRevokeClientDialogOpen(false);
        setClientToRevoke(null);
        fetchApiClients();
      }
    } catch {
      toast.error("Error revoking API client");
    }
  };

  if (!user) return null;

  return (
    <div className="w-full space-y-8 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings, security preferences, and MCP configuration.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList variant="line" className="mb-6 w-full justify-start gap-8 border-b-2 bg-transparent rounded-none px-0 pb-0">
          <TabsTrigger 
            value="profile" 
            className="pb-3 pt-2 text-base font-semibold data-active:after:bg-primary cursor-pointer"
          >
            <UserIcon className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="pb-3 pt-2 text-base font-semibold data-active:after:bg-primary cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger 
            value="mcp" 
            className="pb-3 pt-2 text-base font-semibold data-active:after:bg-primary cursor-pointer"
          >
            <Zap className="w-4 h-4 mr-2" />
            MCP
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-0 outline-none">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-1 space-y-6">
              <Card className="border-muted-foreground/10 shadow-lg overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-primary/20 to-primary/5" />
                <CardContent className="pt-0 -mt-12 text-center">
                  <div className="relative inline-block group cursor-pointer" onClick={() => setIsAvatarPickerOpen(true)}>
                    <Avatar className="h-24 w-24 border-4 border-background shadow-xl" size="xl" emoji={user.avatarEmoji}>
                      {!user.avatarEmoji && (
                        <>
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                          <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">{user.name[0]}</AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg border-2 border-background">
                      <Camera className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                      <Shield className="w-3 h-3" />
                      {user.role === 'Admin' ? 'Administrator' : 'Team Member'}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t border-muted-foreground/5 py-4 flex flex-col gap-2">
                    <div className="w-full flex justify-between text-xs">
                        <span className="text-muted-foreground">User ID</span>
                        <span className="font-mono text-xs text-muted-foreground/60">{user.id}</span>
                    </div>
                </CardFooter>
              </Card>

              <Card className="border-muted-foreground/10 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Account Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Verified Email</p>
                      <p className="text-xs text-muted-foreground">Your email address is verified.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Passkeys Enabled</p>
                      <p className="text-xs text-muted-foreground">{passkeys.length} passkeys registered.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2">
              <Card className="border-muted-foreground/10 shadow-md">
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Update your personal information and display name.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Display Name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            id="name" 
                            placeholder="Your full name" 
                            className="pl-10 h-11 bg-muted/20 border-muted-foreground/10" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            id="email" 
                            type="email" 
                            value={user.email} 
                            disabled 
                            className="pl-10 h-11 bg-muted/50 border-muted-foreground/10 text-muted-foreground cursor-not-allowed" 
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Email cannot be changed directly. Contact an administrator.</p>
                    </div>
                    <div className="pt-2">
                      <Button type="submit" disabled={isSaving || name === user.name} className="gap-2 h-11 px-8 rounded-xl shadow-lg shadow-primary/20">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-0 outline-none">
          <Card className="border-muted-foreground/10 shadow-md">
            <CardHeader>
              <CardTitle>Security & Passkeys</CardTitle>
              <CardDescription>Add a layer of security using biometric authentication.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Registered Passkeys</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-2 rounded-lg border-primary/20 text-primary hover:bg-primary/5"
                    onClick={addPasskey}
                    disabled={isRegistering}
                  >
                    {isRegistering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add Passkey
                  </Button>
                </div>

                <div className="space-y-3">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                    </div>
                  ) : passkeys.length === 0 ? (
                    <div className="text-center py-8 bg-muted/20 border border-dashed rounded-2xl">
                        <p className="text-xs text-muted-foreground">No passkeys registered yet.</p>
                    </div>
                  ) : passkeys.map((pk) => (
                    <div key={pk.id} className="flex items-center justify-between p-4 bg-muted/20 border border-muted-foreground/5 rounded-3xl group transition-all hover:bg-muted/40">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-background border border-muted-foreground/10 flex items-center justify-center text-primary shadow-sm">
                          {pk.type === 'mobile' ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{pk.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{pk.device}</span>
                            <span className="text-xs text-muted-foreground/30">•</span>
                            <span className="text-xs text-muted-foreground">Used: {pk.lastUsed}</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => openDeleteDialog(pk)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-muted-foreground/5" />

              <form onSubmit={handleUpdatePassword} className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-foreground">Change Password</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input 
                        id="new-password" 
                        type="password" 
                        autoComplete="new-password"
                        className="h-11 bg-muted/20 border-muted-foreground/10" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input 
                        id="confirm-password" 
                        type="password" 
                        autoComplete="new-password"
                        className="h-11 bg-muted/20 border-muted-foreground/10" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <Button 
                      type="submit" 
                      variant="outline" 
                      disabled={isChangingPassword || !newPassword || newPassword !== confirmPassword}
                      className="h-11 px-8 rounded-xl font-bold"
                  >
                    {isChangingPassword && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Update Password
                  </Button>

                  {user.hasPassword && (
                    <Button 
                        type="button"
                        variant="ghost" 
                        onClick={() => setIsDeletePasswordDialogOpen(true)}
                        className="h-11 px-4 text-destructive hover:bg-destructive/10 rounded-xl font-medium"
                    >
                      Delete Password
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MCP Tab */}
        <TabsContent value="mcp" className="mt-0 outline-none space-y-8">
          <Card className="border-muted-foreground/10 shadow-lg overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Model Context Protocol (MCP)</CardTitle>
                  <CardDescription>An open standard for secure AI-to-tool communication.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pb-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Info className="w-4 h-4 text-primary" />
                    What is MCP?
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    MCP is an open standard that allows AI models (like Claude) to securely interact with your data and tools. 
                    Pilot Banana acts as an <strong>MCP Server</strong>, providing your personal AI assistant with the context it needs to help you better.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Whether you're using a web interface, a desktop app, or a CLI, MCP ensures that your AI "knows" what you're working on.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Globe className="w-4 h-4 text-primary" />
                    Compatible Clients
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-muted-foreground/5 transition-colors hover:bg-muted/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-sm font-medium">Claude Web (via Connectors)</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-muted-foreground/5 transition-colors hover:bg-muted/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-sm font-medium">Claude Desktop</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-muted-foreground/5 transition-colors hover:bg-muted/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-sm font-medium">Claude Code (CLI)</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-muted-foreground/5 transition-colors hover:bg-muted/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-sm font-medium">Codex, Windsurf & JetBrains</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="opacity-50" />

              <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Quick Start Guide
                </h4>
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-muted-foreground/20">
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center text-xs font-bold">1</div>
                    <h5 className="text-xs font-bold">Choose Connection Method</h5>
                    <p className="text-xs text-muted-foreground">Use <strong>OAuth (Recommended)</strong> for the easiest setup with Claude Web, or <strong>Access Tokens</strong> for manual configuration.</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center text-xs font-bold">2</div>
                    <h5 className="text-xs font-bold">Copy Config Snippets</h5>
                    <p className="text-xs text-muted-foreground">Find the configuration below for your specific client (Desktop or Web).</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center text-xs font-bold">3</div>
                    <h5 className="text-xs font-bold">Authorize AI Access</h5>
                    <p className="text-xs text-muted-foreground">Log in when prompted to securely grant permission to your AI assistant.</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t border-muted-foreground/5 py-3">
              <a 
                href="https://modelcontextprotocol.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
              >
                <HelpCircle className="w-3 h-3" />
                Learn more about the MCP standard
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </CardFooter>
          </Card>
          <Card className="border-muted-foreground/10 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>OAuth Clients</CardTitle>
                <CardDescription>Manage OAuth 2.1 clients for Claude Desktop or Claude Code. Recommended for strongest security.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5 shadow-sm"
                onClick={() => { setCreatedClient(null); setIsCreateClientDialogOpen(true); }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Client
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-2xl border border-muted-foreground/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <Zap className="w-3 h-3" />
                  Claude Configuration (Full OAuth)
                </h4>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Add the entry below to your config file. Claude will automatically prompt you to authorize this account in the browser.
                </p>
                <div className="bg-background/50 p-3 rounded-xl border border-muted-foreground/5 overflow-x-auto">
                    <pre className="text-xs font-mono text-muted-foreground leading-relaxed">
{`{
  "mcpServers": {
    "pilot-banana": {
      "url": "${(import.meta as any).env?.VITE_API_URL || 'http://localhost:7071'}/api/mcp"
    }
  }
}`}
                    </pre>
                </div>
              </div>

              <div className="space-y-3">
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                  </div>
                ) : apiClients.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 border border-dashed rounded-2xl">
                    <p className="text-xs text-muted-foreground">No OAuth clients created yet.</p>
                  </div>
                ) : apiClients.map((ac) => (
                  <div key={ac.clientId} className="flex items-center justify-between p-4 bg-muted/20 border border-muted-foreground/5 rounded-3xl group transition-all hover:bg-muted/40">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-background border border-muted-foreground/10 flex items-center justify-center text-primary shadow-sm">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{ac.name}</p>
                          {ac.isRevoked && <Badge variant="destructive" className="text-xs px-1.5 py-0">Revoked</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-muted-foreground">{ac.clientId}</span>
                          <span className="text-xs text-muted-foreground/30">|</span>
                          <span className="text-xs text-muted-foreground">Created: {new Date(ac.createdAt).toLocaleDateString()}</span>
                          {ac.lastUsedAt && (
                            <>
                              <span className="text-xs text-muted-foreground/30">|</span>
                              <span className="text-xs text-muted-foreground">Last used: {new Date(ac.lastUsedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">Redirect:</span>
                          <span className="text-xs font-mono text-muted-foreground">{ac.redirectUri}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-full transition-all",
                        ac.isRevoked 
                          ? "text-destructive bg-destructive/5 hover:bg-destructive/10 opacity-100" 
                          : "text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                      )}
                      onClick={() => { setClientToRevoke(ac); setIsRevokeClientDialogOpen(true); }}
                      title={ac.isRevoked ? "Permanently Delete" : "Revoke Client"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* OAuth Client Pagination */}
              {clientTotal > clientPageSize && (
                <div className="flex items-center justify-between pt-4 px-2">
                  <p className="text-xs text-muted-foreground">
                    Showing <span className="font-bold">{(clientPage - 1) * clientPageSize + 1}</span> to <span className="font-bold">{Math.min(clientPage * clientPageSize, clientTotal)}</span> of <span className="font-bold">{clientTotal}</span> clients
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg" 
                      disabled={clientPage === 1}
                      onClick={() => setClientPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg" 
                      disabled={clientPage * clientPageSize >= clientTotal}
                      onClick={() => setClientPage(p => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-muted-foreground/10 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Access Tokens</CardTitle>
                <CardDescription>Create personal access tokens for manual MCP configuration. Tokens are shown only once.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5 shadow-sm"
                onClick={() => { setCreatedTokenValue(null); setIsCreateTokenDialogOpen(true); }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Token
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-2xl border border-muted-foreground/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <Monitor className="w-3 h-3" />
                  Claude Desktop Configuration (Manual)
                </h4>
                <div className="bg-background/50 p-3 rounded-xl border border-muted-foreground/5 overflow-x-auto">
                    <pre className="text-xs font-mono text-muted-foreground leading-relaxed">
{`{
  "mcpServers": {
    "pilot-banana": {
      "url": "${(import.meta as any).env?.VITE_API_URL || 'http://localhost:7071'}/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}`}
                    </pre>
                </div>
              </div>

              <div className="space-y-3">
                {isLoadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                  </div>
                ) : accessTokens.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 border border-dashed rounded-2xl">
                    <p className="text-xs text-muted-foreground">No access tokens created yet.</p>
                  </div>
                ) : accessTokens.map((at) => (
                  <div key={at.id} className="flex items-center justify-between p-4 bg-muted/20 border border-muted-foreground/5 rounded-3xl group transition-all hover:bg-muted/40">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-background border border-muted-foreground/10 flex items-center justify-center text-primary shadow-sm">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{at.name}</p>
                          {at.isRevoked && <Badge variant="destructive" className="text-xs px-1.5 py-0">Revoked</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-muted-foreground">{at.prefix}...</span>
                          <span className="text-xs text-muted-foreground/30">|</span>
                          <span className="text-xs text-muted-foreground">Created: {new Date(at.createdAt).toLocaleDateString()}</span>
                          {at.expiresAt && (
                            <>
                              <span className="text-xs text-muted-foreground/30">|</span>
                              <span className="text-xs text-muted-foreground">Expires: {new Date(at.expiresAt).toLocaleDateString()}</span>
                            </>
                          )}
                          {at.lastUsedAt && (
                            <>
                              <span className="text-xs text-muted-foreground/30">|</span>
                              <span className="text-xs text-muted-foreground">Last used: {new Date(at.lastUsedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-full transition-all",
                        at.isRevoked 
                          ? "text-destructive bg-destructive/5 hover:bg-destructive/10 opacity-100" 
                          : "text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                      )}
                      onClick={() => { setTokenToRevoke(at); setIsRevokeTokenDialogOpen(true); }}
                      title={at.isRevoked ? "Permanently Delete" : "Revoke Token"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Access Token Pagination */}
              {tokenTotal > tokenPageSize && (
                <div className="flex items-center justify-between pt-4 px-2">
                  <p className="text-xs text-muted-foreground">
                    Showing <span className="font-bold">{(tokenPage - 1) * tokenPageSize + 1}</span> to <span className="font-bold">{Math.min(tokenPage * tokenPageSize, tokenTotal)}</span> of <span className="font-bold">{tokenTotal}</span> tokens
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg" 
                      disabled={tokenPage === 1}
                      onClick={() => setTokenPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg" 
                      disabled={tokenPage * tokenPageSize >= tokenTotal}
                      onClick={() => setTokenPage(p => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Passkey</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the passkey <strong>{passkeyToDelete?.name}</strong> ({passkeyToDelete?.device})? You won't be able to use it to sign in anymore.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={removePasskey}>
              Remove Passkey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeletePasswordDialogOpen} onOpenChange={setIsDeletePasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Password</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your password? You will only be able to sign in using your passkeys.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletePasswordDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePassword} disabled={isDeletingPassword}>
              {isDeletingPassword && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAvatarPickerOpen} onOpenChange={setIsAvatarPickerOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Choose your avatar</DialogTitle>
          </DialogHeader>
          <AvatarPicker onSelect={handleAvatarSelect} selectedSeed={user.avatarSeed} />
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTokenDialogOpen} onOpenChange={(open) => { if (!open) { setCreatedTokenValue(null); } setIsCreateTokenDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdTokenValue ? 'Token Created' : 'Create Access Token'}</DialogTitle>
            <DialogDescription>
              {createdTokenValue
                ? 'Copy your token now. It will not be shown again.'
                : 'Give your token a name and optionally set an expiration.'}
            </DialogDescription>
          </DialogHeader>
          {createdTokenValue ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted/40 border rounded-xl">
                <code className="text-xs font-mono flex-1 break-all select-all">{createdTokenValue}</code>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(createdTokenValue)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsCreateTokenDialogOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-name">Token Name</Label>
                <Input
                  id="token-name"
                  placeholder="e.g. CI/CD Pipeline"
                  className="h-11 bg-muted/20 border-muted-foreground/10"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token-expiry">Expiration (days)</Label>
                <Input
                  id="token-expiry"
                  type="number"
                  min="1"
                  placeholder="Leave empty for no expiration"
                  className="h-11 bg-muted/20 border-muted-foreground/10"
                  value={newTokenExpiry}
                  onChange={(e) => setNewTokenExpiry(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave empty for a token that never expires.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateTokenDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateToken} disabled={isCreatingToken || !newTokenName.trim()}>
                  {isCreatingToken && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Create Token
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRevokeTokenDialogOpen} onOpenChange={setIsRevokeTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tokenToRevoke?.isRevoked ? 'Delete Access Token' : 'Revoke Access Token'}</DialogTitle>
            <DialogDescription>
              {tokenToRevoke?.isRevoked 
                ? <>Are you sure you want to permanently delete <strong>{tokenToRevoke?.name}</strong>? This action is irreversible.</>
                : <>Are you sure you want to revoke <strong>{tokenToRevoke?.name}</strong>? Any applications using this token will lose access immediately.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevokeTokenDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevokeToken}>
              {tokenToRevoke?.isRevoked ? 'Delete Permanently' : 'Revoke Token'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRevokeClientDialogOpen} onOpenChange={setIsRevokeClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{clientToRevoke?.isRevoked ? 'Delete OAuth Client' : 'Revoke OAuth Client'}</DialogTitle>
            <DialogDescription>
              {clientToRevoke?.isRevoked 
                ? <>Are you sure you want to permanently delete the client <strong>{clientToRevoke?.name}</strong>? This will invalidate all secrets and tokens associated with it. This action is irreversible.</>
                : <>Are you sure you want to revoke <strong>{clientToRevoke?.name}</strong>? This will invalidate the client credentials and any OAuth tokens issued through it.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevokeClientDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevokeClient}>
              {clientToRevoke?.isRevoked ? 'Delete Permanently' : 'Revoke Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
