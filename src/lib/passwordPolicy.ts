export interface PasswordPolicyCriteria {
  id: string;
  label: string;
  passed: boolean;
}

export interface PasswordPolicyResult {
  hasLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  score: number;
  strength: 'none' | 'weak' | 'fair' | 'good' | 'strong';
  strengthLabel: string;
  strengthPercentage: number;
  criteria: PasswordPolicyCriteria[];
  isValid: boolean;
}

export type PasswordMatchStatus = 'idle' | 'match' | 'mismatch';

/**
 * Validates a password against standard institutional security policy:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special symbol
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (!password) {
    return {
      hasLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecial: false,
      score: 0,
      strength: 'none',
      strengthLabel: 'Enter a password',
      strengthPercentage: 0,
      criteria: [
        { id: 'length', label: 'At least 8 characters', passed: false },
        { id: 'uppercase', label: 'One uppercase letter (A-Z)', passed: false },
        { id: 'lowercase', label: 'One lowercase letter (a-z)', passed: false },
        { id: 'number', label: 'One number (0-9)', passed: false },
        { id: 'special', label: 'One special symbol (!@#$%...)', passed: false },
      ],
      isValid: false,
    };
  }

  const hasLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(password);

  const criteria: PasswordPolicyCriteria[] = [
    { id: 'length', label: 'At least 8 characters', passed: hasLength },
    { id: 'uppercase', label: 'One uppercase letter (A-Z)', passed: hasUppercase },
    { id: 'lowercase', label: 'One lowercase letter (a-z)', passed: hasLowercase },
    { id: 'number', label: 'One number (0-9)', passed: hasNumber },
    { id: 'special', label: 'One special symbol (!@#$%...)', passed: hasSpecial },
  ];

  const score = criteria.filter((c) => c.passed).length;
  const strengthPercentage = Math.round((score / 5) * 100);

  let strength: PasswordPolicyResult['strength'] = 'none';
  let strengthLabel = 'Very Weak';

  if (score === 5) {
    strength = 'strong';
    strengthLabel = 'Strong';
  } else if (score === 4) {
    strength = 'good';
    strengthLabel = 'Good';
  } else if (score === 3) {
    strength = 'fair';
    strengthLabel = 'Fair';
  } else if (score >= 1) {
    strength = 'weak';
    strengthLabel = 'Weak';
  }

  return {
    hasLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    score,
    strength,
    strengthLabel,
    strengthPercentage,
    criteria,
    isValid: score === 5,
  };
}

/**
 * Checks in real time whether the confirmation password matches the primary password.
 */
export function checkPasswordMatch(password: string, confirmPassword: string): PasswordMatchStatus {
  if (!confirmPassword) {
    return 'idle';
  }
  return password === confirmPassword ? 'match' : 'mismatch';
}
