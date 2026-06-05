import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { Layout } from "@/components/layout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Tournaments from "./pages/Tournaments";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Refund from "./pages/Refund";
import FairPlay from "./pages/FairPlay";
import Contact from "./pages/Contact";
import Report from "./pages/Report";
import HowItWorks from "./pages/HowItWorks";
import TournamentDetail from "./pages/TournamentDetail";
import Leaderboard from "./pages/Leaderboard";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import FAQs from "./pages/FAQs";
import Support from "./pages/Support";
import Marketplace from "./pages/Marketplace";
import GameRooms from "./pages/GameRooms";
import Rewards from "./pages/Rewards";
import MyMatches from "./pages/MyMatches";
import Wallet from "./pages/Wallet";
import Messages from "./pages/Messages";
import Social from "./pages/Social";
import Achievements from "./pages/Achievements";
import PlayerProfile from "./pages/PlayerProfile";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminTournaments from "./pages/admin/AdminTournaments";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminRegistrations from "./pages/admin/AdminRegistrations";
import AdminMatches from "./pages/admin/AdminMatches";
import AdminGameRooms from "./pages/admin/AdminGameRooms";
import AdminMarketplace from "./pages/admin/AdminMarketplace";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminAchievements from "./pages/admin/AdminAchievements";
import AdminRewards from "./pages/admin/AdminRewards";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminLeaderboard from "./pages/admin/AdminLeaderboard";
import NotFound from "./pages/NotFound";
import { usePushNotifications } from "./hooks/use-push-notifications";

// Wrapper component to use hooks
function AppContent() {
  usePushNotifications();
  return null;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournaments/:id" element={<TournamentDetail />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/player/:id" element={<PlayerProfile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/faqs" element={<FAQs />} />
              <Route path="/support" element={<Support />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/game-rooms" element={<GameRooms />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/my-matches" element={<MyMatches />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/social" element={<Social />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refund" element={<Refund />} />
              <Route path="/fair-play" element={<FairPlay />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/report" element={<Report />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
            </Route>
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="tournaments" element={<AdminTournaments />} />
              <Route path="registrations" element={<AdminRegistrations />} />
              <Route path="matches" element={<AdminMatches />} />
              <Route path="game-rooms" element={<AdminGameRooms />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="achievements" element={<AdminAchievements />} />
              <Route path="rewards" element={<AdminRewards />} />
              <Route path="leaderboard" element={<AdminLeaderboard />} />
              <Route path="marketplace" element={<AdminMarketplace />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="roles" element={<AdminRoles />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
