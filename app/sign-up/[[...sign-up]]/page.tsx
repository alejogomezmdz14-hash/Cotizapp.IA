'use client'

import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
        forceRedirectUrl="/onboarding"
        appearance={{
          variables: {
            colorPrimary: '#00E5A0',
            colorBackground: '#1A1D27',
            colorInputBackground: '#222536',
            colorInputText: '#FFFFFF',
            colorText: '#FFFFFF',
            colorTextSecondary: '#8B8FA8',
          },
          elements: {
            card: 'shadow-2xl border border-white/10',
            formButtonPrimary:
              'bg-[#00E5A0] text-black hover:bg-[#00C984]',
          },
        }}
      />
    </div>
  )
}
