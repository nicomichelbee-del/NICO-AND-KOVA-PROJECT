import { Link } from 'react-router-dom'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'

const LAST_UPDATED = 'May 6, 2026'
const COMPANY = 'KickrIQ Athletics, Inc.'
const CONTACT_EMAIL = 'infokickriq@gmail.com'

export function Privacy() {
  return (
    <div className="kr-app min-h-screen">
      <header className="px-6 md:px-10 py-6 border-b border-[rgba(245,241,232,0.06)]">
        <Link to="/" className="inline-flex items-center no-underline">
          <KickrIQLogo height={28} />
        </Link>
      </header>

      <main className="max-w-[760px] mx-auto px-6 md:px-10 py-16 md:py-24">
        <div className="kr-eyebrow mb-3">Legal</div>
        <h1 className="kr-h1 mb-3">Privacy Policy</h1>
        <p className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-3 mb-12">
          Last updated · {LAST_UPDATED}
        </p>

        <div className="prose-legal">
          <p className="lede">
            KickrIQ helps high school soccer players reach college coaches. To do that we
            collect a small amount of information from you. This policy explains what we
            collect, why, and what control you have over it. It is written in plain English
            on purpose.
          </p>

          <Section title="1. Who we are">
            <p>
              {COMPANY} (“KickrIQ”, “we”, “us”) operates the KickrIQ website and recruiting
              tools. If you have a question about this policy, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section title="2. What we collect">
            <p>When you create an account or use the product, we collect:</p>
            <ul>
              <li><strong>Account information</strong> — name, email, password (hashed), the auth provider you used (e.g. Google), and your year of birth (used to confirm you are 13 or older).</li>
              <li><strong>Parent or guardian email</strong> — if you are between 13 and 17, we also collect a parent or guardian's email at signup so they can be contacted if needed.</li>
              <li><strong>Athlete profile</strong> — graduation year, position, club team, GPA, test scores, stats, location, division goal, highlight video URL, and similar recruiting information you enter yourself.</li>
              <li><strong>Outreach activity</strong> — the schools and coaches you target, emails you draft and send through KickrIQ, and replies you log.</li>
              <li><strong>Gmail data (only if you connect Gmail)</strong> — we read message metadata and reply threads strictly to power the outreach tracker. We do not read unrelated mail and we do not sell or train models on it.</li>
              <li><strong>Usage data</strong> — pages viewed, features used, errors, and approximate device/browser information for product analytics and abuse prevention.</li>
              <li><strong>Payment data</strong> — processed by Stripe. We never see or store your card number; we only store a customer ID and your subscription status.</li>
            </ul>
          </Section>

          <Section title="3. How we use it">
            <ul>
              <li>To run the core product — match you to schools, generate coach emails, track replies.</li>
              <li>To send transactional email (sign-up confirmations, receipts, follow-up reminders).</li>
              <li>To improve the product (aggregate analytics, debugging, fraud prevention).</li>
              <li>To enforce free vs. paid tier limits.</li>
            </ul>
            <p>
              We use Anthropic’s Claude API to generate email drafts, school analysis, and
              video feedback. Your profile data is sent to Anthropic only to fulfill the
              specific request and is not used to train their models.
            </p>
          </Section>

          <Section title="4. What we do NOT do">
            <ul>
              <li>We do not sell your data to anyone.</li>
              <li>We do not share your profile with college coaches unless you choose to send them an email or publish a public profile.</li>
              <li>We do not use your Gmail content for advertising or model training.</li>
              <li>We do not show third-party advertising on the product.</li>
            </ul>
          </Section>

          <Section title="5. Athletes under 18 / under 13">
            <p>
              Our users are mostly high school athletes, which means many are under 18.
              KickrIQ is intended for users <strong>13 and older</strong>. We ask for your
              year of birth at signup and will not create an account for anyone under 13.
              If we ever discover that an account was created for a child under 13, we will
              delete it.
            </p>
            <p>
              If you are between 13 and 17, signup also requires a parent or guardian email
              and a confirmation that a parent or guardian has approved your use of KickrIQ.
              Parents can request access, correction, or deletion of a minor's data — or
              ask to revoke consent and have the account closed — by emailing{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within
              30 days.
            </p>
          </Section>

          <Section title="6. Service providers we use">
            <ul>
              <li><strong>Supabase</strong> — database and authentication.</li>
              <li><strong>Stripe</strong> — payment processing.</li>
              <li><strong>Anthropic (Claude)</strong> — AI email and analysis generation.</li>
              <li><strong>Google (Gmail API + OAuth)</strong> — sign-in and outreach tracking, only if you opt in.</li>
              <li><strong>Vercel</strong> — web hosting and Vercel Analytics (anonymized pageview and Web Vitals data).</li>
              <li><strong>PostHog</strong> — product analytics: pageviews, feature usage, and per-user event timelines (keyed to your account ID, not your name). PostHog data is stored in the United States.</li>
              <li><strong>Render</strong> — hosting for the API server.</li>
            </ul>
            <p>
              Each is bound by their own terms and is given only the data needed to do its
              job.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>You can:</p>
            <ul>
              <li>See and edit your profile from the dashboard.</li>
              <li>Export your data — email{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will send a copy within 30 days.
              </li>
              <li>Delete your account — email us and we will delete your profile, outreach history, and Gmail tokens within 30 days. (A self-serve delete button is on our roadmap.)</li>
              <li>Disconnect Gmail — revoke KickrIQ at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">your Google account permissions page</a>; we stop syncing as soon as the token is revoked.</li>
            </ul>
            <p>
              California (CCPA) and EU/UK (GDPR) residents have additional rights, including
              the right to access, correct, port, and delete your data, and to object to
              certain processing. Email us to exercise any of these.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We use industry-standard practices: encrypted connections (HTTPS), hashed
              passwords, scoped API keys, and least-privilege database access. No system is
              perfect — if we ever have a breach affecting you, we will notify you.
            </p>
          </Section>

          <Section title="9. Cookies and local storage">
            <p>
              We use cookies and browser local storage to keep you signed in (Supabase
              session token), remember your draft profile entries between visits, and
              measure product usage via PostHog and Vercel Analytics. We do not use
              third-party advertising cookies.
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>
              We may update this policy as the product evolves. If we make a material
              change, we will notify signed-in users by email or in-product banner before it
              takes effect.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions, requests, or complaints:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-[rgba(245,241,232,0.06)] flex items-center justify-between">
          <Link to="/" className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2 hover:text-gold no-underline">
            ← Back to home
          </Link>
          <Link to="/terms" className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2 hover:text-gold no-underline">
            Terms of Service →
          </Link>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="kr-h2 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
