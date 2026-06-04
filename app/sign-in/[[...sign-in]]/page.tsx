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
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  )
}
