import { Link } from 'react-router-dom'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'

const LAST_UPDATED = 'May 3, 2026'
const COMPANY = 'KickrIQ Athletics, Inc.'
const CONTACT_EMAIL = 'infokickriq@gmail.com'
const GOVERNING_STATE = 'the State of Delaware, USA'

export function Terms() {
  return (
    <div className="kr-app min-h-screen">
      <header className="px-6 md:px-10 py-6 border-b border-[rgba(245,241,232,0.06)]">
        <Link to="/" className="inline-flex items-center no-underline">
          <KickrIQLogo height={28} />
        </Link>
      </header>

      <main className="max-w-[760px] mx-auto px-6 md:px-10 py-16 md:py-24">
        <div className="kr-eyebrow mb-3">Legal</div>
        <h1 className="kr-h1 mb-3">Terms of Service</h1>
        <p className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-3 mb-12">
          Last updated · {LAST_UPDATED}
        </p>

        <div className="prose-legal">
          <p className="lede">
            These terms govern your use of KickrIQ. By creating an account or using the
            product, you agree to them. If you do not agree, do not use the product.
          </p>

          <Section title="1. Who can use KickrIQ">
            <p>
              KickrIQ is intended for users <strong>13 and older</strong>. If you are
              between 13 and 17, you may only use KickrIQ with the involvement of a parent
              or guardian. By signing up you confirm you meet these requirements.
            </p>
          </Section>

          <Section title="2. Your account">
            <ul>
              <li>You are responsible for the accuracy of the information you put into your profile.</li>
              <li>You are responsible for keeping your password and account secure.</li>
              <li>One account per athlete. Don’t share accounts.</li>
              <li>You may delete your account at any time from your settings.</li>
            </ul>
          </Section>

          <Section title="3. What KickrIQ is — and what it isn’t">
            <p>
              KickrIQ provides AI-assisted tools to help athletes communicate with coaches,
              identify schools that may fit, and track outreach. It is software, not a
              guarantee. We do not promise any specific outcome — recruitment, scholarship,
              admission, or playing time. College recruiting depends on many factors
              outside our control.
            </p>
          </Section>

          <Section title="4. Subscriptions and billing">
            <ul>
              <li><strong>Free plan</strong> includes limited coach emails and school matches.</li>
              <li><strong>Pro</strong> ($19/month) and <strong>Family</strong> ($29/month) unlock unlimited usage and additional features as described on our pricing page.</li>
              <li>Subscriptions renew automatically each billing period until canceled.</li>
              <li>You can cancel any time; cancellation takes effect at the end of the current billing period and you keep access until then.</li>
              <li>Prices may change. We will give at least 30 days’ notice before any price increase to existing subscribers.</li>
              <li>Payments are processed by Stripe. You authorize us (via Stripe) to charge the payment method on file.</li>
            </ul>
          </Section>

          <Section title="5. Refunds">
            <p>
              We don’t offer pro-rated refunds for partial months. If you believe you were
              charged in error, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> within 14 days of the
              charge and we will work with you in good faith.
            </p>
          </Section>

          <Section title="6. Acceptable use">
            <p>You agree not to:</p>
            <ul>
              <li>Submit false information about yourself or another person.</li>
              <li>Impersonate someone else or claim stats, achievements, or affiliations that are not yours.</li>
              <li>Use KickrIQ to spam or harass coaches or anyone else.</li>
              <li>Scrape, copy, or resell our school or coach data.</li>
              <li>Reverse engineer, attack, or attempt to gain unauthorized access to the service.</li>
              <li>Use the product on behalf of someone under 13.</li>
            </ul>
            <p>
              We may suspend or terminate accounts that violate these rules.
            </p>
          </Section>

          <Section title="7. Coach outreach and email">
            <p>
              When you generate or send a coach email through KickrIQ, you are the sender.
              You are responsible for the content of every message that goes out under your
              name. If you connect Gmail, the messages are sent from your own Gmail account
              and follow Google’s terms.
            </p>
            <p>
              You agree to comply with the U.S. CAN-SPAM Act and any other applicable email
              laws — most importantly, do not send misleading messages or harass recipients
              who have asked you to stop.
            </p>
          </Section>

          <Section title="8. Your content">
            <p>
              You keep ownership of the content you put into KickrIQ (your profile, video
              links, messages). You grant KickrIQ a limited license to store, process, and
              display that content as needed to operate the product for you.
            </p>
            <p>
              We will not sell your content or use it to train third-party AI models.
            </p>
          </Section>

          <Section title="9. AI-generated output">
            <p>
              Emails, school analysis, and video feedback produced by KickrIQ are generated
              by AI. They are starting points, not final words. Review everything before
              you send it. AI can make mistakes, miss context, or get details wrong — the
              final responsibility for what you send is yours.
            </p>
          </Section>

          <Section title="10. Service availability">
            <p>
              We work hard to keep KickrIQ running, but we don’t guarantee uninterrupted
              service. We may modify, pause, or discontinue features. If we discontinue a
              paid feature you’re actively paying for, we’ll offer a fair credit or refund.
            </p>
          </Section>

          <Section title="11. Disclaimers">
            <p>
              KickrIQ is provided “as is” and “as available.” To the maximum extent
              permitted by law, we disclaim all warranties — express or implied — including
              fitness for a particular purpose, accuracy of school or coach data, and
              non-infringement.
            </p>
          </Section>

          <Section title="12. Limitation of liability">
            <p>
              To the maximum extent permitted by law, {COMPANY}’s total liability arising
              out of or relating to these terms or the service is limited to the greater of
              (a) the amount you paid us in the 12 months before the claim, or (b) USD $50.
              We are not liable for indirect, incidental, special, consequential, or
              punitive damages, or for lost recruitment opportunities or scholarships.
            </p>
          </Section>

          <Section title="13. Indemnity">
            <p>
              You agree to indemnify and hold {COMPANY} harmless from claims arising out of
              your misuse of the service, your violation of these terms, or your violation
              of someone else’s rights.
            </p>
          </Section>

          <Section title="14. Termination">
            <p>
              You can stop using KickrIQ and delete your account at any time. We can
              suspend or terminate your access if you violate these terms or use the
              service in a way that creates risk for us or other users.
            </p>
          </Section>

          <Section title="15. Changes to these terms">
            <p>
              We may update these terms as the product evolves. If we make a material
              change, we will notify signed-in users by email or in-product banner before
              the change takes effect. Continued use after the change means you accept the
              new terms.
            </p>
          </Section>

          <Section title="16. Governing law and disputes">
            <p>
              These terms are governed by the laws of {GOVERNING_STATE}, without regard to
              conflict-of-laws principles. Any dispute that can’t be resolved informally
              will be resolved in the state or federal courts located in {GOVERNING_STATE},
              and you and KickrIQ each consent to that jurisdiction.
            </p>
          </Section>

          <Section title="17. Contact">
            <p>
              Questions about these terms:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-[rgba(245,241,232,0.06)] flex items-center justify-between">
          <Link to="/" className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2 hover:text-gold no-underline">
            ← Back to home
          </Link>
          <Link to="/privacy" className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2 hover:text-gold no-underline">
            Privacy Policy →
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
