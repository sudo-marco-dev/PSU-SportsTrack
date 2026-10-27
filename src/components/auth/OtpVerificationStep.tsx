import { useState, useEffect, useRef, useId } from 'react';
import { Mail, CheckCircle2, ArrowLeft, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface OtpVerificationStepProps {
  email: string;
  role?: string;
  onVerified: () => void;
  onBack: () => void;
  className?: string;
}

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 8;

export const OtpVerificationStep = ({
  email,
  onVerified,
  onBack,
  className = '',
}: OtpVerificationStepProps) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const baseInputId = useId();

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Reactive listener: if user verifies via the email link on another device or tab
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
        session?.user?.email?.toLowerCase() === email.toLowerCase()
      ) {
        toast.success('Email confirmed successfully! Welcome to PSU SportsTrack.');
        onVerified();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [email, onVerified]);

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric input
    const cleaned = value.replace(/\D/g, '');
    setErrorMessage(null);

    if (!cleaned) {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    // Single digit input
    const newDigits = [...digits];
    newDigits[index] = cleaned[cleaned.length - 1]; // take last typed digit
    setDigits(newDigits);

    // Auto-advance focus
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else {
      // Auto-submit when all digits are filled
      const fullOtp = newDigits.join('');
      if (fullOtp.length === OTP_LENGTH) {
        verifyCode(fullOtp);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back and clear previous
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pastedData) return;

    const newDigits = [...digits];
    for (let i = 0; i < OTP_LENGTH; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setDigits(newDigits);

    // Focus corresponding input
    const nextEmptyIndex = newDigits.findIndex((d) => d === '');
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      if (pastedData.length === OTP_LENGTH || pastedData.length === 6) {
        verifyCode(pastedData);
      }
    }
  };

  const verifyCode = async (otpCode: string) => {
    if (otpCode.length !== OTP_LENGTH && otpCode.length !== 6) {
      setErrorMessage(`Please enter the complete ${OTP_LENGTH}-digit OTP code.`);
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpCode.trim(),
        type: 'signup',
      });

      if (error) {
        setErrorMessage(error.message || 'Invalid or expired OTP code. Please try again.');
        toast.error('Verification failed: ' + (error.message || 'Invalid code'));
        return;
      }

      if (data.user || data.session) {
        toast.success('Official PSU account verified! Welcome to PSU SportsTrack.');
        onVerified();
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected verification error occurred.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?type=signup`,
        },
      });

      if (error) {
        toast.error('Failed to resend code: ' + error.message);
      } else {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success('A new OTP code and confirmation link have been sent to your email.');
        // Reset inputs
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch {
      toast.error('An unexpected error occurred while resending the code.');
    } finally {
      setIsResending(false);
    }
  };

  const isComplete = digits.every((d) => d.length === 1);

  return (
    <div className={`space-y-6 text-center ${className}`}>
      {/* Visual Header */}
      <div className="space-y-3">
        <div className="mx-auto size-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/10">
          <Mail className="size-7 text-orange-400 animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold uppercase tracking-wider text-orange-400">
            <ShieldCheck className="size-3" /> Official University Email Verification
          </div>
          <h2 className="text-2xl sm:text-3xl font-black italic tracking-tight text-white uppercase">
            ENTER <span className="text-orange-500">OTP CODE</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
            We sent an 8-digit verification code and a confirmation link to:
          </p>
          <div className="pt-1">
            <span className="inline-block px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-orange-400 font-mono text-xs sm:text-sm font-semibold break-all select-all">
              {email}
            </span>
          </div>
        </div>
      </div>

      {/* Dual Pathway Guidance */}
      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/15 text-left text-xs text-slate-300 space-y-1">
        <p className="font-semibold text-orange-400 flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-orange-400 shrink-0" />
          Two Ways to Verify:
        </p>
        <p className="text-[11px] text-slate-400 leading-normal pl-5">
          1. <strong>Enter the 8-digit code</strong> below, <span className="text-slate-200">OR</span><br />
          2. <strong>Click the confirmation link</strong> in the email sent to your university inbox.
        </p>
      </div>

      {/* Segmented Digit Inputs */}
      <div className="space-y-3">
        <div className="flex justify-center items-center gap-1.5 sm:gap-2.5 max-w-full overflow-x-auto py-1">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              id={`${baseInputId}-otp-digit-${idx}`}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              disabled={isVerifying}
              aria-label={`Digit ${idx + 1} of verification code`}
              className="size-9 sm:size-12 text-center text-lg sm:text-2xl font-black font-mono bg-slate-900/90 text-white border-2 border-white/10 rounded-lg sm:rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-all outline-none disabled:opacity-50"
            />
          ))}
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium animate-in fade-in">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        onClick={() => verifyCode(digits.join(''))}
        disabled={!isComplete || isVerifying}
        className="w-full h-11 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-lg shadow-orange-500/20 cursor-pointer disabled:cursor-not-allowed"
      >
        {isVerifying ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Verifying Code...
          </span>
        ) : (
          'Verify & Activate Account'
        )}
      </Button>

      {/* Resend and Navigation Footer */}
      <div className="pt-2 space-y-3 border-t border-white/5 text-xs">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <span>Didn't receive the email?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-4 disabled:text-slate-500 disabled:no-underline disabled:cursor-not-allowed cursor-pointer transition-colors inline-flex items-center gap-1"
          >
            {isResending ? (
              <>
                <RefreshCw className="size-3 animate-spin" /> Resending...
              </>
            ) : cooldown > 0 ? (
              `Resend code in ${cooldown}s`
            ) : (
              'Resend Code'
            )}
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-medium"
          >
            <ArrowLeft className="size-3.5" /> Back to Registration Form
          </button>
        </div>
      </div>
    </div>
  );
};
