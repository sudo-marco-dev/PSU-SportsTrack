import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { PasswordPolicyMeter } from '@/components/auth/PasswordPolicyMeter';
import { LegalModal } from '@/components/legal/LegalModal';
import { OtpVerificationStep } from '@/components/auth/OtpVerificationStep';
import { LEGAL_ACCEPTANCE_STORAGE_KEY, REGISTER_DRAFT_STORAGE_KEY } from '@/pages/Legal';
import { getFriendlyErrorMessage } from '@/lib/friendlyErrors';

const PSU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@psu\.palawan\.edu\.ph$/i;

const registerSchema = z.object({
  lastName: z.string().trim().min(1, { message: 'Last name is required' }),
  firstName: z.string().trim().min(1, { message: 'First name is required' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Invalid email address' })
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

export const Register = () => {
  const navigate = useNavigate();
  const { openLoginModal } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [colleges, setColleges] = useState<{ id: string; college_name: string }[]>([]);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab] = useState<'privacy' | 'terms'>('terms');
  const [isMandatoryLegalModal, setIsMandatoryLegalModal] = useState(false);
  const [shouldAutoSubmitAfterModal, setShouldAutoSubmitAfterModal] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    supabase.from('colleges').select('id, college_name').then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
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

  // Restore saved registration form draft & legal acceptance result when returning from /legal
  useEffect(() => {
    try {
      const rawDraft = sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (!draft.source || draft.source === 'register') {
          form.reset({
            lastName: draft.lastName ?? '',
            firstName: draft.firstName ?? '',
            email: draft.email ?? '',
            password: draft.password ?? '',
            confirmPassword: draft.confirmPassword ?? '',
            role: draft.role ?? 'player_student',
            collegeId: draft.collegeId ?? '',
            employeeId: draft.employeeId ?? '',
            department: draft.department ?? '',
            termsAccepted: Boolean(draft.termsAccepted),
          });
          if (draft.termsAcceptedAt) {
            setTermsAcceptedAt(draft.termsAcceptedAt);
          }
        }
      }

      const rawAcceptance = sessionStorage.getItem(LEGAL_ACCEPTANCE_STORAGE_KEY);
      if (rawAcceptance) {
        const result = JSON.parse(rawAcceptance);
        if (!result.from || result.from === 'register') {
          sessionStorage.removeItem(LEGAL_ACCEPTANCE_STORAGE_KEY);
          if (result.accepted) {
            const ts = result.timestamp || new Date().toISOString();
            setTermsAcceptedAt(ts);
            form.setValue('termsAccepted', true, { shouldValidate: true });
            toast.success('Terms & Conditions and Privacy Policy accepted.');
          } else if (!result.closedOnly) {
            setTermsAcceptedAt(null);
            form.setValue('termsAccepted', false, { shouldValidate: false });
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [form]);

  const handleSaveDraftAndNavigateToLegal = (tab: 'terms' | 'privacy') => {
    try {
      const currentValues = form.getValues();
      sessionStorage.setItem(
        REGISTER_DRAFT_STORAGE_KEY,
        JSON.stringify({
          ...currentValues,
          termsAcceptedAt,
          source: 'register',
          returnTo: '/register',
        })
      );
    } catch {
      // ignore storage error
    }
    navigate(`/legal?mode=accept&from=register&tab=${tab}`);
  };

  const watchedPassword = form.watch('password');
  const watchedConfirmPassword = form.watch('confirmPassword');

  async function onSubmit(values: z.infer<typeof registerSchema>, acceptedTimestamp?: string) {
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
        toast.error(getFriendlyErrorMessage(authError));
        return;
      }

      if (authData.user) {
        sessionStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
        sessionStorage.removeItem(LEGAL_ACCEPTANCE_STORAGE_KEY);
        // If email confirmation is required, authData.session is null
        if (!authData.session) {
          setPendingVerification({
            email: cleanEmail,
            role: values.role,
          });
          toast.info('Verification code sent! Enter the OTP or click the confirmation link to activate your account.');
          return;
        }

        // Direct session fallback (e.g. if email confirmation is disabled in development)
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
        const rolePath = values.role === 'coach' ? '/coach' : '/player';
        navigate(rolePath, { replace: true });
      }
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err, 'An unexpected error occurred during registration. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  const handleAttemptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.getValues('termsAccepted')) {
      const isFieldsValid = await form.trigger([
        'lastName',
        'firstName',
        'email',
        'password',
        'confirmPassword',
        'role',
        'collegeId',
      ]);
      if (!isFieldsValid) return;
      setShouldAutoSubmitAfterModal(true);
      setIsMandatoryLegalModal(true);
      setShowLegalModal(true);
      return;
    }
    await form.handleSubmit((vals) => onSubmit(vals, termsAcceptedAt || new Date().toISOString()))(e);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-3 xs:p-4 bg-slate-900 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />

      <Card className="w-full max-w-lg bg-white/5 backdrop-blur-xl border-white/15 shadow-2xl relative z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />

        {pendingVerification ? (
          <CardContent className="p-5 xs:p-6 sm:p-8 pt-7">
            <OtpVerificationStep
              email={pendingVerification.email}
              role={pendingVerification.role}
              onBack={() => setPendingVerification(null)}
              onVerified={() => {
                const rolePath = pendingVerification.role === 'coach' ? '/coach' : '/player';
                navigate(rolePath, { replace: true });
              }}
            />
          </CardContent>
        ) : (
          <>
            <CardHeader className="space-y-1.5 text-center pb-3 pt-5 sm:pt-7 px-4 sm:px-6">
              <CardTitle className="text-2xl xs:text-3xl sm:text-4xl font-black tracking-tight text-white uppercase italic">
                CREATE AN <span className="text-orange-500">ACCOUNT</span>
              </CardTitle>
              <CardDescription className="text-slate-400 font-medium uppercase text-[10px] tracking-[0.2em] sm:tracking-[0.25em]">
                Register your official PSU Student, Coach, or Faculty profile
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 xs:px-6 sm:px-8">
              <Form {...form}>
                <form onSubmit={handleAttemptSubmit} className="space-y-3.5">
                  {/* Last Name & First Name Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            Last Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Dela Cruz"
                              {...field}
                              className="h-11 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
                            />
                          </FormControl>
                          <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            First Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Juan"
                              {...field}
                              className="h-11 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
                            />
                          </FormControl>
                          <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
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
                            {...field}
                            className="h-11 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
                          />
                        </FormControl>
                        <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Security Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              autoComplete="new-password"
                              {...field}
                              className="h-11 bg-white/5 border-white/15 text-white focus:ring-orange-500 rounded-xl pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors cursor-pointer p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              autoComplete="new-password"
                              {...field}
                              className="h-11 bg-white/5 border-white/15 text-white focus:ring-orange-500 rounded-xl pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors cursor-pointer p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                      </FormItem>
                    )}
                  />

                  {/* Real-time Password Policy & Real-time Matching Meter */}
                  <PasswordPolicyMeter
                    password={watchedPassword}
                    confirmPassword={watchedConfirmPassword}
                    className="mt-1"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-white/5 border-white/15 text-white rounded-xl">
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
                            <SelectContent className="bg-slate-800 border-white/15 text-white">
                              <SelectItem value="player_student">Student Athlete</SelectItem>
                              <SelectItem value="player_faculty">Faculty Athlete</SelectItem>
                              <SelectItem value="player_staff">Staff Athlete</SelectItem>
                              <SelectItem value="coach">Athletic Coach</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="collegeId"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Department</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-white/5 border-white/15 text-white rounded-xl">
                                <SelectValue placeholder="College">
                                  {field.value && colleges.find((c) => c.id === field.value)?.college_name}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-800 border-white/15 text-white">
                              {colleges.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.college_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {(form.watch('role') === 'player_staff' || form.watch('role') === 'player_faculty') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-300">
                      <FormField
                        control={form.control}
                        name="employeeId"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                              Employee / Faculty ID
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. EMP-2024-0123"
                                {...field}
                                className="h-11 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
                              />
                            </FormControl>
                            <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                              Department / Office Unit
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. HR, Registrar, ICTD"
                                {...field}
                                className="h-11 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
                              />
                            </FormControl>
                            <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Terms & Privacy Checkbox */}
                  <FormField
                    control={form.control}
                    name="termsAccepted"
                    render={({ field }) => (
                      <FormItem className="space-y-1 pt-1">
                        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/15">
                          <FormControl>
                            <Checkbox
                              data-testid="register-terms-checkbox"
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  handleSaveDraftAndNavigateToLegal('terms');
                                } else {
                                  field.onChange(false);
                                  setTermsAcceptedAt(null);
                                  try {
                                    const rawDraft = sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
                                    if (rawDraft) {
                                      const parsed = JSON.parse(rawDraft);
                                      sessionStorage.setItem(
                                        REGISTER_DRAFT_STORAGE_KEY,
                                        JSON.stringify({
                                          ...parsed,
                                          termsAccepted: false,
                                          termsAcceptedAt: null,
                                        })
                                      );
                                    }
                                  } catch {
                                    // ignore storage error
                                  }
                                }
                              }}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-[11px] sm:text-xs font-normal text-slate-200 cursor-pointer leading-relaxed block">
                              I agree to the{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleSaveDraftAndNavigateToLegal('terms');
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
                                  handleSaveDraftAndNavigateToLegal('privacy');
                                }}
                                className="text-orange-400 hover:text-orange-300 underline font-semibold transition-colors cursor-pointer"
                              >
                                Privacy Policy
                              </button>
                            </FormLabel>
                          </div>
                        </div>
                        <FormMessage className="text-orange-500 text-[10px] font-bold uppercase ml-1" />
                      </FormItem>
                    )}
                  />

                  <Button className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all active:scale-[0.98] mt-3 cursor-pointer" type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating Profile...' : 'Complete Registration'}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2 text-center pb-6 pt-3 bg-transparent border-t-0">
              <div className="text-slate-400 text-xs font-medium">
                Already a member?{' '}
                <button
                  type="button"
                  onClick={() => {
                    navigate('/');
                    openLoginModal();
                  }}
                  className="text-orange-400 hover:text-orange-300 transition-colors font-semibold underline underline-offset-4 cursor-pointer ml-1"
                >
                  Sign in
                </button>
              </div>
            </CardFooter>
          </>
        )}
      </Card>

      {/* Official Legal Documents Modal */}
      <LegalModal
        open={showLegalModal}
        onOpenChange={(open) => {
          setShowLegalModal(open);
          if (!open) {
            setIsMandatoryLegalModal(false);
            setShouldAutoSubmitAfterModal(false);
          }
        }}
        defaultTab={legalModalTab}
        mandatoryAcceptance={isMandatoryLegalModal}
        onReadFullPage={(tab) => {
          setShowLegalModal(false);
          handleSaveDraftAndNavigateToLegal(tab);
        }}
        onAccept={(timestamp) => {
          setTermsAcceptedAt(timestamp);
          form.setValue('termsAccepted', true, { shouldValidate: true });
          setIsMandatoryLegalModal(false);
          if (shouldAutoSubmitAfterModal) {
            setShouldAutoSubmitAfterModal(false);
            const currentValues = form.getValues();
            void onSubmit(currentValues, timestamp);
          }
        }}
        onDecline={() => {
          setIsMandatoryLegalModal(false);
          setShouldAutoSubmitAfterModal(false);
          toast.info('You must accept the Terms & Conditions and Privacy Policy to register.');
        }}
      />
    </div>
  );
};
