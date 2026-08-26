import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const Navbar = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [showSignOutPrompt, setShowSignOutPrompt] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!user) return null;

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between mx-auto px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            PSU SportsTrack
          </Link>

          {profile?.role === 'Admin' && (
            <Link 
              to="/admin/tournaments" 
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Tournaments
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground mr-2">
            <UserIcon className="size-4" />
            <span>{profile?.full_name || user.email}</span>
          </div>
          
          <Badge variant="secondary" className="font-semibold px-3 py-1">
            {profile?.role || 'User'}
          </Badge>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSignOutPrompt(true)}
            className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>

      <Dialog open={showSignOutPrompt} onOpenChange={setShowSignOutPrompt}>
        <DialogContent className="max-w-sm rounded-[2rem] p-8 border-slate-100 dark:border-white/5">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
              Sign <span className="text-orange-500">Out</span>
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-2">
              Are you sure you want to sign out of PSU SportsTrack?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-4">
            <Button variant="ghost" onClick={() => setShowSignOutPrompt(false)} className="h-12 rounded-2xl font-black uppercase tracking-widest text-xs">
              Cancel
            </Button>
            <Button 
              className="h-12 flex-1 bg-destructive hover:bg-destructive/90 text-white rounded-2xl font-black uppercase italic tracking-[0.1em]"
              onClick={() => {
                setShowSignOutPrompt(false);
                handleSignOut();
              }}
            >
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
};
