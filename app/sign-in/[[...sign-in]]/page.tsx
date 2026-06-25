import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0A0A0F'
    }}>
      <SignIn
        fallbackRedirectUrl="/dashboard"
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
            formButtonPrimary: 'bg-[#00E5A0] text-black hover:bg-[#00C984]',
          },
        }}
      />
    </div>
  )
}
