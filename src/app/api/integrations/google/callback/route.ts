import { redirect } from "next/navigation";

export async function GET() {
  redirect("/admin/ops?google=connected-placeholder");
}
