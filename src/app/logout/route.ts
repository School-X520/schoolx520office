import { redirect } from "next/navigation";

import { shouldUseMockData } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  if (!shouldUseMockData()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
