import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/src/components/ui/dropdown-menu";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
  UserX,
  UserCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { User } from '@/src/types';
import { Badge } from '@/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/src/components/ui/dialog";
import { Label } from "@/src/components/ui/label";
import { useAuth } from '../context/AuthContext';
import { listUsers, createUser, updateUser, deleteUser, type UserResponse } from '../api/users';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { Switch } from "@/src/components/ui/switch";

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<User[]>([]);
  const [search, setSearch] = React.useState(searchParams.get('q') || '');
  const [isLoading, setIsLoading] = React.useState(true);

  // Pagination State from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
  const [totalItems, setTotalItems] = React.useState(0);

  // Add Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [newUser, setNewUser] = React.useState<any>({
    email: '',
    name: '',
    role: 'User',
    password: ''
  });

  // Edit Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<any>(null);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeletePasswordDialogOpen, setIsDeletePasswordDialogOpen] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);

  const updateQueryParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    setSearchParams(params);
  };

  const fetchUsers = React.useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const { data, error } = await listUsers(token, page, pageSize);
      if (error) {
        toast.error('Failed to load users', { description: error });
      } else if (data) {
        setTotalItems(data.total);
        const mapped: User[] = data.items.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            avatarSeed: u.avatarSeed || u.email,
            role: u.role as any,
            status: u.disabled ? 'Inactive' : 'Active',
            lastActive: new Date(u.createdAt).toLocaleDateString(),
            hasPassword: u.hasPassword,
            passkeyCount: u.passkeyCount
          }));
        setUsers(mapped);
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  }, [token, page, pageSize]);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const totalPages = Math.ceil(totalItems / pageSize);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!token || !userToDelete) return;
    const id = userToDelete.id;
    if (id === currentUser?.id) {
        toast.error("You cannot delete yourself");
        return;
    }
    try {
      const { error } = await deleteUser(id, token);
      if (error) {
        toast.error('Failed to delete user', { description: error });
      } else {
        setUsers(users.filter(u => u.id !== id));
        toast.success('User deleted');
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred' });
    }
  };

  const handleDeleteUserPassword = async () => {
    if (!token || !editingUser) return;
    try {
      const { error } = await updateUser(editingUser.id, {
        deletePassword: true
      } as any, token);

      if (error) {
        toast.error('Failed to delete password', { description: error });
      } else {
        toast.success('Password deleted successfully');
        setIsDeletePasswordDialogOpen(false);
        fetchUsers();
        // Update local editing user state
        setEditingUser({ ...editingUser, hasPassword: false });
      }
    } catch (err) {
      toast.error('Error', { description: 'An unexpected error occurred' });
    }
  };

  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleAddUser = async () => {
    if (!token) return;
    if (newUser.email) {
      try {
        const { data, error } = await createUser({
            email: newUser.email,
            name: newUser.name || newUser.email.split('@')[0],
            role: newUser.role,
            password: newUser.password || null
        }, token);

        if (error) {
            toast.error('Failed to create user', { description: error });
        } else if (data) {
            toast.success('User created');
            setIsAddDialogOpen(false);
            setNewUser({ email: '', name: '', role: 'User', password: '' });
            fetchUsers();
        }
      } catch (err) {
        toast.error('Error', { description: 'An unexpected error occurred' });
      }
    }
  };

  const handleUpdateUser = async () => {
    if (!token || !editingUser) return;
    try {
        const { error } = await updateUser(editingUser.id, {
            name: editingUser.name,
            email: editingUser.email,
            role: editingUser.role,
            disabled: editingUser.status === 'Inactive',
            password: editingUser.newPassword || null
        }, token);

        if (error) {
            toast.error('Failed to update user', { description: error });
        } else {
            toast.success('User updated');
            setIsEditDialogOpen(false);
            fetchUsers();
        }
    } catch (err) {
        toast.error('Error', { description: 'An unexpected error occurred' });
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (!token) return;
    if (user.id === currentUser?.id) {
        toast.error("You cannot deactivate yourself");
        return;
    }
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
        const { error } = await updateUser(user.id, {
            disabled: newStatus === 'Inactive'
        }, token);

        if (error) {
            toast.error('Failed to update status', { description: error });
        } else {
            toast.success(`User ${newStatus === 'Active' ? 'activated' : 'deactivated'}`);
            setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
        }
    } catch (err) {
        toast.error('Error', { description: 'An unexpected error occurred' });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser({ ...user, newPassword: '' });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
          <p className="text-muted-foreground">Manage your team members and their roles.</p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="h-10 w-full bg-card border-muted-foreground/10 pl-10 sm:w-64"
              value={search}
              onChange={e => { 
                const q = e.target.value;
                setSearch(q); 
                updateQueryParams({ q, page: 1 });
              }}
            />
          </div>

          {/* Add User Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={<Button className="h-10 w-full gap-2 sm:w-auto" />} nativeButton={true}>
              <Plus className="w-4 h-4" /> Add User
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>Enter the details of the new team member.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="add-email">Email</Label>
                  <Input id="add-email" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-name">Display Name</Label>
                  <Input id="add-name" type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-password">Password (Optional)</Label>
                  <Input id="add-password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={newUser.role === 'Admin' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setNewUser({...newUser, role: 'Admin'})}
                    >
                      Admin
                    </Button>
                    <Button
                      type="button"
                      variant={newUser.role === 'User' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setNewUser({...newUser, role: 'User'})}
                    >
                      User
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddUser}>Save User</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="outline" className="gap-2" onClick={fetchUsers}>
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {!isLoading && filteredUsers.length > 0 && (
          <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_110px_220px_120px_56px] md:items-center md:gap-4 rounded-2xl border border-muted-foreground/10 bg-muted/20 px-4 py-3 text-sm font-semibold text-muted-foreground">
            <span>User</span>
            <span>Role</span>
            <span>Status</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-3xl border border-muted-foreground/10 bg-card text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-3xl border border-muted-foreground/10 bg-card text-center text-muted-foreground">
            No users found.
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div
              key={u.id}
              className="rounded-3xl border border-muted-foreground/10 bg-card p-4 shadow-sm transition-colors hover:bg-muted/20 sm:p-5"
            >
              <div className="md:hidden">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-foreground">{u.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />} nativeButton={true}>
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem className="gap-2" onClick={() => openEditDialog(u)}>
                        <Edit2 className="w-4 h-4" /> Edit User
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleToggleStatus(u)}
                        disabled={u.id === currentUser?.id}
                      >
                        {u.status === 'Active' ? (
                          <>
                            <UserX className="w-4 h-4 text-orange-500" /> Deactivate User
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 text-emerald-500" /> Activate User
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        onClick={() => openDeleteDialog(u)}
                      >
                        <Trash2 className="w-4 h-4" /> Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Badge
                    variant={u.role === 'Admin' ? 'default' : 'outline'}
                    className={u.role === 'Admin' ? '' : 'text-muted-foreground'}
                  >
                    {u.role}
                  </Badge>
                  <Badge variant={u.status === 'Active' ? 'default' : 'secondary'} className={u.status === 'Active' ? 'bg-emerald-500' : ''}>
                    {u.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Created: {u.lastActive}</span>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-2xl border border-muted-foreground/10 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Account Status</span>
                  <Switch
                    checked={u.status === 'Active'}
                    onCheckedChange={() => handleToggleStatus(u)}
                    disabled={u.id === currentUser?.id}
                  />
                </div>
              </div>

              <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_110px_220px_120px_56px] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{u.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div>
                  <Badge
                    variant={u.role === 'Admin' ? 'default' : 'outline'}
                    className={u.role === 'Admin' ? '' : 'text-muted-foreground'}
                  >
                    {u.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={u.status === 'Active'}
                    onCheckedChange={() => handleToggleStatus(u)}
                    disabled={u.id === currentUser?.id}
                  />
                  <Badge variant={u.status === 'Active' ? 'default' : 'secondary'} className={u.status === 'Active' ? 'bg-emerald-500' : ''}>
                    {u.status}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">{u.lastActive}</span>
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />} nativeButton={true}>
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem className="gap-2" onClick={() => openEditDialog(u)}>
                        <Edit2 className="w-4 h-4" /> Edit User
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleToggleStatus(u)}
                        disabled={u.id === currentUser?.id}
                      >
                        {u.status === 'Active' ? (
                          <>
                            <UserX className="w-4 h-4 text-orange-500" /> Deactivate User
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 text-emerald-500" /> Activate User
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        onClick={() => openDeleteDialog(u)}
                      >
                        <Trash2 className="w-4 h-4" /> Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controller */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card rounded-3xl border border-muted-foreground/10 shadow-sm">
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          Showing <span className="font-semibold text-foreground">{users.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-semibold text-foreground">{(page - 1) * pageSize + users.length}</span> of <span className="font-semibold text-foreground">{totalItems}</span> members
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
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.email}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update team member information.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Display Name</Label>
                <Input
                  id="edit-name"
                  value={editingUser.name}
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email}
                  onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-password">New Password</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editingUser.newPassword}
                  onChange={e => setEditingUser({...editingUser, newPassword: e.target.value})}
                  placeholder="Leave empty to keep current"
                />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={editingUser.role === 'Admin' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditingUser({...editingUser, role: 'Admin'})}
                  >
                    Admin
                  </Button>
                  <Button
                    type="button"
                    variant={editingUser.role === 'User' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditingUser({...editingUser, role: 'User'})}
                  >
                    User
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>Account Status</Label>
                  <p className="text-xs text-muted-foreground">
                    {editingUser.status === 'Active' ? 'User can log in' : 'User access is disabled'}
                  </p>
                </div>
                <Switch
                  checked={editingUser.status === 'Active'}
                  onCheckedChange={(checked) => setEditingUser({...editingUser, status: checked ? 'Active' : 'Inactive'})}
                  disabled={editingUser.id === currentUser?.id}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {editingUser && editingUser.hasPassword && (
              <Button 
                variant="ghost" 
                className="text-destructive hover:bg-destructive/10 sm:mr-auto"
                onClick={() => setIsDeletePasswordDialogOpen(true)}
              >
                Delete Password
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateUser}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeletePasswordDialogOpen} onOpenChange={setIsDeletePasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User Password</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the password for <strong>{editingUser?.email}</strong>? 
              The user will only be able to sign in using their passkeys or if they have an external identity provider configured.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletePasswordDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUserPassword}>
              Delete Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
