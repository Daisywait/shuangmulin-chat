import { redirect } from "next/navigation";
import { authenticateUser, createUser, isAuthenticated, setSessionCookie } from "@/lib/auth";

async function authAction(formData: FormData) {
  "use server";

  const mode = String(formData.get("mode") ?? "login");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const user = mode === "register" ? await createUser(email, password) : await authenticateUser(email, password);
    await setSessionCookie(user);
  } catch {
    redirect(`/login?error=1&mode=${mode}`);
  }

  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string }> }) {
  if (await isAuthenticated()) {
    redirect("/");
  }
  const params = await searchParams;
  const defaultMode = params.mode === "register" ? "register" : "login";

  return (
    <main className="login-page">
      <section className="login-panel">
        <h1>双木林-chat</h1>
        <form action={authAction} className="login-form">
          <div className="auth-mode-row">
            <label>
              <input type="radio" name="mode" value="login" defaultChecked={defaultMode === "login"} />
              登录
            </label>
            <label>
              <input type="radio" name="mode" value="register" defaultChecked={defaultMode === "register"} />
              注册
            </label>
          </div>
          <input className="login-input" name="email" type="email" autoComplete="email" placeholder="邮箱" required />
          <input
            className="login-input"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="密码，至少 8 位"
            minLength={8}
            required
          />
          {params.error ? <div className="error-line">登录或注册失败，请检查邮箱和密码。</div> : null}
          <button className="primary-button" type="submit">继续</button>
        </form>
      </section>
    </main>
  );
}
