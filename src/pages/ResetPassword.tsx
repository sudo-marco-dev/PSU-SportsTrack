import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { KeyRound, Trophy, Mail } from 'lucide-react';

// ── Schemas ──

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const requestResetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
type RequestResetFormValues = z.infer<typeof requestResetSchema>;

type PageState = 'verifying' | 'request' | 'request-sent' | 'ready' | 'submitting' | 'success' | 'error';

// ── PSU Branding Header ──

const BrandingHeader = () => (
  <div className="text-center mb-6">
    <div className="mx-auto w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center rotate-3 mb-4 shadow-lg shadow-orange-500/30">
      <Trophy className="text-white size-8" />
    </div>
    <h2 className="text-2xl font-black tracking-tighter text-slate-900 italic uppercase">
      PSU <span className="text-orange-500">SportsTrack</span>
    </h2>
    <p className="text-slate-400 font-medium uppercase text-[9px] tracking-[0.3em] mt-1">
      Official Sports Tracking Portal
    </p>
  </div>
);

// ── Component ──

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const requestForm = useForm<RequestResetFormValues>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      email: '',
    },
  });

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    // If we have a token_hash and type=recovery, verify the OTP first
    if (tokenHash && type === 'recovery') {
      const verifyRecoveryToken = async () => {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });

          if (error) {
            console.error('[ResetPassword] Token verification failed:', error.message);
            setErrorMessage(error.message);
            setPageState('error');
            return;
          }

          // Token is valid, user session is now established
          setPageState('ready');
        } catch (err) {
          console.error('[ResetPassword] Unexpected error:', err);
          setErrorMessage('An unexpected error occurred. Please request a new reset link.');
          setPageState('error');
        }
      };

      verifyRecoveryToken();
      return;
    }

    // If no token_hash, listen for PASSWORD_RECOVERY event from onAuthStateChange
    // (This handles the case where Supabase redirects with a session fragment)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('ready');
      }
    });

    // Also check if there's already an active session (user may have been redirected)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState('ready');
      } else if (!tokenHash) {
        // No session and no token — show the email request form
        setPageState('request');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setPageState('submitting');

    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        toast.error('Failed to update password: ' + error.message);
        setPageState('ready');
        return;
      }

      setPageState('success');
      toast.success('Password updated successfully!');

      // Sign out and redirect to login after a brief delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err) {
      console.error('[ResetPassword] Unexpected error:', err);
      toast.error('An unexpected error occurred.');
      setPageState('ready');
    }
  };

  const onRequestReset = async (values: RequestResetFormValues) => {
    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error('Failed to send reset link: ' + error.message);
      } else {
        setPageState('request-sent');
      }
    } catch (err) {
      console.error('[ResetPassword] Unexpected error:', err);
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 relative overflow-hidden">
      {/* Decorative Background Elements — matching Login page */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-md relative z-10">

        {/* ── Verifying State ── */}
        {pageState === 'verifying' && (
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
            <div className="p-8 text-center">
              <BrandingHeader />
              <div className="mb-6">
                <div className="inline-block p-4 bg-orange-500/10 rounded-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" />
                </div>
              </div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">
                Validating<span className="text-orange-500">...</span>
              </h1>
              <p className="text-slate-400 font-medium text-sm">
                Please wait while we verify your recovery link.
              </p>
            </div>
          </Card>
        )}

        {/* ── Request Reset Form (no token — user clicked "Forgot Password?") ── */}
        {pageState === 'request' && (
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
            <CardHeader className="p-8 pb-4 text-center">
              <BrandingHeader />
              <div className="mx-auto mb-4 p-4 bg-orange-500/10 rounded-2xl w-fit">
                <Mail className="size-8 text-orange-500" />
              </div>
              <CardTitle className="text-3xl font-black uppercase italic tracking-tighter text-white">
                Reset <span className="text-orange-500">Password</span>
              </CardTitle>
              <CardDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mt-2">
                Enter your email and we'll send you a recovery link.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit(onRequestReset)} className="space-y-6">
                  <FormField
                    control={requestForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">
                          Email Address
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="202381234@psu.palawan.edu.ph"
                            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={isSendingReset}
                    className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isSendingReset ? (
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        <span>Sending...</span>
                      </div>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                </form>
              </Form>
              <div className="text-center mt-6">
                <Link
                  to="/login"
                  className="text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-orange-500 transition-colors underline underline-offset-4"
                >
                  ← Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Request Sent Confirmation ── */}
        {pageState === 'request-sent' && (
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
            <div className="p-8 text-center">
              <BrandingHeader />
              <div className="mb-6">
                <div className="inline-block p-4 bg-emerald-500/10 rounded-full">
                  <Mail className="size-12 text-emerald-500" />
                </div>
              </div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">
                Check Your <span className="text-emerald-500">Inbox</span>
              </h1>
              <p className="text-slate-400 font-medium text-sm mb-6">
                We've sent a password reset link to your email. Click the link in the email to set a new password.
              </p>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Don't see it? Check your spam folder or request another link.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition duration-200 shadow-sm uppercase tracking-wider text-sm"
              >
                Back to Login
              </Link>
            </div>
          </Card>
        )}

        {/* ── Error State ── */}
        {pageState === 'error' && (
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
            <div className="p-8 text-center">
              <BrandingHeader />
              <div className="mb-6">
                <div className="inline-block p-4 bg-red-500/10 rounded-full">
                  <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">
                Reset <span className="text-red-500">Failed</span>
              </h1>
              <div className="bg-red-500/10 rounded-xl p-4 mb-6 border border-red-500/20">
                <p className="text-sm text-red-400 font-medium">{errorMessage}</p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition duration-200 shadow-sm uppercase tracking-wider text-sm"
              >
                Back to Login
              </Link>
            </div>
          </Card>
        )}

        {/* ── Success State ── */}
        {pageState === 'success' && (
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
            <div className="p-8 text-center">
              <BrandingHeader />
              <div className="mb-6">
                <div className="inline-block p-4 bg-emerald-500/10 rounded-full">
                  <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">
                Password <span className="text-emerald-500">Updated!</span>
              </h1>
              <p className="text-slate-400 font-medium text-sm mb-6">
                Your password has been changed successfully. Redirecting to login...
              </p>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-[progress_2.5s_ease-in-out]" style={{ width: '100%' }} />
              </div>
            </div>
          </Card>
        )}

        {/* ── Password Reset Form ── */}
        {(pageState === 'ready' || pageState === 'submitting') && (
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
            <CardHeader className="p-8 pb-4 text-center">
              <BrandingHeader />
              <div className="mx-auto mb-4 p-4 bg-orange-500/10 rounded-2xl w-fit">
                <KeyRound className="size-8 text-orange-500" />
              </div>
              <CardTitle className="text-3xl font-black uppercase italic tracking-tighter text-white">
                New <span className="text-orange-500">Password</span>
              </CardTitle>
              <CardDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mt-2">
                Enter your new password below to complete the reset.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">
                          New Password
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Min. 8 characters"
                            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">
                          Confirm Password
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Re-enter your password"
                            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={pageState === 'submitting'}
                    className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {pageState === 'submitting' ? (
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        <span>Updating...</span>
                      </div>
                    ) : (
                      'Reset Password'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
