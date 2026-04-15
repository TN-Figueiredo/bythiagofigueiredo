import type { FastifyInstance } from 'fastify'
import { registerAuthRoutes } from '@tn-figueiredo/auth-fastify'
import { SupabaseAuthService, sendPasswordResetEmail } from '@tn-figueiredo/auth-supabase'
import {
  SignUpUseCase,
  SocialSignInUseCase,
  SetPasswordUseCase,
  ChangePasswordUseCase,
  ChangeEmailUseCase,
  VerifyEmailOtpUseCase,
  ResendSignupConfirmationUseCase,
} from '@tn-figueiredo/auth/use-cases'
import type { IAuthUserProfileRepository } from '@tn-figueiredo/auth'
import { env } from '../env.js'
import { getServiceClient } from '../lib/supabase.js'
import { createOnPostSignUp } from '../hooks/on-signup.js'

/**
 * Minimal no-op profile repository.
 *
 * This CMS doesn't use the full @tn-figueiredo/auth profile model (it uses
 * an `authors` table instead, populated via onPostSignUp). The use cases
 * that accept an optional profile repository work fine without one; only
 * ChangeEmailUseCase requires a non-optional `profiles` dep, so we provide
 * a stub that satisfies the interface without persisting anything.
 */
function createNoopProfileRepo(): IAuthUserProfileRepository {
  return {
    async findByUserId() {
      return null
    },
    async findByReferralCode() {
      return null
    },
    async create() {
      /* no-op */
    },
    async saveAcquisitionSource() {
      /* no-op */
    },
    async getWelcomeEmailSentAt() {
      return null
    },
    async setWelcomeEmailSentAt() {
      /* no-op */
    },
  }
}

export async function authPlugin(fastify: FastifyInstance): Promise<void> {
  const authService = new SupabaseAuthService({
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    passwordResetRedirectUrl: `${env.WEB_URL}/reset-password`,
  })

  const profiles = createNoopProfileRepo()
  const authDeps = { auth: authService }

  registerAuthRoutes(fastify, {
    authService,
    signUp: new SignUpUseCase(authDeps),
    socialSignIn: new SocialSignInUseCase(authDeps),
    setPassword: new SetPasswordUseCase(authDeps),
    changePassword: new ChangePasswordUseCase(authDeps),
    changeEmail: new ChangeEmailUseCase({ auth: authService, profiles }),
    verifyOtp: new VerifyEmailOtpUseCase(authDeps),
    resendOtp: new ResendSignupConfirmationUseCase(authDeps),
    forgotPassword: (email: string) =>
      sendPasswordResetEmail(
        {
          supabaseUrl: env.SUPABASE_URL,
          supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
          passwordResetRedirectUrl: `${env.WEB_URL}/reset-password`,
        },
        email,
      ),
    hooks: {
      onPostSignUp: createOnPostSignUp(getServiceClient()),
    },
  })
}
