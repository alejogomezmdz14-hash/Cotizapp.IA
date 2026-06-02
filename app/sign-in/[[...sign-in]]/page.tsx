import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="shell-backdrop flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: "mx-auto w-full max-w-md",
            card: "shell-panel-strong border border-token bg-surface shadow-none",
          },
        }}
      />
    </main>
  );
}
