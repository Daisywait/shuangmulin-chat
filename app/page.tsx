import { redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat-workspace";
import { isAuthenticated } from "@/lib/auth";

export default async function Home() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return <ChatWorkspace adminEmail={process.env.ADMIN_EMAIL ?? "admin"} />;
}
