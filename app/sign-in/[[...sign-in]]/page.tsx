import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SignIn } from '@clerk/nextjs'

export default async function SignInPage() {
  const { userId } = await auth()
  if (userId) {
    redirect('/dashboard')
  }
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
