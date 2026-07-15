import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  hospital_id?: string;
  patient_id?: string;
  [key: string]: unknown;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, key);

    // Parse request body
    const body: RequestBody = await req.json().catch(() => ({}));
    const path = new URL(req.url).pathname;

    // Route handling
    let response: unknown = { status: "ok" };

    if (path.includes("/patients")) {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("hospital_id", body.hospital_id)
        .limit(100);
      response = { patients: data };
    } else if (path.includes("/triage")) {
      response = { triage: "endpoint ready" };
    } else if (path.includes("/pharmacy")) {
      response = { pharmacy: "endpoint ready" };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});