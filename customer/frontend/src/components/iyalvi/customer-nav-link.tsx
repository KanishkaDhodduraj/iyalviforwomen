import type { ReactNode, AriaAttributes, MouseEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { customerNavigation } from "@/lib/customer-navigation";

type CustomerSectionPath = (typeof customerNavigation)[number]["to"];

export function CustomerNavLink({
  to,
  children,
  className,
  ariaCurrent,
}: {
  to: CustomerSectionPath;
  children: ReactNode;
  className?: string;
  ariaCurrent?: AriaAttributes["aria-current"];
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hash = useRouterState({ select: (state) => state.location.hash.replace(/^#/, "") });
  const sectionId = to.slice(1);

  const goToSection = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const scrollToSection = () =>
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });

    void navigate({ to: "/", hash: sectionId, replace: true }).then(() => {
      window.requestAnimationFrame(scrollToSection);
    });
  };

  return (
    <Link
      to="/"
      hash={sectionId}
      replace
      onClick={goToSection}
      className={className}
      aria-current={hash === sectionId || pathname === to ? "page" : ariaCurrent}
    >
      {children}
    </Link>
  );
}
