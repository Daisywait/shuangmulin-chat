import { redirect } from "next/navigation";
import { isAuthenticated, setSessionCookie, validateLogin } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!validateLogin(email, password)) {
    redirect("/login?error=1");
  }

  await setSessionCookie(email);
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) {
    redirect("/");
  }
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-panel">
        <h1>双木林-chat</h1>
        <form action={loginAction} className="login-form">
          <input className="login-input" name="email" type="email" autoComplete="email" placeholder="管理员邮箱" required />
          <input className="login-input" name="password" type="password" autoComplete="current-password" placeholder="密码" required />
          {params.error ? <div className="error-line">邮箱或密码不正确。</div> : null}
          <button className="primary-button" type="submit">登录</button>
        </form>
      </section>
    </main>
  );
}
