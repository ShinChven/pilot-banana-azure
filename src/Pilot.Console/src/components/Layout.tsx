import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  LogOut,
  Menu,
  ChevronRight,
  ChevronLeft,
  Search,
  Briefcase,
  Share2,
  Layers,
  Terminal,
  History,
  Sparkles,
  Calendar
} from 'lucide-react';
import { BananaLogo } from './BananaLogo';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { ThemeSwitcher } from '@/src/components/ThemeSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/src/components/ui/dropdown-menu';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/src/components/ui/dialog';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/src/components/ui/tooltip';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/src/components/ui/sheet';
import { useAuth } from '../context/AuthContext';
import { useAccent } from '../context/ThemeContext';

const sidebarItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Campaigns', icon: Layers, path: '/campaigns' },
  { name: 'Scheduled', icon: Calendar, path: '/scheduled-posts' },
  { name: 'Channels', icon: Share2, path: '/channels' },
  { name: 'Prompts', icon: Terminal, path: '/prompts' },
  { name: 'AI Tasks', icon: Sparkles, path: '/ai-tasks' },
  { name: 'History', icon: History, path: '/history', adminOnly: true },
  { name: 'Users', icon: Users, path: '/users', adminOnly: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { glassEnabled, transparencyEnabled, flickerEnabled } = useAccent();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = React.useState(false);

  const filteredSidebarItems = sidebarItems.filter(item => !item.adminOnly || user?.role === 'Admin');

  const handleLogoutClick = () => {
    setIsLogoutDialogOpen(true);
  };

  const performLogout = () => {
    logout();
    navigate('/login');
    setIsLogoutDialogOpen(false);
  };

  const userInitials = user?.email?.substring(0, 2).toUpperCase() || 'US';

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Background Blobs for Glassmorphism */}
      {flickerEnabled && (
        <>
          <div className="absolute top-[-5%] left-[-5%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse z-0" />
          <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-chart-1/20 rounded-full blur-[120px] pointer-events-none animate-pulse delay-700 z-0" />
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-chart-2/10 rounded-full blur-[100px] pointer-events-none animate-pulse delay-1000 z-0" />
        </>
      )}

      {/* Mobile Sidebar */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent 
          side="left" 
          className={cn(
            "p-0 w-72 border-r",
            transparencyEnabled ? "bg-background/60" : "bg-background",
            glassEnabled && "backdrop-blur-2xl"
          )}
        >
          <div className="flex flex-col h-full">
            <div className="h-16 flex items-center border-b px-6">
              <div className="flex items-center gap-3">
                <BananaLogo className="w-9 h-9" />
                <span className="text-xl font-bold tracking-tight text-foreground">Pilot Banana</span>
              </div>
            </div>

            <nav className="flex-1 py-6 px-4 space-y-2">
              {filteredSidebarItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    location.pathname === item.path
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sidebar - Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col border-r transition-all duration-300 ease-in-out relative z-30",
        isCollapsed ? "w-20" : "w-64",
        transparencyEnabled ? "bg-background/30" : "bg-background",
        glassEnabled && "backdrop-blur-2xl"
      )}>
        <div className={cn(
          "h-16 flex items-center border-b px-4",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <BananaLogo className="w-9 h-9 shrink-0" />
            {!isCollapsed && <span className="text-xl font-bold tracking-tight whitespace-nowrap text-foreground">Pilot Banana</span>}
          </div>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>

        {isCollapsed && (
          <div className="flex justify-center py-4 border-b">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:text-foreground rounded-xl bg-accent/20"
              onClick={() => setIsCollapsed(false)}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        <nav className={cn(
          "flex-1 py-6 space-y-4 flex flex-col",
          isCollapsed ? "items-center" : "px-4"
        )}>
          {filteredSidebarItems.map((item) => (
            <div key={item.path} className={cn(isCollapsed ? "w-full flex justify-center" : "w-full")}>
              <Tooltip>
                <TooltipTrigger render={(props) => (
                  <Link
                    {...props}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
                      isCollapsed ? "h-12 w-12 justify-center p-0" : "px-3 py-2.5",
                      location.pathname === item.path
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className={cn("shrink-0", isCollapsed ? "w-6 h-6" : "w-4 h-4")} />
                    {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                  </Link>
                )} />
                {isCollapsed && (
                  <TooltipContent side="right" sideOffset={16} className="font-medium">
                    {item.name}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header - Fixed to allow content scroll behind */}
        <header className={cn(
          "absolute top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-3 sm:px-6 z-20",
          transparencyEnabled ? "bg-background/40" : "bg-background",
          glassEnabled && "backdrop-blur-2xl"
        )}>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeSwitcher />

            <DropdownMenu>
              <DropdownMenuTrigger render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8" emoji={user?.avatarEmoji}>
                    {!user?.avatarEmoji && <AvatarImage src={user?.avatarUrl} />}
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              )} />
              <DropdownMenuContent 
                className={cn(
                  "w-56",
                  transparencyEnabled ? "bg-background/80" : "bg-background",
                  glassEnabled && "backdrop-blur-xl"
                )} 
                align="end"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.role}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogoutClick} className="text-destructive focus:text-destructive">Sign out</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content - Added pt-16 to accommodate fixed header */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 pt-20 sm:pt-22 relative z-10">
          {children}
        </div>
      </main>



      {/* Logout Confirmation Dialog */}
      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Sign out</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out of your account? Any unsaved changes may be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setIsLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={performLogout}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
