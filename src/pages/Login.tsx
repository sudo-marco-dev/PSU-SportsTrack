import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Trophy } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export const Login = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Logged in successfully');
        navigate('/');
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
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />

      <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl relative z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
        <CardHeader className="space-y-2 text-center pb-8 pt-10">
          <div className="mx-auto w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center rotate-3 mb-4 shadow-lg shadow-orange-500/20">
            <Trophy className="text-white size-10" />
          </div>
          <CardTitle className="text-4xl font-black tracking-tighter text-white italic uppercase">
            PSU <span className="text-orange-500">BEARCATS</span>
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium uppercase text-[10px] tracking-[0.3em]">
            Official Sports Tracking Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="202381234@psu.palawan.edu.ph"
                        {...field}
                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-orange-500 rounded-xl"
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
                    <FormLabel className="text-xs font-black uppercase text-slate-400 tracking-widest">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          {...field}
                          className="h-12 bg-white/5 border-white/10 text-white focus:ring-orange-500 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-500 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-orange-500 text-[10px] font-bold uppercase" />
                  </FormItem>
                )}
              />
              <Button className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] mt-4" type="submit" disabled={isLoading}>
                {isLoading ? 'Processing Access...' : 'Sign In To Portal'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 text-center pb-10 pt-4 bg-transparent border-t-0">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            Don't have an account?{' '}
            <Link to="/register" className="text-orange-500 hover:text-orange-400 transition-colors font-black underline underline-offset-4">
              Join The Roster
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
