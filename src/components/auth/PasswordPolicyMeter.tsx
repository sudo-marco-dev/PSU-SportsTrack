import React from 'react';
import { Check, X, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { checkPasswordPolicy, checkPasswordMatch } from '@/lib/passwordPolicy';

interface PasswordPolicyMeterProps {
  password?: string;
  confirmPassword?: string;
  showMatchStatus?: boolean;
  className?: string;
}

export const PasswordPolicyMeter: React.FC<PasswordPolicyMeterProps> = ({
  password = '',
  confirmPassword,
  showMatchStatus = true,
  className = '',
}) => {
  const policy = checkPasswordPolicy(password);
  const matchStatus = confirmPassword !== undefined ? checkPasswordMatch(password, confirmPassword) : 'idle';

  // Determine strength bar color
  const getBarColor = () => {
    switch (policy.strength) {
      case 'strong':
        return 'bg-emerald-500';
      case 'good':
        return 'bg-blue-500';
      case 'fair':
        return 'bg-amber-500';
      case 'weak':
        return 'bg-rose-500';
      default:
        return 'bg-slate-700';
    }
  };

  const getTextColor = () => {
    switch (policy.strength) {
      case 'strong':
        return 'text-emerald-400';
      case 'good':
        return 'text-blue-400';
      case 'fair':
        return 'text-amber-400';
      case 'weak':
        return 'text-rose-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className={`space-y-2.5 rounded-xl border border-white/10 bg-slate-950/60 p-3 backdrop-blur-md text-xs ${className}`}>
      {/* Strength Bar & Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="size-3.5 text-orange-500" />
            <span>Password Security Policy</span>
          </div>
          {password && (
            <span className={`transition-colors duration-200 ${getTextColor()}`}>
              {policy.strengthLabel} ({policy.score}/5)
            </span>
          )}
        </div>

        {/* 5-segment progress bar */}
        <div className="grid grid-cols-5 gap-1 h-1.5 w-full">
          {[1, 2, 3, 4, 5].map((index) => {
            const isFilled = policy.score >= index;
            return (
              <div
                key={index}
                className={`h-full rounded-full transition-all duration-300 ${
                  isFilled ? getBarColor() : 'bg-slate-800'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Criteria Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
        {policy.criteria.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-1.5 transition-colors duration-200 ${
              item.passed ? 'text-emerald-400 font-medium' : 'text-slate-400'
            }`}
          >
            {item.passed ? (
              <Check className="size-3 text-emerald-400 shrink-0 stroke-[3]" />
            ) : (
              <X className="size-3 text-slate-600 shrink-0 stroke-[2]" />
            )}
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Real-time Match Feedback */}
      {showMatchStatus && confirmPassword !== undefined && confirmPassword.length > 0 && (
        <div className="pt-2 border-t border-white/5">
          {matchStatus === 'match' ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
              <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
              <span>Passwords match</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg">
              <AlertCircle className="size-3.5 text-rose-400 shrink-0" />
              <span>Passwords do not match yet</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
