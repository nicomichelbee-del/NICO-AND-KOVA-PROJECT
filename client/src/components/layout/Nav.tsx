import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { BeekoLogo } from '../ui/BeekoLogo'

export function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-16 py-5 bg-[rgba(7,9,15,0.9)] backdrop-blur-lg border-b border-[rgba(255,255,255,0.07)]">
      <Link to="/" className="no-underline">
        <BeekoLogo size={40} textClassName="font-serif text-xl font-black text-[#f1f5f9]" />
      </Link>
      <ul className="hidden md:flex gap-9 list-none m-0 p-0">
        {['Features', 'How It Works', 'Pricing', 'For Parents'].map((item) => (
          <li key={item}>
            <a
              href={`#${item.toLowerCase().replace(/ /g, '-')}`}
              className="text-sm font-medium text-[#64748b] hover:text-[#f1f5f9] transition-colors no-underline"
            >
              {item}
            </a>
          </li>
        ))}
      </ul>
      <Link to="/signup">
        <Button variant="outline" size="sm">Get Started</Button>
      </Link>
    </nav>
  )
}
