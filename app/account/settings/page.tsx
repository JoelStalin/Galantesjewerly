import { cookies } from 'next/headers';
import { verifyGoogleUserSession, GOOGLE_USER_COOKIE } from '@/lib/google-login';
import { OdooService } from '@/lib/odoo/services';
import { ProfileForm } from '@/components/account/ProfileForm';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GOOGLE_USER_COOKIE)?.value;
  if (!token) return null;

  const user = await verifyGoogleUserSession(token);
  if (!user) return null;

  const partnerId = await OdooService.getPartnerByEmail(user.email);
  const profile = partnerId ? await OdooService.getPartnerProfile(partnerId) : null;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="border-b border-primary/10 pb-6">
        <h1 className="font-serif text-4xl text-primary">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and shipping information.</p>
      </div>

      {/* Google account notice */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/10 bg-primary/[0.02] px-5 py-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Signed in with Google</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your login email is <span className="font-medium text-primary">{user.email}</span>.
            To change your password or Google email, visit{' '}
            <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
              myaccount.google.com
            </a>.
          </p>
        </div>
      </div>

      <ProfileForm
        initialData={{
          name: profile?.name ?? user.name ?? '',
          email: user.email,
          phone: profile?.phone ?? '',
          street: profile?.street ?? '',
          street2: profile?.street2 ?? '',
          city: profile?.city ?? '',
          zip: profile?.zip ?? '',
        }}
      />
    </div>
  );
}
