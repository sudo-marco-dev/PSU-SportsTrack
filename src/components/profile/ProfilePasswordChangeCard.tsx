import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PasswordPolicyMeter } from '@/components/auth/PasswordPolicyMeter';
import { checkPasswordPolicy, checkPasswordMatch } from '@/lib/passwordPolicy';
import { toast } from 'sonner';

interface ProfilePasswordChangeCardProps {
  className?: string;
}

export const ProfilePasswordChangeCard: React.FC<ProfilePasswordChangeCardProps> = ({ className = '' }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const policy = checkPasswordPolicy(newPassword);
  const matchStatus = checkPasswordMatch(newPassword, confirmPassword);
  const canSubmit = policy.isValid && matchStatus === 'match' && !isUpdating;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message || 'Failed to update password.');
        return;
      }

      toast.success('Password updated successfully! Your account credentials have been refreshed.');
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: any) {
      console.error('[ProfilePasswordChange] Error:', err);
      toast.error('An unexpected error occurred while updating your password.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className={`border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm bg-white dark:bg-slate-900 ${className}`}>
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-start gap-2.5 text-slate-900 dark:text-white">
          <KeyRound className="size-5 text-orange-500 shrink-0 mt-0.5" />
          <span>Security &amp; Password</span>
        </CardTitle>
        <CardDescription className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
          Update account password directly without logging out
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {/* New Password Field */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-new-password" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="profile-new-password"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter new strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isUpdating}
                className="h-11 pr-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-confirm-password" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="profile-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter new password to confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isUpdating}
                className="h-11 pr-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Real-Time Password Policy Meter */}
          {(newPassword || confirmPassword) && (
            <PasswordPolicyMeter
              password={newPassword}
              confirmPassword={confirmPassword}
              showMatchStatus={true}
            />
          )}

          {/* Submit Action */}
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs h-11 px-6 rounded-xl shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
