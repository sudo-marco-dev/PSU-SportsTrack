import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Eye,
  EyeOff,
  Trophy,
  LogIn,
  Lock,
  Mail,
  AlertCircle,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { PasswordPolicyMeter } from '@/components/auth/PasswordPolicyMeter';
import { LegalModal } from '@/components/legal/LegalModal';
import { OtpVerificationStep } from '@/components/auth/OtpVerificationStep';

const PSU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@psu\.palawan\.edu\.ph$/i;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

const registerSchema = z.object({
  lastName: z.string().trim().min(1, { message: 'Last name is required' }),
  firstName: z.string().trim().min(1, { message: 'First name is required' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Invalid university email' })
    .refine((val) => PSU_EMAIL_REGEX.test(val), {
      message: 'Registration requires an official PSU email address ending with @psu.palawan.edu.ph',
    }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' })
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/, { message: 'Password must contain at least one special symbol' }),
  confirmPassword: z.string().min(1, { message: 'Please confirm your password' }),
  role: z.enum(['player_student', 'player_faculty', 'player_staff', 'coach'] as const, { message: 'Role is required' }),
  collegeId: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms & Conditions and Privacy Policy',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const getAuthErrorMessage = (rawMessage: string): string => {
  const msg = rawMessage.toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Invalid email or password. Please verify your credentials (check for typos and Caps Lock).';
  }
  if (msg.includes('email not confirmed')) {
    return 'Your email address has not been confirmed yet. Please verify your email or contact support.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Too many login attempts. Please wait a few moments before trying again.';
  }
  return rawMessage;
};

const getLockoutKey = (email: string) => `psu_lockout_${email.trim().toLowerCase()}`;

export const LoginModal = () => {
  const { isLoginModalOpen, closeLoginModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'otp'>('login');
  const [pendingOtpEmail, setPendingOtpEmail] = useState<string>('');
  const [pendingRole, setPendingRole] = useState<string>('player_student');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [colleges, setColleges] = useState<{ id: string; college_name: string }[]>([]);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms'>('terms');
  const [isMandatoryLegalModal, setIsMandatoryLegalModal] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);

  // Login Form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Register Form
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      lastName: '',
      firstName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'player_student',
      collegeId: '',
      employeeId: '',
      department: '',
      termsAccepted: false,
    },
  });

  const watchedRegPassword = registerForm.watch('password');
  const watchedRegConfirmPassword = registerForm.watch('confirmPassword');

  useEffect(() => {
    supabase.from('colleges').select('id, college_name').then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  // Clear legacy global keys that trapped the whole browser on any single test account failure
  useEffect(() => {
    localStorage.removeItem('login_lockout_until');
    localStorage.removeItem('login_attempts');
  }, []);

  // Whenever the login modal is opened or closed, always reset authMode to 'login' and clear form fields
  useEffect(() => {
    if (isLoginModalOpen) {
      setAuthMode('login');
    } else {
      setAuthMode('login');
      setShowPassword(false);
      setShowRegisterPassword(false);
      setShowRegisterConfirmPassword(false);
      loginForm.reset();
      registerForm.reset();
    }
  }, [isLoginModalOpen]);

  const watchedLoginEmail = loginForm.watch('email');

  // Check rate limit / lockout scoped to the currently typed email
  useEffect(() => {
    if (!watchedLoginEmail || !watchedLoginEmail.includes('@')) {
      setCooldownRemaining(0);
      return;
    }
    const clean = watchedLoginEmail.trim().toLowerCase();
    const lockKey = getLockoutKey(clean);
    const lockUntilStr = localStorage.getItem(lockKey);
    if (lockUntilStr) {
      const lockUntil = parseInt(lockUntilStr, 10);
      const now = Date.now();
      if (now < lockUntil) {
        setCooldownRemaining(Math.ceil((lockUntil - now) / 1000));
      } else {
        localStorage.removeItem(lockKey);
        setCooldownRemaining(0);
      }
    } else {
      setCooldownRemaining(0);
    }
  }, [watchedLoginEmail]);

  // Tick down cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    const cleanEmail = values.email.trim().toLowerCase();
    const cleanPassword = values.password;
    const lockKey = getLockoutKey(cleanEmail);

    // 1. Check server-side rate limits first (Rule 3 Invariant)
    try {
      const { data: limitCheck } = await (supabase.rpc as any)('check_login_rate_limit', {
        p_email: cleanEmail,
      });
      if (limitCheck && limitCheck.allowed === false) {
        const remainingSeconds = limitCheck.remaining_seconds || 300;
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        setCooldownRemaining(remainingSeconds);
        localStorage.setItem(lockKey, (Date.now() + remainingSeconds * 1000).toString());
        toast.error(`Account temporarily locked due to failed attempts. Please try again in ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s.`);
        return;
      }
    } catch (rpcErr) {
      console.warn('Server-side rate limit check fallback:', rpcErr);
    }

    // 2. Client local storage check fallback scoped to this email
    const storedLock = localStorage.getItem(lockKey);
    if (storedLock) {
      const lockUntil = parseInt(storedLock, 10);
      const now = Date.now();
      if (now < lockUntil) {
        const remainingSeconds = Math.ceil((lockUntil - now) / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        setCooldownRemaining(remainingSeconds);
        toast.error(`Account temporarily locked. Please try again in ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s.`);
        return;
      } else {
        localStorage.removeItem(lockKey);
        setCooldownRemaining(0);
      }
    }

    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        // Record failed attempt on server
        try {
          const { data: failRecord } = await (supabase.rpc as any)('record_failed_login', {
            p_email: cleanEmail,
          });
          if (failRecord && failRecord.allowed === false) {
            const remainingSeconds = failRecord.remaining_seconds || 300;
            setCooldownRemaining(remainingSeconds);
            localStorage.setItem(lockKey, (Date.now() + remainingSeconds * 1000).toString());
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            toast.error(`Too many failed attempts. Account temporarily locked for ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s.`);
            return;
          } else if (failRecord && typeof failRecord.failed_attempts === 'number') {
            const remainingAttempts = Math.max(1, 5 - failRecord.failed_attempts);
            toast.error(`${getAuthErrorMessage(error.message)} (${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining)`);
            return;
          }
        } catch (rpcErr) {
          console.warn('Server failed login recording fallback:', rpcErr);
        }

        if (error.message.toLowerCase().includes('email not confirmed')) {
          setPendingOtpEmail(cleanEmail);
          setAuthMode('otp');
          toast.info('Your university email has not been verified yet. Please enter the OTP code or check your inbox.');
          return;
        }

        toast.error(getAuthErrorMessage(error.message));
      } else {
        // Reset rate limits on server upon successful auth
        try {
          await (supabase.rpc as any)('record_successful_login', {
            p_email: cleanEmail,
          });
        } catch (rpcErr) {
          console.warn('Server successful login recording fallback:', rpcErr);
        }

        localStorage.removeItem(lockKey);
        setCooldownRemaining(0);
        toast.success('Logged in successfully! Welcome back.');
        loginForm.reset();
        closeLoginModal();

        // If the user logged in from a contextual page (e.g. courtside kiosk, live match, tournament bracket),
        // keep them on their current page instead of abruptly redirecting away to their role dashboard.
        const currentPath = location.pathname;
        const isAuthOrLanding = currentPath === '/' || currentPath === '/login' || currentPath === '/register';

        if (isAuthOrLanding) {
          // Check role and route immediately to the appropriate dashboard
          let destination = '/';
          if (authData?.user?.id) {
            const { data: userRec } = await supabase
              .from('users')
              .select('role')
              .eq('id', authData.user.id)
              .single();
            const userRole = userRec?.role;
            if (userRole === 'dev') {
              destination = '/dev';
            } else if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'Admin') {
              destination = '/admin';
            } else if (userRole === 'coach' || userRole === 'Coach') {
              destination = '/coach';
            } else {
              destination = '/player';
            }
          }
          navigate(destination, { replace: true });
        }
      }
    } catch {
      toast.error('An unexpected error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function onRegisterSubmit(values: z.infer<typeof registerSchema>, acceptedTimestamp?: string) {
    setIsLoading(true);
    try {
      const cleanEmail = values.email.trim().toLowerCase();
      const formattedFullName = `${values.lastName.trim()}, ${values.firstName.trim()}`;
      const finalAcceptedAt = acceptedTimestamp || termsAcceptedAt || new Date().toISOString();

      // 1. Sign up user with metadata for server trigger & email confirmation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: values.password,
        options: {
          data: {
            full_name: formattedFullName,
            first_name: values.firstName.trim(),
            last_name: values.lastName.trim(),
            role: values.role,
            college_id: values.collegeId || null,
            employee_id: values.employeeId ? values.employeeId.trim() : null,
            department: values.department ? values.department.trim() : null,
            terms_accepted_at: finalAcceptedAt,
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm?type=signup`,
        },
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (authData.user) {
        if (!authData.session) {
          setPendingOtpEmail(cleanEmail);
          setPendingRole(values.role);
          setAuthMode('otp');
          toast.info('Verification code sent! Enter the OTP code or click the confirmation link in your email.');
          return;
        }

        // Direct session fallback (e.g. dev environments where email confirmation is disabled)
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          full_name: formattedFullName,
          email: cleanEmail,
          role: values.role,
          college_id: values.collegeId || null,
          employee_id: values.employeeId ? values.employeeId.trim() : null,
          department: values.department ? values.department.trim() : null,
          terms_accepted_at: finalAcceptedAt,
        });

        if (profileError && !profileError.message.includes('duplicate key')) {
          console.error('Profile creation note:', profileError.message);
        }

        toast.success('Registration successful! Welcome to PSU SportsTrack.');
        registerForm.reset();
        closeLoginModal();
        const destination = values.role === 'coach' ? '/coach' : '/player';
        navigate(destination, { replace: true });
      }
    } catch {
      toast.error('An unexpected error occurred during registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleAttemptRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.getValues('termsAccepted')) {
      const isFieldsValid = await registerForm.trigger([
        'lastName',
        'firstName',
        'email',
        'password',
        'confirmPassword',
        'role',
        'collegeId',
      ]);
      if (!isFieldsValid) return;
      setIsMandatoryLegalModal(true);
      setShowLegalModal(true);
      return;
    }
    await registerForm.handleSubmit((vals) => onRegisterSubmit(vals, termsAcceptedAt || new Date().toISOString()))(e);
  };

  return (
    <>
      <Dialog
        open={isLoginModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeLoginModal();
            setAuthMode('login');
          }
        }}
      >
        <DialogContent className="w-full max-w-[94vw] sm:max-w-md md:max-w-lg p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl bg-slate-950 text-white relative max-h-[92vh] overflow-y-auto">
          <div>
            {/* Header Badge */}
            <div className="flex items-center mb-5 sm:mb-6">
              <div className="size-11 sm:size-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shadow-sm">
                {authMode === 'login' ? (
                  <Trophy className="size-5 sm:size-6" />
                ) : authMode === 'register' ? (
                  <UserPlus className="size-5 sm:size-6" />
                ) : (
                  <ShieldCheck className="size-5 sm:size-6" />
                )}
              </div>
            </div>

            {/* Title & Description */}
            <div className="animate-in fade-in duration-300">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block mb-1">
                PALAWAN STATE UNIVERSITY
              </span>
              <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tight text-white leading-none">
                {authMode === 'login' ? (
                  <>Sign In <span className="text-orange-500">Portal</span></>
                ) : authMode === 'register' ? (
                  <>Create <span className="text-orange-500">Account</span></>
                ) : (
                  <>Verify <span className="text-orange-500">PSU Email</span></>
                )}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-normal mt-1.5 leading-relaxed">
                {authMode === 'login'
                  ? 'Enter your university email and password to access your dashboard.'
                  : authMode === 'register'
                  ? 'Register your official student, coach, or faculty profile to access PSU tournaments.'
                  : 'Enter the 6-digit verification code or click the confirmation link sent to your email.'}
              </DialogDescription>
            </div>

            {/* Lockout Banner */}
            {authMode === 'login' && cooldownRemaining > 0 && (
              <div className="mt-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="size-5 text-red-400 shrink-0" />
                  <div className="text-xs text-red-200 font-medium">
                    Account locked. Cooldown: <span className="font-mono text-red-400 font-bold">{Math.floor(cooldownRemaining / 60)}m {cooldownRemaining % 60}s</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    closeLoginModal();
                    navigate('/reset-password');
                  }}
                  className="text-[11px] font-bold text-orange-400 hover:text-orange-300 underline cursor-pointer shrink-0"
                >
                  Reset Password
                </button>
              </div>
            )}

            {/* MODE 1: SIGN IN FORM */}
            {authMode === 'login' && (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4 mt-5 animate-in fade-in duration-300">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                            <Input
                              type="email"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              autoComplete="email"
                              placeholder="athlete@psu.edu.ph"
                              className="h-11 pl-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <div className="flex items-center justify-between ml-1">
                          <FormLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Password</FormLabel>
                          <button
                            type="button"
                            onClick={() => {
                              closeLoginModal();
                              navigate('/reset-password');
                            }}
                            className="text-[10px] font-bold text-orange-500 hover:text-orange-400 transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              autoComplete="current-password"
                              placeholder="••••••••"
                              className="h-11 pl-11 pr-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/20 gap-2 transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
                    disabled={isLoading || cooldownRemaining > 0}
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <LogIn className="size-4" />
                        Sign In
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}

            {/* MODE 2: REGISTER FORM */}
            {authMode === 'register' && (
              <Form {...registerForm}>
                <form onSubmit={handleAttemptRegisterSubmit} className="space-y-3.5 mt-5 animate-in fade-in duration-300">
                  {/* Last Name and First Name Inputs (Foolproof Name Basis) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={registerForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">
                            Last Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Dela Cruz"
                              className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">
                            First Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Juan"
                              className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">
                          University Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoComplete="email"
                            placeholder="202381234@psu.palawan.edu.ph"
                            className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showRegisterPassword ? "text" : "password"}
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500 pr-10"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-500 transition-colors cursor-pointer p-1 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
                              >
                                {showRegisterPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">Confirm</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showRegisterConfirmPassword ? "text" : "password"}
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500 pr-10"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                                aria-label={showRegisterConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-500 transition-colors cursor-pointer p-1 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
                              >
                                {showRegisterConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Real-time Password Policy & Password Match Feedback */}
                  <PasswordPolicyMeter
                    password={watchedRegPassword}
                    confirmPassword={watchedRegConfirmPassword}
                    className="mt-1"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={registerForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-bold">
                                <SelectValue placeholder="Select Role">
                                  {field.value === 'player_faculty'
                                    ? 'Faculty Athlete'
                                    : field.value === 'player_staff'
                                    ? 'Staff Athlete'
                                    : field.value === 'coach'
                                    ? 'Athletic Coach'
                                    : 'Student Athlete'}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-900 border-white/10 text-white font-bold text-xs rounded-xl">
                              <SelectItem value="player_student">Student Athlete</SelectItem>
                              <SelectItem value="player_faculty">Faculty Athlete</SelectItem>
                              <SelectItem value="player_staff">Staff Athlete</SelectItem>
                              <SelectItem value="coach">Athletic Coach</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="collegeId"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Department</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-bold truncate">
                                <SelectValue placeholder="College">
                                  {field.value && colleges.find((c) => c.id === field.value)?.college_name}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-900 border-white/10 text-white font-bold text-xs rounded-xl max-h-48">
                              {colleges.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.college_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {(registerForm.watch('role') === 'player_staff' || registerForm.watch('role') === 'player_faculty') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-300">
                      <FormField
                        control={registerForm.control}
                        name="employeeId"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                              Employee / Faculty ID
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="EMP-2024-0123"
                                className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                              Office Unit / Dept
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="HR, Registrar, etc."
                                className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Terms & Privacy Checkbox */}
                  <FormField
                    control={registerForm.control}
                    name="termsAccepted"
                    render={({ field }) => (
                      <FormItem className="space-y-1 pt-1.5">
                        <div className="flex items-start gap-2.5">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setIsMandatoryLegalModal(true);
                                  setShowLegalModal(true);
                                } else {
                                  field.onChange(false);
                                  setTermsAcceptedAt(null);
                                }
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-[11px] font-normal text-slate-300 cursor-pointer leading-relaxed block">
                              I agree to the{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setLegalModalTab('terms');
                                  setIsMandatoryLegalModal(true);
                                  setShowLegalModal(true);
                                }}
                                className="text-orange-400 hover:text-orange-300 underline font-semibold transition-colors cursor-pointer"
                              >
                                Terms &amp; Conditions
                              </button>
                              {' '}and{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setLegalModalTab('privacy');
                                  setIsMandatoryLegalModal(true);
                                  setShowLegalModal(true);
                                }}
                                className="text-orange-400 hover:text-orange-300 underline font-semibold transition-colors cursor-pointer"
                              >
                                Privacy Policy
                              </button>
                            </FormLabel>
                          </div>
                        </div>
                        <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/20 gap-2 transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <UserPlus className="size-4" />
                        Create Account
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}

            {/* MODE 3: OTP VERIFICATION */}
            {authMode === 'otp' && (
              <div className="mt-5 animate-in fade-in duration-300">
                <OtpVerificationStep
                  email={pendingOtpEmail}
                  role={pendingRole}
                  onBack={() => setAuthMode('register')}
                  onVerified={() => {
                    closeLoginModal();
                    setAuthMode('login');
                    const destination = pendingRole === 'coach' ? '/coach' : '/player';
                    navigate(destination, { replace: true });
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer Auth Mode Toggle Prompt */}
          {authMode !== 'otp' && (
            <div className="mt-5 pt-4 border-t border-white/5 space-y-2">
              <p className="text-xs font-normal text-slate-400 text-center">
                {authMode === 'login' ? (
                  <>
                    New to PSU SportsTrack?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className="text-orange-500 hover:text-orange-400 hover:underline font-bold transition-colors ml-1 cursor-pointer"
                    >
                      Create Account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-orange-500 hover:text-orange-400 hover:underline font-bold transition-colors ml-1 cursor-pointer"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </p>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                Protected by{' '}
                <button
                  type="button"
                  onClick={() => {
                    setLegalModalTab('terms');
                    setShowLegalModal(true);
                  }}
                  className="text-slate-400 hover:text-orange-400 underline transition-colors cursor-pointer"
                >
                  Terms of Service
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={() => {
                    setLegalModalTab('privacy');
                    setShowLegalModal(true);
                  }}
                  className="text-slate-400 hover:text-orange-400 underline transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Official Legal Documents Modal */}
      <LegalModal
        open={showLegalModal}
        onOpenChange={(open) => {
          setShowLegalModal(open);
          if (!open) setIsMandatoryLegalModal(false);
        }}
        defaultTab={legalModalTab}
        mandatoryAcceptance={isMandatoryLegalModal}
        onAccept={(timestamp) => {
          setTermsAcceptedAt(timestamp);
          registerForm.setValue('termsAccepted', true, { shouldValidate: true });
          setIsMandatoryLegalModal(false);
          const currentValues = registerForm.getValues();
          void onRegisterSubmit(currentValues, timestamp);
        }}
        onDecline={() => {
          setIsMandatoryLegalModal(false);
          toast.info('You must accept the Terms & Conditions and Privacy Policy to register.');
        }}
      />
    </>
  );
};
