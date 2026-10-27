# Palawan State University SportsTrack: Official Email Templates

Production-ready, bulletproof HTML email templates designed for **PSU SportsTrack**. Styled in accordance with Palawan State University's official brand guidelines (Midnight Navy `#0b1120`, Slate `#0f172a`, and Athletic Blaze Orange `#f97316`).

---

## 📋 Template Catalog

| Template File | Supabase Dashboard Setting | Recommended Subject Line | Primary Variables |
| :--- | :--- | :--- | :--- |
| [`confirm-signup.html`](./confirm-signup.html) | **Confirm signup** | `Verify your PSU SportsTrack Account (OTP: {{ .Token }})` | `{{ .Token }}`, `{{ .ConfirmationURL }}` |
| [`reset-password.html`](./reset-password.html) | **Reset password** | `Reset Your PSU SportsTrack Password (Code: {{ .Token }})` | `{{ .Token }}`, `{{ .ConfirmationURL }}` |
| [`magic-link.html`](./magic-link.html) | **Magic Link** | `Your PSU SportsTrack Sign-In Link (Code: {{ .Token }})` | `{{ .Token }}`, `{{ .ConfirmationURL }}` |
| [`invite-user.html`](./invite-user.html) | **Invite user** | `You've Been Invited to Join PSU SportsTrack` | `{{ .ConfirmationURL }}` |
| [`change-email.html`](./change-email.html) | **Change email address** | `Confirm Your New PSU Email Address (Code: {{ .Token }})` | `{{ .Token }}`, `{{ .NewEmail }}`, `{{ .ConfirmationURL }}` |
| [`reauthentication.html`](./reauthentication.html) | **Reauthentication** | `Security Verification Code: {{ .Token }}` | `{{ .Token }}` |

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
4. **OTP Expiry**: Set to `86400` seconds (24 hours) for sign-up or your desired window.

---

## 🎨 Design Features
- **Dual-Pathway Verification**: Features both the large, high-legibility 6-digit OTP code (`{{ .Token }}`) and a prominent one-click CTA button (`{{ .ConfirmationURL }}`).
- **Mobile-First & Anti-Truncation**: Fluid container with 48px minimum touch targets conforming to Rule 2 in `AGENTS.md`.
- **Client Compatibility**: 100% table-based layout with inline CSS styles verified across Gmail (iOS/Android/Web), Outlook (Desktop/Web), Apple Mail, and Yahoo Mail.
- **Dark Mode Native**: Engineered with deep Slate `#0f172a` and Navy backgrounds that render crisply regardless of client dark/light mode inversions.
