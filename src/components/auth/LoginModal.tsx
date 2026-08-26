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
  ShieldCheck, 
  Activity, 
  CheckCircle2, 
  Sparkles, 
  Star, 
  ChevronRight,
  User,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Building,
  Check
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
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

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

const registerSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name is required' }),
  email: z.string().email({ message: 'Invalid university email' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  role: z.enum(['Player', 'Coach'] as const, { message: 'Role is required' }),
  collegeId: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const LoginModal = () => {
  const { isLoginModalOpen, closeLoginModal } = useAuth();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [colleges, setColleges] = useState<{ id: string; college_name: string }[]>([]);

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
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'Player',
      collegeId: '',
    },
  });

  useEffect(() => {
    supabase.from('colleges').select('id, college_name').then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  useEffect(() => {
    const checkCooldown = () => {
      const attempts = parseInt(localStorage.getItem('login_attempts') || '0', 10);
      setFailedAttempts(attempts);

      const lockUntilStr = localStorage.getItem('login_lockout_until');
      if (lockUntilStr) {
        const lockUntil = parseInt(lockUntilStr, 10);
        const now = Date.now();
        if (now < lockUntil) {
          setCooldownRemaining(Math.ceil((lockUntil - now) / 1000));
        } else {
          localStorage.removeItem('login_lockout_until');
          localStorage.removeItem('login_attempts');
          setCooldownRemaining(0);
          setFailedAttempts(0);
        }
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    const lockUntilStr = localStorage.getItem('login_lockout_until');
    if (lockUntilStr) {
      const lockUntil = parseInt(lockUntilStr, 10);
      const now = Date.now();
      if (now < lockUntil) {
        const remainingSeconds = Math.ceil((lockUntil - now) / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        toast.error(`Too many failed attempts. Please try again in ${minutes}m ${seconds}s.`);
        return;
      } else {
        localStorage.removeItem('login_lockout_until');
        localStorage.removeItem('login_attempts');
        setCooldownRemaining(0);
        setFailedAttempts(0);
      }
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        const currentAttempts = parseInt(localStorage.getItem('login_attempts') || '0', 10) + 1;
        const maxAttempts = 3;
        setFailedAttempts(currentAttempts);

        if (currentAttempts >= maxAttempts) {
          const lockTimeMs = 5 * 60 * 1000;
          const lockUntil = Date.now() + lockTimeMs;
          localStorage.setItem('login_lockout_until', lockUntil.toString());
          localStorage.setItem('login_attempts', currentAttempts.toString());
          setCooldownRemaining(300);
          toast.error('Too many failed attempts (3/3). Account temporarily locked for 5 minutes.');
        } else {
          localStorage.setItem('login_attempts', currentAttempts.toString());
          const remainingAttempts = maxAttempts - currentAttempts;
          toast.error(`${error.message} (${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining)`);
        }
      } else {
        localStorage.removeItem('login_attempts');
        localStorage.removeItem('login_lockout_until');
        setFailedAttempts(0);
        toast.success('Logged in successfully! Welcome back.');
        loginForm.reset();
        closeLoginModal();
      }
    } catch (error) {
      toast.error('An unexpected error occurred during login');
    } finally {
      setIsLoading(false);
    }
  }

  async function onRegisterSubmit(values: z.infer<typeof registerSchema>) {
    setIsLoading(true);
    try {
      // 1. Sign up user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (authData.user) {
        // 2. Insert profile into users table
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          full_name: values.fullName,
          role: values.role,
          college_id: values.collegeId || null,
        });

        if (profileError) {
          toast.error('Failed to create user profile: ' + profileError.message);
        } else {
          toast.success('Registration successful! Welcome to PSU SportsTrack.');
          registerForm.reset();
          closeLoginModal();
          window.location.reload();
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isLoginModalOpen} onOpenChange={(open) => { if (!open) closeLoginModal(); }}>
      <DialogContent className="w-full sm:max-w-5xl lg:max-w-6xl max-w-[96vw] min-h-[680px] max-h-[92vh] overflow-y-auto rounded-[2.5rem] md:rounded-[3rem] border border-white/10 p-0 shadow-2xl bg-slate-950 text-white relative">
        <div className={`flex flex-col lg:flex-row min-h-[680px] w-full transition-all duration-700 ease-in-out ${
          authMode === 'register' ? 'lg:flex-row-reverse' : ''
        }`}>
          {/* FORM PANEL (SIGN IN / SIGN UP) */}
          <div className={`w-full lg:w-5/12 p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-between bg-slate-950 border-white/5 transition-all duration-700 ease-in-out ${
            authMode === 'login' ? 'border-r' : 'border-l'
          }`}>
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between mb-6">
                <div className="size-11 sm:size-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/20">
                  {authMode === 'login' ? <Trophy className="size-6" /> : <UserPlus className="size-6" />}
                </div>

                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-xs font-black uppercase tracking-wider text-orange-500 hover:text-orange-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 transition-all hover:scale-105"
                >
                  {authMode === 'login' ? (
                    <><span>Create Account</span> <ArrowRight className="size-3.5" /></>
                  ) : (
                    <><ArrowLeft className="size-3.5" /> <span>Back to Sign In</span></>
                  )}
                </button>
              </div>

              {/* Title & Description */}
              <div className="animate-in fade-in duration-300">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 block mb-1">
                  PALAWAN STATE UNIVERSITY
                </span>
                <DialogTitle className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white leading-none">
                  {authMode === 'login' ? (
                    <>Sign In <span className="text-orange-500">Portal</span></>
                  ) : (
                    <>Create <span className="text-orange-500">Account</span></>
                  )}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs font-medium mt-2 leading-relaxed">
                  {authMode === 'login' 
                    ? 'Enter your university email and password to access your dashboard.' 
                    : 'Register your official athlete or coach profile to join tournament rosters.'}
                </DialogDescription>
              </div>

              {/* Lockout Banner */}
              {authMode === 'login' && cooldownRemaining > 0 && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="size-5 text-red-400 shrink-0" />
                  <div className="text-xs text-red-200 font-bold">
                    Account locked. Cooldown: <span className="font-mono text-red-400 font-black">{Math.floor(cooldownRemaining / 60)}m {cooldownRemaining % 60}s</span>
                  </div>
                </div>
              )}

              {/* MODE 1: SIGN IN FORM */}
              {authMode === 'login' && (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4 mt-6 animate-in fade-in duration-300">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                              <Input
                                placeholder="athlete@psu.edu.ph"
                                type="email"
                                className="h-12 sm:h-13 pl-11 bg-slate-900 border-white/10 rounded-2xl font-bold text-sm text-white placeholder:text-slate-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                                {...field}
                                disabled={isLoading || cooldownRemaining > 0}
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
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Password</FormLabel>
                            <button
                              type="button"
                              onClick={() => {
                                closeLoginModal();
                                navigate('/reset-password');
                              }}
                              className="text-[10px] font-black uppercase tracking-wider text-orange-500 hover:underline transition-colors"
                            >
                              Forgot Password?
                            </button>
                          </div>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                              <Input
                                placeholder="••••••••"
                                type={showPassword ? 'text' : 'password'}
                                className="h-12 sm:h-13 pl-11 pr-11 bg-slate-900 border-white/10 rounded-2xl font-bold text-sm text-white placeholder:text-slate-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                                {...field}
                                disabled={isLoading || cooldownRemaining > 0}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
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
                      className="w-full h-13 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-[0.1em] text-sm sm:text-base rounded-2xl shadow-xl shadow-orange-500/20 gap-2 transition-all hover:scale-[1.01] active:scale-95 disabled:grayscale mt-2"
                      disabled={isLoading || cooldownRemaining > 0}
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <LogIn className="size-5" />
                          Sign In to SportsTrack
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              )}

              {/* MODE 2: SIGN UP FORM */}
              {authMode === 'register' && (
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-3.5 mt-5 animate-in fade-in duration-300">
                    <FormField
                      control={registerForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Full Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Juan Dela Cruz"
                              className="h-11 bg-slate-900 border-white/10 rounded-xl font-bold text-xs text-white placeholder:text-slate-600 focus:border-orange-500 outline-none transition-all"
                              {...field}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">University Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="202381234@psu.palawan.edu.ph"
                              type="email"
                              className="h-11 bg-slate-900 border-white/10 rounded-xl font-bold text-xs text-white placeholder:text-slate-600 focus:border-orange-500 outline-none transition-all"
                              {...field}
                              disabled={isLoading}
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
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Password</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="••••••••"
                                type={showPassword ? 'text' : 'password'}
                                className="h-11 bg-slate-900 border-white/10 rounded-xl font-bold text-xs text-white focus:border-orange-500 outline-none transition-all"
                                {...field}
                                disabled={isLoading}
                              />
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
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Confirm</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="••••••••"
                                type={showPassword ? 'text' : 'password'}
                                className="h-11 bg-slate-900 border-white/10 rounded-xl font-bold text-xs text-white focus:border-orange-500 outline-none transition-all"
                                {...field}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage className="text-[10px] font-bold text-red-400 ml-1" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={registerForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Role</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-bold">
                                  <SelectValue placeholder="Role">{field.value}</SelectValue>
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-900 border-white/10 text-white font-bold text-xs rounded-xl">
                                <SelectItem value="Player">Player</SelectItem>
                                <SelectItem value="Coach">Coach</SelectItem>
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
                                <SelectTrigger className="h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-bold truncate">
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

                    <Button
                      type="submit"
                      className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-[0.1em] text-xs sm:text-sm rounded-xl shadow-xl shadow-orange-500/20 gap-2 transition-all hover:scale-[1.01] active:scale-95 disabled:grayscale mt-2"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <UserPlus className="size-4" />
                          Complete Registration
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </div>

            {/* Footer Auth Mode Toggle Prompt */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <p className="text-xs font-bold text-slate-400 text-center">
                {authMode === 'login' ? (
                  <>
                    New to PSU SportsTrack?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className="text-orange-500 hover:underline font-black uppercase italic tracking-wider transition-colors ml-1"
                    >
                      Create Account →
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-orange-500 hover:underline font-black uppercase italic tracking-wider transition-colors ml-1"
                    >
                      Sign In Now →
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* SHOWCASE INFO PANEL */}
          <div className="w-full lg:w-7/12 p-6 sm:p-8 md:p-10 lg:p-12 bg-slate-900/90 flex flex-col justify-between relative overflow-hidden transition-all duration-700 ease-in-out">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="size-2.5 rounded-full bg-orange-500 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500">
                  Official Athletic Management Platform
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black italic uppercase tracking-tight text-white leading-tight mb-3 sm:mb-4">
                DIGITAL ARENA FOR <span className="text-orange-500">PSU ATHLETICS</span> & COMPETITIONS
              </h3>

              <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed mb-6 sm:mb-8">
                PSU SportsTrack connects student-athletes, coaches, and university athletic administrators in an integrated digital hub for campus sports, live scores, and official tournament records.
              </p>

              {/* Website Info Cards */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-slate-950 border border-white/5 hover:border-orange-500/30 transition-all group">
                  <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                    <Activity className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-black uppercase italic text-xs sm:text-sm text-white tracking-tight flex items-center justify-between">
                      Live Matchroom & Real-Time Tracking
                      <ChevronRight className="size-4 text-slate-600 group-hover:text-orange-500 transition-colors" />
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5 leading-relaxed">
                      Instant point scoring, live referee play-by-play events, and public leaderboard streams across all campus disciplines.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-slate-950 border border-white/5 hover:border-orange-500/30 transition-all group">
                  <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                    <Trophy className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-black uppercase italic text-xs sm:text-sm text-white tracking-tight flex items-center justify-between">
                      Tournament Arena & Bracket Seeding
                      <ChevronRight className="size-4 text-slate-600 group-hover:text-orange-500 transition-colors" />
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5 leading-relaxed">
                      Automated single-elimination trees, round-robin pools, match venue slotting, and official admin result verification.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-slate-950 border border-white/5 hover:border-orange-500/30 transition-all group">
                  <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                    <Star className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-black uppercase italic text-xs sm:text-sm text-white tracking-tight flex items-center justify-between">
                      Roster Verification & Hall of Fame MVPs
                      <ChevronRight className="size-4 text-slate-600 group-hover:text-orange-500 transition-colors" />
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5 leading-relaxed">
                      Verified team application screening, eligibility badges, and Gold/Red Star MVP honors on athlete profiles.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Info Badges */}
            <div className="flex flex-wrap items-center gap-2.5 pt-4 sm:pt-6 mt-6 sm:mt-8 border-t border-white/5">
              <span className="px-3.5 py-1.5 bg-slate-950 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-orange-500" /> Real-time Scores
              </span>
              <span className="px-3.5 py-1.5 bg-slate-950 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-orange-500" /> Verified PSU Athletes
              </span>
              <span className="px-3.5 py-1.5 bg-slate-950 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-orange-500" /> Official Brackets
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
