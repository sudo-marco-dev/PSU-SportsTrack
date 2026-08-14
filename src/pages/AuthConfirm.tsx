import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { EmailOtpType } from '@supabase/supabase-js';

type ConfirmState = 'loading' | 'success' | 'error';

export const AuthConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<ConfirmState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;

    if (!tokenHash || !type) {
      setState('error');
      setErrorMessage('Invalid confirmation link. Missing required parameters.');
      return;
    }

    const verifyToken = async () => {
      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });

        if (error) {
          console.error('[AuthConfirm] Verification failed:', error.message);
          setState('error');
          setErrorMessage(error.message);
          return;
        }

        setState('success');

        // Redirect to the root after a brief delay so the user sees the success message
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } catch (err) {
        console.error('[AuthConfirm] Unexpected error:', err);
        setState('error');
        setErrorMessage('An unexpected error occurred during verification.');
      }
    };

    verifyToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          {state === 'loading' && (
            <>
              <div className="mb-6">
                <div className="inline-block p-4 bg-orange-50 rounded-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" />
                </div>
              </div>
              <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-2">
                Verifying<span className="text-orange-500">...</span>
              </h1>
              <p className="text-slate-500 font-medium text-sm">
                Please wait while we confirm your account.
              </p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="mb-6">
                <div className="inline-block p-4 bg-emerald-50 rounded-full">
                  <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-2">
                Account <span className="text-emerald-500">Confirmed!</span>
              </h1>
              <p className="text-slate-500 font-medium text-sm mb-6">
                Your email has been verified successfully. Redirecting you now...
              </p>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-[progress_2s_ease-in-out]" style={{ width: '100%' }} />
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="mb-6">
                <div className="inline-block p-4 bg-red-50 rounded-full">
                  <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-2">
                Verification <span className="text-red-500">Failed</span>
              </h1>
              <p className="text-slate-500 font-medium text-sm mb-2">
                We couldn't verify your account.
              </p>
              <div className="bg-red-50 rounded-lg p-4 mb-6 border border-red-200">
                <p className="text-sm text-red-700 font-medium">{errorMessage}</p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition duration-200 shadow-sm uppercase tracking-wider text-sm"
              >
                Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
