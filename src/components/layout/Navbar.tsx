import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const Navbar = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
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
            onClick={handleSignOut}
            className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </nav>
  );
};
