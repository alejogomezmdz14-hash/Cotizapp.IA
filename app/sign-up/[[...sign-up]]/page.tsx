import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="shell-backdrop flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
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
