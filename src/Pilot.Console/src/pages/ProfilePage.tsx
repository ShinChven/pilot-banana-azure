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
  Pencil
} from 'lucide-react';
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

export default function ProfilePage() {
  const { user, token, refreshUser, logout } = useAuth();
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
        challenge: base64urlToUint8Array(options.challenge as unknown as string),
        user: {
          ...options.user,
          id: base64urlToUint8Array(options.user.id as unknown as string)
        }
      };

      const credential = await navigator.credentials.create({
        publicKey: credentialOptions
      }) as any;

      if (credential) {
        const registrationResponse = {
          id: credential.id,
          rawId: arrayBufferToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            attestationObject: arrayBufferToBase64Url(credential.response.attestationObject),
            clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON)
          }
        };

        const { error: regError } = await registerPasskey(registrationResponse, token);
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

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
          <p className="text-muted-foreground">Manage your account settings and security preferences.</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Left Column: Avatar & Basic Info */}
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
                    <span className="font-mono text-[10px] text-muted-foreground/60">{user.id}</span>
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
                  <p className="text-[10px] text-muted-foreground">Your email address is verified.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Passkeys Enabled</p>
                  <p className="text-[10px] text-muted-foreground">{passkeys.length} passkeys registered.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Forms & Settings */}
        <div className="md:col-span-2 space-y-8">
          {/* General Settings */}
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
                  <p className="text-[10px] text-muted-foreground">Email cannot be changed directly. Contact an administrator.</p>
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

          {/* Security & Passkeys */}
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
                    <div key={pk.id} className="flex items-center justify-between p-4 bg-muted/20 border border-muted-foreground/5 rounded-2xl group transition-all hover:bg-muted/40">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-background border border-muted-foreground/10 flex items-center justify-center text-primary shadow-sm">
                          {pk.type === 'mobile' ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{pk.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{pk.device}</span>
                            <span className="text-[10px] text-muted-foreground/30">•</span>
                            <span className="text-[10px] text-muted-foreground">Used: {pk.lastUsed}</span>
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
        </div>
      </div>

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
    </div>
  );
}
