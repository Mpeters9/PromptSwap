import { AuthForm } from "@/components/AuthForm";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-lg px-4">
        <AuthForm />
      </div>
    </main>
  );
}
