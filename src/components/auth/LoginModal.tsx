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
  UserPlus
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

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

const registerSchema = z.object({
  lastName: z.string().min(1, { message: 'Last name is required' }),
  firstName: z.string().min(1, { message: 'First name is required' }),
  email: z.string().email({ message: 'Invalid university email' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  role: z.enum(['player_student', 'player_faculty', 'coach'] as const, { message: 'Role is required' }),
  collegeId: z.string().optional(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms & Conditions and Privacy Policy',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const LoginModal = () => {
  const { isLoginModalOpen, closeLoginModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [, setFailedAttempts] = useState<number>(0);
  const [colleges, setColleges] = useState<{ id: string; college_name: string }[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

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
      termsAccepted: false,
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
      const now = Date.now(); // eslint-disable-line react-hooks/purity
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
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        const currentAttempts = parseInt(localStorage.getItem('login_attempts') || '0', 10) + 1;
        const maxAttempts = 3;
        setFailedAttempts(currentAttempts);

        if (currentAttempts >= maxAttempts) {
          const lockTimeMs = 5 * 60 * 1000;
          const lockUntil = Date.now() + lockTimeMs; // eslint-disable-line react-hooks/purity
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
            } else if (userRole === 'super_admin' || userRole === 'Admin') {
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
        // 2. Insert profile into users table (Last Name, First Name basis)
        const formattedFullName = `${values.lastName.trim()}, ${values.firstName.trim()}`;
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          full_name: formattedFullName,
          email: values.email.trim(),
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
    } catch {
      toast.error('An unexpected error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Dialog open={isLoginModalOpen} onOpenChange={(open) => { if (!open) closeLoginModal(); }}>
        <DialogContent className="w-full max-w-[94vw] sm:max-w-md md:max-w-lg p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl bg-slate-950 text-white relative max-h-[92vh] overflow-y-auto">
          <div>
            {/* Header Badge */}
            <div className="flex items-center mb-5 sm:mb-6">
              <div className="size-11 sm:size-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shadow-sm">
                {authMode === 'login' ? <Trophy className="size-5 sm:size-6" /> : <UserPlus className="size-5 sm:size-6" />}
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
                ) : (
                  <>Create <span className="text-orange-500">Account</span></>
                )}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-normal mt-1.5 leading-relaxed">
                {authMode === 'login'
                  ? 'Enter your university email and password to access your dashboard.'
                  : 'Register your official student, coach, or faculty profile to access PSU tournaments.'}
              </DialogDescription>
            </div>

            {/* Lockout Banner */}
            {authMode === 'login' && cooldownRemaining > 0 && (
              <div className="mt-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                <AlertCircle className="size-5 text-red-400 shrink-0" />
                <div className="text-xs text-red-200 font-medium">
                  Account locked. Cooldown: <span className="font-mono text-red-400 font-bold">{Math.floor(cooldownRemaining / 60)}m {cooldownRemaining % 60}s</span>
                </div>
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
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-3.5 mt-5 animate-in fade-in duration-300">
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
                            <Input
                              type="password"
                              placeholder="••••••••"
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
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">Confirm</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-orange-500"
                              {...field}
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-10 sm:h-11 bg-slate-900 border-white/10 text-white rounded-xl text-xs font-bold">
                                <SelectValue placeholder="Select Role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-900 border-white/10 text-white font-bold text-xs rounded-xl">
                              <SelectItem value="player_student">Student Athlete</SelectItem>
                              <SelectItem value="player_faculty">Faculty Athlete</SelectItem>
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
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-[11px] font-normal text-slate-300 cursor-pointer leading-relaxed block">
                              I agree to the{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setShowTermsModal(true);
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
                                  setShowPrivacyModal(true);
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
          </div>

          {/* Footer Auth Mode Toggle Prompt */}
          <div className="mt-5 pt-4 border-t border-white/5">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Terms & Conditions Draft Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-[92vw] sm:max-w-lg rounded-2xl sm:rounded-3xl p-6 bg-slate-950 text-white border border-white/10 max-h-[85vh] overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Governance Draft</span>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white">
              Terms &amp; Conditions
            </DialogTitle>
            <div className="text-slate-300 text-xs sm:text-sm space-y-3 leading-relaxed border-t border-white/10 pt-3">
              <p>
                <strong>1. Acceptance of Terms:</strong> By registering and using PSU SportsTrack, student-athletes, coaches, and university officials agree to abide by the university athletic policies and student code of conduct.
              </p>
              <p>
                <strong>2. Academic &amp; Athletic Eligibility:</strong> All registered participants must be officially enrolled or employed at Palawan State University and maintain university athletic eligibility standards.
              </p>
              <p>
                <strong>3. Sportsmanship &amp; Integrity:</strong> Foul play, falsification of game statistics, or unsportsmanlike behavior will result in disqualification from university tournaments.
              </p>
              <p className="text-[11px] text-slate-500 italic pt-2 border-t border-white/5">
                Note: Official legal terms are currently being drafted by the Palawan State University Sports Governance Board.
              </p>
            </div>
            <div className="pt-2 flex justify-end">
              <Button 
                onClick={() => setShowTermsModal(false)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-9 px-4 rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Draft Modal */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="max-w-[92vw] sm:max-w-lg rounded-2xl sm:rounded-3xl p-6 bg-slate-950 text-white border border-white/10 max-h-[85vh] overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Data Privacy Notice</span>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white">
              Privacy Policy
            </DialogTitle>
            <div className="text-slate-300 text-xs sm:text-sm space-y-3 leading-relaxed border-t border-white/10 pt-3">
              <p>
                <strong>1. Information We Collect:</strong> We collect student/faculty names, institutional email addresses, campus colleges, and athletic performance records for the purpose of tournament management.
              </p>
              <p>
                <strong>2. Use of Information:</strong> Profile information and match statistics are displayed publicly across leaderboards, tournament rosters, and official match records.
              </p>
              <p>
                <strong>3. Data Security:</strong> University credentials and account data are secured in accordance with PSU IT data governance standards. We do not share personal information with unauthorized third parties.
              </p>
              <p className="text-[11px] text-slate-500 italic pt-2 border-t border-white/5">
                Note: Official privacy policy details are currently being drafted in accordance with university compliance requirements.
              </p>
            </div>
            <div className="pt-2 flex justify-end">
              <Button 
                onClick={() => setShowPrivacyModal(false)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-9 px-4 rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
