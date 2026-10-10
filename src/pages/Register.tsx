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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const registerSchema = z.object({
  lastName: z.string().min(1, { message: 'Last name is required' }),
  firstName: z.string().min(1, { message: 'First name is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
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

export const Register = () => {
  const navigate = useNavigate();
  const { openLoginModal } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [colleges, setColleges] = useState<{ id: string; college_name: string }[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    supabase.from('colleges').select('id, college_name').then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const form = useForm<z.infer<typeof registerSchema>>({
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

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    setIsLoading(true);
    try {
      // 1. Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (authData.user) {
        // 2. Insert into public.users (Last Name, First Name basis)
        const formattedFullName = `${values.lastName.trim()}, ${values.firstName.trim()}`;
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          full_name: formattedFullName,
          role: values.role,
          college_id: values.collegeId || null,
        });

        if (profileError) {
          toast.error('Failed to create user profile: ' + profileError.message);
        } else {
          toast.success('Registration successful!');
          const rolePath = values.role === 'coach' ? '/coach' : '/player';
          window.location.href = rolePath;
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 bg-slate-900 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />

      <Card className="w-full max-w-lg bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl relative z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
        <CardHeader className="space-y-1.5 text-center pb-4 pt-7">
          <CardTitle className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase italic">
            CREATE AN <span className="text-orange-500">ACCOUNT</span>
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium uppercase text-[10px] tracking-[0.25em]">
            Register your official PSU Student, Coach, or Faculty profile
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
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
                          className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
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
                          className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
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
                        placeholder="202381234@psu.palawan.edu.ph"
                        {...field}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
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
                          {...field}
                          className="h-11 bg-white/5 border-white/10 text-white focus:ring-orange-500 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-500 transition-colors cursor-pointer p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
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
                          type={showPassword ? "text" : "password"}
                          {...field}
                          className="h-11 bg-white/5 border-white/10 text-white focus:ring-orange-500 rounded-xl"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                  </FormItem>
                )}
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
                          <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white rounded-xl">
                            <SelectValue placeholder="Select Role">
                              {field.value === 'player_faculty'
                                ? 'Faculty'
                                : field.value === 'coach'
                                ? 'Coach'
                                : 'Student'}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-800 border-white/10 text-white">
                          <SelectItem value="player_student">Student</SelectItem>
                          <SelectItem value="coach">Coach</SelectItem>
                          <SelectItem value="player_faculty">Faculty</SelectItem>
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
                          <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white rounded-xl">
                            <SelectValue placeholder="College">
                              {field.value && colleges.find((c) => c.id === field.value)?.college_name}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-800 border-white/10 text-white">
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

              {/* Terms & Privacy Checkbox */}
              <FormField
                control={form.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="space-y-1 pt-1">
                    <div className="flex items-start gap-2.5">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-[11px] sm:text-xs font-normal text-slate-300 cursor-pointer leading-relaxed block">
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
                    <FormMessage className="text-orange-500 text-[10px] font-bold uppercase ml-1" />
                  </FormItem>
                )}
              />

              <Button className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all active:scale-[0.98] mt-3" type="submit" disabled={isLoading}>
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
      </Card>

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
    </div>
  );
};
