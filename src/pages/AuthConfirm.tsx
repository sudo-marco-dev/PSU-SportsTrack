import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { EmailOtpType } from '@supabase/supabase-js';

type ConfirmState = 'loading' | 'success' | 'recovery-ready' | 'error';

export const AuthConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<ConfirmState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const verifyTokenOrSession = async () => {
      try {
        const tokenHash = searchParams.get('token_hash');
        const code = searchParams.get('code');
        const rawType = searchParams.get('type');
        const type = (rawType || 'signup') as EmailOtpType;
        const hash = window.location.hash || '';

        let verifiedUser: any = null;

        // Pathway 1: token_hash verification (Standard Supabase Email Confirmation / Magic Link)
        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });

          if (error) {
            console.error('[AuthConfirm] Token verification failed:', error.message);
            if (isMounted) {
              setState('error');
              setErrorMessage(error.message);
            }
            return;
          }
          verifiedUser = data.user;
        }
        // Pathway 2: PKCE code exchange (?code=...)
        else if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[AuthConfirm] PKCE code exchange failed:', error.message);
            if (isMounted) {
              setState('error');
              setErrorMessage(error.message);
            }
            return;
          }
          verifiedUser = data.user || data.session?.user;
        }
        // Pathway 3: Hash parameters or already authenticated session
        else if (hash.includes('access_token') || hash.includes('type=')) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            verifiedUser = sessionData.session.user;
          } else {
            // Give auth client brief moment to parse hash
            await new Promise((resolve) => setTimeout(resolve, 500));
            const { data: retryData } = await supabase.auth.getSession();
            if (retryData?.session?.user) {
              verifiedUser = retryData.session.user;
            } else {
              if (isMounted) {
                setState('error');
                setErrorMessage('Unable to process verification from URL parameters.');
              }
              return;
            }
          }
        } else {
          // Check if session is already active
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            verifiedUser = sessionData.session.user;
          } else {
            if (isMounted) {
              setState('error');
              setErrorMessage('Invalid confirmation link. Missing required parameters.');
            }
            return;
          }
        }

        if (!isMounted) return;

        // If this is password recovery, route to reset-password
        if (type === 'recovery' || hash.includes('type=recovery')) {
          setState('recovery-ready');
          setTimeout(() => {
            navigate('/reset-password', { replace: true });
          }, 1500);
          return;
        }

        // Profile sync fallback: ensure public.users profile exists
        if (verifiedUser?.id) {
          const metadata = verifiedUser.user_metadata || {};
          const role = metadata.role || 'player_student';
          const fullName = metadata.full_name || verifiedUser.email;
          const collegeId = metadata.college_id || null;
          const employeeId = metadata.employee_id || null;
          const department = metadata.department || null;

          try {
            await supabase.from('users').upsert(
              {
                id: verifiedUser.id,
                email: verifiedUser.email,
                full_name: fullName,
                role: role,
                college_id: collegeId,
                employee_id: employeeId,
                department: department,
                account_status: 'active',
                is_verified: false,
              },
              { onConflict: 'id', ignoreDuplicates: true }
            );
          } catch (profileErr) {
            console.warn('[AuthConfirm] Profile fallback sync note:', profileErr);
          }
        }

        setState('success');

        const next = searchParams.get('next') || searchParams.get('redirect_to');
        const role = verifiedUser?.user_metadata?.role;
        const defaultPath = role === 'coach' ? '/coach' : '/player';

        setTimeout(() => {
          if (isMounted) {
            navigate(next || defaultPath, { replace: true });
          }
        }, 1800);
      } catch (err: any) {
        console.error('[AuthConfirm] Unexpected error during verification:', err);
        if (isMounted) {
          setState('error');
          setErrorMessage(err?.message || 'An unexpected error occurred during email verification.');
        }
      }
    };

    verifyTokenOrSession();

    return () => {
      isMounted = false;
    };
  }, [searchParams, navigate]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-900 px-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          {state === 'loading' && (
            <div className="space-y-4 animate-shimmer">
              <div className="size-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 mx-auto flex items-center justify-center">
                <div className="size-8 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
              </div>
              <div className="space-y-2">
                <div className="h-6 w-48 bg-slate-800 rounded-lg mx-auto" />
                <div className="h-4 w-64 bg-slate-800/60 rounded-md mx-auto" />
              </div>
              <p className="text-xs text-slate-400 font-medium pt-2">
                Verifying your official university credentials...
              </p>
            </div>
          )}

          {state === 'recovery-ready' && (
            <>
              <div className="mb-6">
                <div className="inline-block p-4 bg-orange-500/10 rounded-full">
                  <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">
                Password Reset <span className="text-orange-500">Authorized!</span>
              </h1>
              <p className="text-slate-300 font-medium text-sm mb-6">
                Your recovery token has been verified. Redirecting you to set a new password...
              </p>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full animate-[progress_1.5s_ease-in-out]" style={{ width: '100%' }} />
              </div>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="mb-6">
                <div className="inline-block p-4 bg-emerald-500/10 rounded-full">
                  <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">
                PSU Email <span className="text-emerald-400">Verified!</span>
              </h1>
              <p className="text-slate-300 font-medium text-sm mb-6">
                Your official Palawan State University account is now active. Redirecting you to your dashboard...
              </p>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-[progress_1.8s_ease-in-out]" style={{ width: '100%' }} />
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="mb-6">
                <div className="inline-block p-4 bg-red-500/10 rounded-full">
                  <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">
                Verification <span className="text-red-400">Failed</span>
              </h1>
              <p className="text-slate-400 font-medium text-sm mb-2">
                We couldn't verify your university credentials.
              </p>
              <div className="bg-red-500/10 rounded-lg p-4 mb-6 border border-red-500/20">
                <p className="text-sm text-red-300 font-medium">{errorMessage}</p>
              </div>
              <Link
                to="/register"
                className="inline-flex items-center justify-center w-full min-h-[48px] px-6 py-3 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-bold rounded-lg transition duration-200 shadow-lg shadow-orange-600/30 uppercase tracking-wider text-sm cursor-pointer"
              >
                Back to Registration
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
