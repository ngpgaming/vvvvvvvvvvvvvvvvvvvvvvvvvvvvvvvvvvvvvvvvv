import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret
    const webhookSecret = Deno.env.get("OTP_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");

    if (!webhookSecret || providedSecret !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone_number, otp_code } = await req.json();

    if (!phone_number || !otp_code) {
      return new Response(
        JSON.stringify({ error: "phone_number and otp_code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the pending order with this phone number
    const { data: order, error: findError } = await supabase
      .from("orders")
      .select("id, phone_number_id")
      .eq("phone_number", phone_number)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !order) {
      return new Response(
        JSON.stringify({ error: "No pending order found for this number", details: findError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update order with OTP and mark as completed
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        otp: otp_code,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update order", details: updateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark phone number as sold
    await supabase
      .from("phone_numbers")
      .update({ is_sold: true })
      .eq("id", order.phone_number_id);

    console.log(`OTP ${otp_code} delivered for number ${phone_number}, order ${order.id}`);

    return new Response(
      JSON.stringify({ success: true, order_id: order.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing OTP:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
