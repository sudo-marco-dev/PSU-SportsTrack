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
import { KeyRound } from 'lucide-react';

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

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

type PageState = 'verifying' | 'ready' | 'submitting' | 'success' | 'error';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
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
        // No session and no token — user navigated here directly without a valid link
        setErrorMessage('No recovery session found. Please request a new password reset link.');
        setPageState('error');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* Verifying State */}
        {pageState === 'verifying' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="inline-block p-4 bg-orange-50 rounded-full">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-2">
              Validating<span className="text-orange-500">...</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              Please wait while we verify your recovery link.
            </p>
          </div>
        )}

        {/* Error State */}
        {pageState === 'error' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="inline-block p-4 bg-red-50 rounded-full">
                <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-2">
              Reset <span className="text-red-500">Failed</span>
            </h1>
            <div className="bg-red-50 rounded-lg p-4 mb-6 border border-red-200">
              <p className="text-sm text-red-700 font-medium">{errorMessage}</p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full px-6 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition duration-200 shadow-sm uppercase tracking-wider text-sm"
            >
              Back to Login
            </Link>
          </div>
        )}

        {/* Success State */}
        {pageState === 'success' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="inline-block p-4 bg-emerald-50 rounded-full">
                <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-2">
              Password <span className="text-emerald-500">Updated!</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm mb-6">
              Your password has been changed successfully. Redirecting to login...
            </p>
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-[progress_2.5s_ease-in-out]" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {/* Password Reset Form */}
        {(pageState === 'ready' || pageState === 'submitting') && (
          <Card className="rounded-[2rem] border-2 border-slate-100 shadow-2xl overflow-hidden">
            <div className="h-2 w-full bg-orange-500" />
            <CardHeader className="p-8 pb-4 text-center">
              <div className="mx-auto mb-4 p-4 bg-orange-50 rounded-2xl w-fit">
                <KeyRound className="size-8 text-orange-500" />
              </div>
              <CardTitle className="text-3xl font-black uppercase italic tracking-tighter">
                New <span className="text-orange-500">Password</span>
              </CardTitle>
              <CardDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-2">
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
                      <FormItem className="space-y-3">
                        <FormLabel className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">
                          New Password
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Min. 8 characters"
                            className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">
                          Confirm Password
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Re-enter your password"
                            className="h-14 bg-slate-50 border-slate-200 rounded-2xl font-bold"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={pageState === 'submitting'}
                    className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-[0.1em] rounded-2xl shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-95"
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
