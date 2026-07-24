import { Link } from 'react-router-dom';
import { Bookmark, Activity, Settings2, Bell, Shield, HelpCircle, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

const items = [
  { icon: Settings2, label: 'Settings', to: '/settings' },
  { icon: Bookmark, label: 'Saved', to: '/social?tab=profile&sub=saved' },
  { icon: Activity, label: 'Your activity', to: '/dashboard' },
  { icon: Bell, label: 'Notifications', to: '/notifications' },
  { icon: Shield, label: 'Privacy', to: '/privacy' },
  { icon: HelpCircle, label: 'Help', to: '/support' },
];

export function MoreMenu() {
  const { logout } = useAuth();
  return (
    <div className="max-w-md mx-auto space-y-3">
      <Card className="divide-y divide-border/60">
        {items.map((it) => (
          <Link key={it.label} to={it.to} className="flex items-center gap-3 p-4 hover:bg-secondary/40">
            <it.icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{it.label}</span>
          </Link>
        ))}
      </Card>
      <Button variant="ghost" className="w-full text-destructive" onClick={() => logout()}>
        <LogOut className="h-4 w-4 mr-2" /> Log out
      </Button>
    </div>
  );
}
