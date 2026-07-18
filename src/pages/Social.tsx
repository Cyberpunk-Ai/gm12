import { useAuth } from '@/lib/auth-context';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Users, TrendingUp } from 'lucide-react';
import { CreateStatus } from '@/components/status/create-status';
import { StatusFeed } from '@/components/status/status-feed';

export default function Social() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Social Hub</h1>
          <p className="text-muted-foreground">Share what's hype with the community</p>
        </div>
      </div>

      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="feed" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="trending" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending
          </TabsTrigger>
          <TabsTrigger value="following" className="gap-2">
            <Users className="h-4 w-4" />
            Following
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          {user ? (
            <>
              <CreateStatus />
              <StatusFeed />
            </>
          ) : (
            <div className="text-center py-12">
              <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Join the Community</h2>
              <p className="text-muted-foreground mb-4">
                Sign in to post status updates and interact with other players
              </p>
              <Link to="/auth">
                <Button>Sign In</Button>
              </Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trending">
          <StatusFeed />
        </TabsContent>

        <TabsContent value="following">
          {user ? (
            <StatusFeed />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Sign in to see posts from people you follow</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
