import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/get-current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/office" : "/login");
}
