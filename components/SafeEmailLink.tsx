"use client";

import { useEffect, useState } from "react";

type SafeEmailLinkProps = {
  email: string;
  className?: string;
  placeholder?: string;
};

export function SafeEmailLink({
  email,
  className,
  placeholder = "Loading email...",
}: SafeEmailLinkProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span suppressHydrationWarning className={className}>
        {placeholder}
      </span>
    );
  }

  return (
    <a href={`mailto:${email}`} className={className}>
      {email}
    </a>
  );
}
