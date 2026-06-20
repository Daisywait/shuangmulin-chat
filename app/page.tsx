import { redirect } from "next/navigation";
import { ChatWorkspace } from "@/components/chat-workspace";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <ChatWorkspace adminEmail={user.email} />;
}
