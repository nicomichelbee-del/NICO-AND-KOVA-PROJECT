import { useParams, Link } from 'react-router-dom'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'

// Stub page — public athlete profile view by slug.
// Built out as part of the in-progress profile refactor.
export function PublicProfile() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <div className="kr-auth-shell flex items-center justify-center px-6">
      <div className="relative max-w-md text-center" data-reveal-on-load>
        <Link to="/" className="inline-flex justify-center mb-10 no-underline">
          <KickrIQLogo height={26} />
        </Link>
        <span className="kr-eyebrow justify-center">Public profile</span>
        <h1 className="kr-h1 mt-4">
          <span className="kr-accent">@{slug}</span>
        </h1>
        <p className="text-[15px] text-ink-1 mt-4 mb-8 leading-[1.6]">
          Public profile pages aren't live yet. This is a placeholder while the profile system is being rebuilt.
        </p>
        <Link to="/" className="font-mono text-[11px] tracking-[0.18em] uppercase text-gold hover:underline underline-offset-4">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}
