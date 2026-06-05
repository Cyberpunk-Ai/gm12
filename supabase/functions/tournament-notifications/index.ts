import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  action: "tournament_starting" | "match_reminder" | "results_posted" | "registration_confirmed";
  tournamentId?: string;
  matchId?: string;
  userId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, tournamentId, matchId, userId }: NotificationRequest = await req.json();

    switch (action) {
      case "tournament_starting":
        return await handleTournamentStarting(supabase, tournamentId!);
      
      case "match_reminder":
        return await handleMatchReminder(supabase, matchId!);
      
      case "results_posted":
        return await handleResultsPosted(supabase, matchId!);
      
      case "registration_confirmed":
        return await handleRegistrationConfirmed(supabase, tournamentId!, userId!);
      
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleTournamentStarting(supabase: any, tournamentId: string) {
  // Get tournament details
  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();

  if (tError || !tournament) {
    return new Response(
      JSON.stringify({ error: "Tournament not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get all confirmed registrations with user profiles
  const { data: registrations, error: rError } = await supabase
    .from("registrations")
    .select(`
      user_id,
      profiles!inner(phone, username)
    `)
    .eq("tournament_id", tournamentId)
    .eq("status", "confirmed");

  if (rError) {
    console.error("Error fetching registrations:", rError);
    return new Response(
      JSON.stringify({ error: "Failed to fetch registrations" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const notifications = [];
  const startTime = new Date(tournament.start_date).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  for (const reg of registrations || []) {
    const phone = reg.profiles?.phone;
    if (!phone) continue;

    const message = `🎮 GAME ON! ${tournament.title} is starting!\n\n` +
      `⏰ Time: ${startTime}\n` +
      `🏆 Prize: KES ${tournament.prize_pool.toLocaleString()}\n\n` +
      `${tournament.group_link ? `📱 Join group: ${tournament.group_link}\n\n` : ""}` +
      `Good luck, ${reg.profiles.username}! 🔥`;

    // Send notification via the send-whatsapp function
    notifications.push(
      sendNotification(supabase, {
        type: "reminder",
        userId: reg.user_id,
        phone,
        message,
        tournamentId,
      })
    );
  }

  await Promise.all(notifications);

  return new Response(
    JSON.stringify({ success: true, notificationsSent: notifications.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleMatchReminder(supabase: any, matchId: string) {
  // Get match with tournament and player details
  const { data: match, error: mError } = await supabase
    .from("matches")
    .select(`
      *,
      tournament:tournaments(*),
      player1:profiles!matches_player1_id_fkey(user_id, phone, username, game_handle),
      player2:profiles!matches_player2_id_fkey(user_id, phone, username, game_handle)
    `)
    .eq("id", matchId)
    .single();

  if (mError || !match) {
    // Fallback: get match without joins
    const { data: basicMatch, error: basicError } = await supabase
      .from("matches")
      .select("*, tournament:tournaments(*)")
      .eq("id", matchId)
      .single();

    if (basicError || !basicMatch) {
      return new Response(
        JSON.stringify({ error: "Match not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get player profiles separately
    const playerIds = [basicMatch.player1_id, basicMatch.player2_id].filter(Boolean);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, phone, username, game_handle")
      .in("user_id", playerIds);

    const player1 = profiles?.find((p: any) => p.user_id === basicMatch.player1_id);
    const player2 = profiles?.find((p: any) => p.user_id === basicMatch.player2_id);

    const notifications = [];
    const scheduledTime = basicMatch.scheduled_at 
      ? new Date(basicMatch.scheduled_at).toLocaleString("en-KE", { timeStyle: "short" })
      : "Soon";

    for (const player of [player1, player2].filter(Boolean)) {
      if (!player?.phone) continue;

      const opponent = player === player1 ? player2 : player1;
      const message = `⚔️ MATCH ALERT!\n\n` +
        `${basicMatch.tournament?.title || "Tournament"} - Round ${basicMatch.round}\n` +
        `🆚 vs ${opponent?.username || opponent?.game_handle || "Opponent"}\n` +
        `⏰ Time: ${scheduledTime}\n\n` +
        `Get ready, ${player.username}! Good luck! 🎮`;

      notifications.push(
        sendNotification(supabase, {
          type: "reminder",
          userId: player.user_id,
          phone: player.phone,
          message,
          tournamentId: basicMatch.tournament_id,
        })
      );
    }

    await Promise.all(notifications);

    return new Response(
      JSON.stringify({ success: true, notificationsSent: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleResultsPosted(supabase: any, matchId: string) {
  const { data: match, error: mError } = await supabase
    .from("matches")
    .select("*, tournament:tournaments(*)")
    .eq("id", matchId)
    .single();

  if (mError || !match) {
    return new Response(
      JSON.stringify({ error: "Match not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get player profiles
  const playerIds = [match.player1_id, match.player2_id].filter(Boolean);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, phone, username")
    .in("user_id", playerIds);

  const notifications = [];
  const winner = profiles?.find((p: any) => p.user_id === match.winner_id);
  const loser = profiles?.find((p: any) => p.user_id !== match.winner_id);

  // Notify winner
  if (winner?.phone) {
    const message = `🏆 VICTORY!\n\n` +
      `Congratulations ${winner.username}! You won your match in ${match.tournament?.title}!\n\n` +
      `Score: ${match.player1_score} - ${match.player2_score}\n\n` +
      `Keep it up! 🔥`;

    notifications.push(
      sendNotification(supabase, {
        type: "result",
        userId: winner.user_id,
        phone: winner.phone,
        message,
        tournamentId: match.tournament_id,
      })
    );
  }

  // Notify loser
  if (loser?.phone) {
    const message = `📊 Match Result\n\n` +
      `Your match in ${match.tournament?.title} has ended.\n\n` +
      `Score: ${match.player1_score} - ${match.player2_score}\n\n` +
      `Better luck next time! Keep practicing! 💪`;

    notifications.push(
      sendNotification(supabase, {
        type: "result",
        userId: loser.user_id,
        phone: loser.phone,
        message,
        tournamentId: match.tournament_id,
      })
    );
  }

  await Promise.all(notifications);

  return new Response(
    JSON.stringify({ success: true, notificationsSent: notifications.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleRegistrationConfirmed(supabase: any, tournamentId: string, userId: string) {
  // Get tournament and user details
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, username")
    .eq("user_id", userId)
    .single();

  if (!tournament || !profile?.phone) {
    return new Response(
      JSON.stringify({ error: "Tournament or user not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const startDate = new Date(tournament.start_date).toLocaleString("en-KE", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const message = `✅ REGISTRATION CONFIRMED!\n\n` +
    `Welcome to ${tournament.title}, ${profile.username}!\n\n` +
    `📅 Start: ${startDate}\n` +
    `🏆 Prize Pool: KES ${tournament.prize_pool.toLocaleString()}\n` +
    `👥 Players: ${tournament.current_participants}/${tournament.max_participants}\n\n` +
    `${tournament.group_link ? `📱 Join our group: ${tournament.group_link}\n\n` : ""}` +
    `Good luck! 🎮`;

  await sendNotification(supabase, {
    type: "registration",
    userId,
    phone: profile.phone,
    message,
    tournamentId,
  });

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function sendNotification(supabase: any, payload: {
  type: string;
  userId: string;
  phone: string;
  message: string;
  tournamentId?: string;
}) {
  // Store message and create in-app notification
  await supabase.from("whatsapp_messages").insert({
    user_id: payload.userId,
    phone: payload.phone.replace(/\s+/g, "").replace(/^0/, "+254"),
    type: payload.type,
    message: payload.message,
    status: "pending",
  });

  // Create in-app notification
  await supabase.from("notifications").insert({
    user_id: payload.userId,
    type: "whatsapp",
    title: getTitle(payload.type),
    message: payload.message.split("\n")[0], // First line as summary
    action_url: payload.tournamentId ? `/tournaments/${payload.tournamentId}` : null,
  });
}

function getTitle(type: string): string {
  switch (type) {
    case "registration": return "Registration Confirmed! 🎮";
    case "reminder": return "Match Reminder ⏰";
    case "result": return "Match Results 🏆";
    case "promotion": return "Special Offer! 🎁";
    default: return "GameFlex Update";
  }
}
