import "./Navbar.css";

const NAV_LINKS = [
  { href: "/analytics", label: "Analytics" },
  { href: "/advisories", label: "Advisories" },
  { href: "/ai-assistant", label: "AI Assistant" },
];

export default function Navbar() {
  const activePath = window.location.pathname;

  return (
    <header className="navbar">
      <a href="/" className="navbar__brand" aria-label="CropGuardian home">
        <span className="navbar__brand-mark">CG</span>
        <span className="navbar__brand-copy">
          <span className="navbar__brand-name">CropGuardian</span>
          <span className="navbar__brand-meta">Powered by JKUAT Conduit</span>
        </span>
      </a>

      <nav aria-label="Primary navigation" className="navbar__links">
        {NAV_LINKS.map((link) => {
          const isActive = activePath === link.href;

          return (
            <a
              key={link.href}
              href={link.href}
              className={`navbar__link${isActive ? " navbar__link--active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
