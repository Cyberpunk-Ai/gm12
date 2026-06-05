import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string, otherUser: any) => void;
}

export function NewConversationModal({ open, onOpenChange, onConversationCreated }: NewConversationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['searchable-users', searchTerm],
    queryFn: async () => {
      if (!searchTerm || !user) return [];
      
      const { data } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .neq('user_id', user.id)
        .ilike('username', `%${searchTerm}%`)
        .limit(10);
      
      return data ?? [];
    },
    enabled: searchTerm.length >= 2
  });

  const createConversationMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${otherUserId}),and(participant1_id.eq.${otherUserId},participant2_id.eq.${user.id})`)
        .single();
      
      if (existing) {
        return { id: existing.id, isNew: false };
      }
      
      // Create new conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          participant1_id: user.id,
          participant2_id: otherUserId
        })
        .select()
        .single();
      
      if (error) throw error;
      return { id: data.id, isNew: true };
    },
    onSuccess: (result, otherUserId) => {
      const otherUser = users.find(u => u.user_id === otherUserId);
      onConversationCreated(result.id, otherUser);
      onOpenChange(false);
      setSearchTerm('');
      
      if (result.isNew) {
        toast({
          title: 'Conversation created',
          description: `You can now chat with ${otherUser?.username}`
        });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create conversation',
        variant: 'destructive'
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            New Conversation
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Searching...</div>
            ) : users.length === 0 && searchTerm.length >= 2 ? (
              <div className="text-center py-4 text-muted-foreground">No users found</div>
            ) : searchTerm.length < 2 ? (
              <div className="text-center py-4 text-muted-foreground">Type at least 2 characters to search</div>
            ) : (
              users.map(u => (
                <Button
                  key={u.user_id}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => createConversationMutation.mutate(u.user_id)}
                  disabled={createConversationMutation.isPending}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback>{u.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{u.username}</span>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
