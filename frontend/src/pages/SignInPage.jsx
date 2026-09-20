// ─────────────────────────────────────────────────────────
// Sign In Page — renders Clerk's pre-built SignIn component

import { SignIn } from '@clerk/clerk-react'

function SignInPage() {
  return (
    <div className="auth-page">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
      />
    </div>
  )
}

export default SignInPage
