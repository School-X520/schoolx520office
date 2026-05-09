import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/office" : "/login");
}
