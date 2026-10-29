/**
 * Centralized User-Friendly Error Formatting Utility.
 * Transforms technical database, auth, and network errors into clear, polite,
 * and actionable PSU SportsTrack messages.
 */

export function getFriendlyErrorMessage(error: any, fallbackMessage: string = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return fallbackMessage;

  const rawMessage = typeof error === 'string'
    ? error
    : error?.message || error?.error_description || error?.details || '';

  const lower = rawMessage.toLowerCase();

  // 1. Supabase Auth Common Errors
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this university email is already registered. Please sign in or use password recovery.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password. Please verify your PSU credentials and try again.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Your email has not been verified yet. Please check your PSU inbox for your 8-digit OTP code or confirmation link.';
  }

  if (lower.includes('token has expired') || lower.includes('otp has expired') || lower.includes('token expired')) {
    return 'Your verification code has expired. Please click "Resend Code" to receive a fresh 3-minute OTP.';
  }

  if (lower.includes('invalid token') || lower.includes('token is invalid') || lower.includes('otp is invalid')) {
    return 'The verification code you entered is invalid. Please double-check your code and try again.';
  }

  if (lower.includes('rate limit') || lower.includes('email rate limit exceeded') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait 60 seconds before trying again.';
  }

  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return 'Please provide a password with at least 8 characters.';
  }

  if (lower.includes('psu.palawan.edu.ph')) {
    return 'Only official Palawan State University email addresses (@psu.palawan.edu.ph) are permitted.';
  }

  // 2. Database Constraint & RLS Errors
  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('permission denied')) {
    return 'You do not have permission to perform this action. If you believe this is an error, please contact an administrator.';
  }

  if (lower.includes('duplicate key value') || lower.includes('unique constraint')) {
    if (lower.includes('student_number')) {
      return 'A student athlete with this student number already exists in the system.';
    }
    if (lower.includes('employee_id')) {
      return 'An account with this employee ID is already registered.';
    }
    if (lower.includes('team_roster_player_id')) {
      return 'This player is already listed on the team roster.';
    }
    return 'A record with these details already exists.';
  }

  if (lower.includes('foreign key constraint') || lower.includes('violates foreign key')) {
    return 'The referenced item was not found. Please refresh the page and try again.';
  }

  // 3. Network & Connectivity
  if (lower.includes('failed to fetch') || lower.includes('network error') || lower.includes('connection refused')) {
    return 'Unable to reach the PSU SportsTrack server. Please check your internet connection.';
  }

  if (lower.includes('abort') || lower.includes('timeout')) {
    return 'The request timed out. Please try again.';
  }

  // Clean fallback
  if (rawMessage.length > 0 && rawMessage.length < 150 && !lower.includes('sql') && !lower.includes('syntax')) {
    return rawMessage;
  }

  return fallbackMessage;
}
