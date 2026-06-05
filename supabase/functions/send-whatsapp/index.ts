import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  type: "registration" | "reminder" | "result" | "promotion";
  userId: string;
  phone: string;
  message: string;
  tournamentId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const atApiKey = Deno.env.get("AT_API_KEY");
    const atUsername = Deno.env.get("AT_USERNAME");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, userId, phone, message, tournamentId }: WhatsAppRequest = await req.json();

    if (!phone || !message || !userId || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, message, userId, type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (ensure it starts with country code)
    let formattedPhone = phone.replace(/\s+/g, "").replace(/^0/, "254");
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }

    // Store the message in database first
    const { data: messageRecord, error: dbError } = await supabase
      .from("whatsapp_messages")
      .insert({
        user_id: userId,
        phone: formattedPhone,
        type,
        message,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to store message", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if API keys are configured
    if (!atApiKey || !atUsername) {
      console.log("Africa's Talking API keys not configured. Message stored but not sent.");
      
      // Create in-app notification as fallback
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "whatsapp",
        title: getNotificationTitle(type),
        message: message,
        action_url: tournamentId ? `/tournaments/${tournamentId}` : null,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: messageRecord.id,
          sent: false,
          reason: "API keys not configured - message stored and in-app notification created"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Africa's Talking SMS API (WhatsApp requires special approval)
    const atResponse = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "apiKey": atApiKey,
      },
      body: new URLSearchParams({
        username: atUsername,
        to: formattedPhone,
        message: message,
      }),
    });

    const atResult = await atResponse.json();
    console.log("Africa's Talking response:", atResult);

    // Update message status based on response
    const status = atResult.SMSMessageData?.Recipients?.[0]?.status === "Success" 
      ? "sent" 
      : "failed";

    await supabase
      .from("whatsapp_messages")
      .update({ 
        status, 
        sent_at: status === "sent" ? new Date().toISOString() : null 
      })
      .eq("id", messageRecord.id);

    // Also create in-app notification
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "whatsapp",
      title: getNotificationTitle(type),
      message: message,
      action_url: tournamentId ? `/tournaments/${tournamentId}` : null,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: messageRecord.id,
        sent: status === "sent",
        atResponse: atResult
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getNotificationTitle(type: string): string {
  switch (type) {
    case "registration":
      return "Registration Confirmed! 🎮";
    case "reminder":
      return "Match Reminder ⏰";
    case "result":
      return "Match Results 🏆";
    case "promotion":
      return "Special Offer! 🎁";
    default:
      return "GameFlex Update";
  }
}
