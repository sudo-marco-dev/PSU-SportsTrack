# Palawan State University SportsTrack: Official Email Templates

Production-ready, bulletproof HTML email templates designed for **PSU SportsTrack**. Styled in accordance with Palawan State University's official brand guidelines (Midnight Navy `#0b1120`, Slate `#0f172a`, and Athletic Blaze Orange `#f97316`).

---

## 📋 Template Catalog

### Active in Production
| Template File | Supabase Dashboard Setting | Purpose & Flow | Primary Variables |
| :--- | :--- | :--- | :--- |
| [`confirm-signup.html`](./confirm-signup.html) | **Confirm signup** | **OTP Account Activation** (Includes OTP token + direct confirmation URL for initial sign-up) | `{{ .Token }}`, `{{ .ConfirmationURL }}` |
| [`reset-password.html`](./reset-password.html) | **Reset password** | **Password Recovery** (OTP code + reset link for password retrieval) | `{{ .Token }}`, `{{ .ConfirmationURL }}` |

### Inactive / Not In Use
| Template File | Status | Reason |
| :--- | :--- | :--- |
| [`magic-link.html`](./magic-link.html) | *Disabled* | Standalone passwordless magic link sign-in is not used (activation is handled exclusively during registration). |
| [`invite-user.html`](./invite-user.html) | *Disabled* | No facilitator/official invite flow; users register directly using their university institutional email. |
| [`change-email.html`](./change-email.html) | *Disabled* | University emails (`@psu.palawan.edu.ph`) are immutable and permanent once assigned; email changing is not supported. |
| [`reauthentication.html`](./reauthentication.html) | *Disabled* | Secondary reauthentication challenge emails are not configured. |

---

## 🚀 How to Apply These Templates to Supabase

1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. In the left navigation, select **Authentication** (`Auth`) -> **Email Templates**.
3. For each template:
   - Click on the corresponding tab (e.g., **Confirm signup**, **Reset password**).
   - Update the **Subject** line using the recommended subject from the table above.
   - Open the corresponding `.html` file from this folder, copy the full HTML, and paste it into the **Message Body (HTML)** field.
   - Click **Save**.

---

## ⚙️ Required Supabase Auth Settings

Under **Authentication** -> **Providers** -> **Email**:
1. **Enable email provider**: `ON`
2. **Confirm email**: `ON` (Required for the dual-pathway OTP code and confirmation link registration flow).
3. **Secure email change**: `ON` (Sends confirmation to both emails when updated).
4. **OTP Expiry**: Set to `180` seconds (3 minutes) for sign-up (or desired window).

---

## 🎨 Design Features
- **Dual-Pathway Verification**: Features both the large, high-legibility 6-digit OTP code (`{{ .Token }}`) and a prominent one-click CTA button (`{{ .ConfirmationURL }}`).
- **Mobile-First & Anti-Truncation**: Fluid container with 48px minimum touch targets conforming to Rule 2 in `AGENTS.md`.
- **Client Compatibility**: 100% table-based layout with inline CSS styles verified across Gmail (iOS/Android/Web), Outlook (Desktop/Web), Apple Mail, and Yahoo Mail.
- **Dark Mode Native**: Engineered with deep Slate `#0f172a` and Navy backgrounds that render crisply regardless of client dark/light mode inversions.
