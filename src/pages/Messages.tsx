import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus } from 'lucide-react';
import { ConversationList } from '@/components/messaging/conversation-list';
import { ChatWindow } from '@/components/messaging/chat-window';
import { NewConversationModal } from '@/components/messaging/new-conversation-modal';
import { cn } from '@/lib/utils';

export default function Messages() {
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const handleSelectConversation = (conversationId: string, otherUser: any) => {
    setSelectedConversationId(conversationId);
    setSelectedUser(otherUser);
    setShowMobileChat(true);
  };

  const handleNewConversation = (conversationId: string, otherUser: any) => {
    setSelectedConversationId(conversationId);
    setSelectedUser(otherUser);
    setShowMobileChat(true);
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Sign in to message</h2>
        <p className="text-muted-foreground mb-4">Connect with other players securely</p>
        <Link to="/auth">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold">Messages</h1>
        <Button onClick={() => setShowNewConversation(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden h-[calc(100vh-280px)]">
        <div className="flex h-full">
          {/* Conversation List */}
          <div
            className={cn(
              "w-full md:w-80 border-r border-border/50 flex-shrink-0",
              showMobileChat && "hidden md:block"
            )}
          >
            <ConversationList
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
            />
          </div>

          {/* Chat Window */}
          <div
            className={cn(
              "flex-1 flex flex-col",
              !showMobileChat && "hidden md:flex"
            )}
          >
            {selectedConversationId && selectedUser ? (
              <ChatWindow
                conversationId={selectedConversationId}
                otherUser={selectedUser}
                onBack={() => setShowMobileChat(false)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Or start a new chat to begin messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <NewConversationModal
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onConversationCreated={handleNewConversation}
      />
    </div>
  );
}
