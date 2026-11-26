export const SITE = {
  name: "Virginia Energy Watch",
  url: "https://virginiaenergywatch.org",
  description:
    "How hard Virginia home energy bills are to pay, and the State Corporation Commission cases that will change them, in plain English.",
  // Shown in the footer of every page.
  byline: "An independent volunteer project by Will Goodwin.",
  disclaimer:
    "Information only, not legal advice. Not affiliated with the State Corporation Commission, any utility or any advocacy organization. Always check the official SCC case record.",
  repo: "https://github.com/wbgoodwin/va-energy-watch",
} as const;

export const NAV = [
  { href: "/", label: "Energy burden map" },
  { href: "/cases/", label: "SCC cases" },
  { href: "/calendar/", label: "Deadlines" },
  { href: "/learn/glossary/", label: "Glossary" },
  { href: "/about/", label: "About" },
] as const;
