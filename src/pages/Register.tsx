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
import { toast } from 'sonner';

const registerSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  role: z.enum(['player_student', 'player_faculty', 'coach', 'Player', 'Coach'] as const, { message: 'Role is required' }),
  collegeId: z.string().optional(),
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



  useEffect(() => {
    supabase.from('colleges').select('id, college_name').then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'player_student',
      collegeId: '',
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
        // 2. Insert into public.users
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          full_name: values.fullName,
          role: values.role,
          college_id: values.collegeId || null,
        });

        if (profileError) {
          toast.error('Failed to create user profile: ' + profileError.message);
        } else {
          toast.success('Registration successful!');
          // Hard redirect to force AuthContext to pick up the new profile
          window.location.href = '/';
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-900 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />

      <Card className="w-full max-w-lg bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl relative z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
        <CardHeader className="space-y-1.5 text-center pb-4 pt-7">
          <CardTitle className="text-3xl font-black tracking-tight text-white uppercase">
            CREATE AN <span className="text-orange-500">ACCOUNT</span>
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium uppercase text-[10px] tracking-[0.25em]">
            Register your official PSU Student, Coach, or Faculty profile
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Juan Dela Cruz"
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
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">University Email</FormLabel>
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
                                : field.value === 'coach' || field.value === 'Coach'
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
    </div>
  );
};
