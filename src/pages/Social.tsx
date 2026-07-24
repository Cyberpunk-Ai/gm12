import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Search, PlusSquare, User, MessageCircle, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StoriesBar } from '@/components/social/stories-bar';
import { Feed } from '@/components/social/feed';
import { CreatePost } from '@/components/social/create-post';
import { ExploreGrid } from '@/components/social/explore-grid';
import { UserSearch } from '@/components/social/user-search';
import { SocialProfileView } from '@/components/social/profile-view';
import { MoreMenu } from '@/components/social/more-menu';

type Tab = 'home' | 'search' | 'create' | 'profile' | 'more';

export default function Social() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('home');

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'create', icon: PlusSquare, label: 'Create' },
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'more', icon: Menu, label: 'More' },
  ];

  if (!user) {
    return (
      <div className="text-center py-16">
        <h2 className="font-display text-2xl font-bold mb-2">Join the Community</h2>
        <p className="text-muted-foreground mb-4">Sign in to see posts, share stories and message friends</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold">GameFlex</h1>
        <Link to="/messages">
          <Button variant="ghost" size="icon"><MessageCircle className="h-6 w-6" /></Button>
        </Link>
      </div>

      {tab === 'home' && (
        <div className="max-w-[500px] mx-auto">
          <StoriesBar />
          <Feed scope="home" />
        </div>
      )}
      {tab === 'search' && (
        <div className="max-w-3xl mx-auto space-y-4">
          <UserSearch />
          <ExploreGrid />
        </div>
      )}
      {tab === 'create' && (
        <div className="max-w-[600px] mx-auto">
          <CreatePost onCreated={() => setTab('home')} />
        </div>
      )}
      {tab === 'profile' && <SocialProfileView />}
      {tab === 'more' && <MoreMenu />}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-card/95 backdrop-blur border-t border-border z-40">
        <div className="flex justify-around items-center h-14">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex flex-col items-center gap-0.5 px-3 py-1', tab === t.id ? 'text-foreground' : 'text-muted-foreground')}>
              <t.icon className={cn('h-6 w-6', tab === t.id && 'stroke-[2.5]')} />
            </button>
          ))}
        </div>
      </nav>

      {/* Desktop pill nav */}
      <div className="hidden md:flex fixed top-24 left-4 flex-col gap-2 z-30">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition', tab === t.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50')}>
            <t.icon className="h-5 w-5" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
