// This file previously contained mock data but has been deprecated.
// All data is now fetched from the Supabase database.
// Keeping this file for type reference only.

import { 
  Tournament, 
  Registration, 
  Payment, 
  Match,
  LeaderboardEntry,
  MarketplaceListing,
  SupportTicket,
  Notification,
  DashboardStats,
  GameRoom,
  Reward,
  User 
} from '@/types';

// Empty arrays - all data comes from Supabase
export const mockTournaments: Tournament[] = [];
export const mockRegistrations: Registration[] = [];
export const mockPayments: Payment[] = [];
export const mockMatches: Match[] = [];
export const mockLeaderboard: LeaderboardEntry[] = [];
export const mockGameRooms: GameRoom[] = [];
export const mockRewards: Reward[] = [];
export const mockMarketplaceListings: MarketplaceListing[] = [];
export const mockSupportTickets: SupportTicket[] = [];
export const mockNotifications: Notification[] = [];
export const mockAllUsers: User[] = [];

export const mockDashboardStats: DashboardStats = {
  totalUsers: 0,
  totalTournaments: 0,
  activeTournaments: 0,
  pendingPayments: 0,
  totalRevenue: 0,
  todayRevenue: 0,
  newUsersToday: 0,
  liveTournaments: 0,
};
