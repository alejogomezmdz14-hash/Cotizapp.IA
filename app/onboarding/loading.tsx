export default function OnboardingLoading() {
  return (
    <main className="shell-backdrop flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="shell-panel-strong w-full max-w-md space-y-4 border border-token p-6 text-center sm:p-8">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-token border-t-accent-token" />
        <p className="text-sm text-muted-foreground">Preparando tu cuenta…</p>
      </div>
    </main>
  );
}
