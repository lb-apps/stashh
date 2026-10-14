import Link from "next/link";
import type { MDXComponents } from "mdx/types";

/**
 * Markdown → Discovery. The legal pages are MDX so the copy stays editable as
 * prose; every element is mapped to Discovery type tokens here, once.
 * Body is ink on white (~19:1) at a 1.6 line-height; links are cobalt and
 * underlined, since cobalt alone is under 3:1 against ink body text.
 */
const SITE_ORIGIN = /^https:\/\/stashh\.me(?=\/|$)/;

const linkClass =
  "underline decoration-cobalt-300 decoration-2 underline-offset-4 hover:decoration-cobalt-500";

const components: MDXComponents = {
  h1: (props) => <h1 className="ds-display-2 mb-6 text-balance" {...props} />,
  h2: (props) => <h2 className="ds-headline mt-10 mb-3 text-balance" {...props} />,
  p: (props) => (
    <p className="mt-4 font-body text-body leading-relaxed text-ink-primary first:mt-0" {...props} />
  ),
  ul: (props) => (
    <ul className="mt-4 flex list-disc flex-col gap-2 pl-6 marker:text-cobalt-500" {...props} />
  ),
  ol: (props) => (
    <ol
      className="mt-4 flex list-decimal flex-col gap-2 pl-6 marker:font-bold marker:text-cobalt-500"
      {...props}
    />
  ),
  li: (props) => (
    <li className="pl-1 font-body text-body leading-relaxed text-ink-primary" {...props} />
  ),
  strong: (props) => <strong className="font-bold" {...props} />,
  a: ({ href = "", children, ...props }) => {
    // Links to stashh.me stay client-side navigations to the same site.
    const path = href.replace(SITE_ORIGIN, "") || "/";
    if (path.startsWith("/")) {
      return (
        <Link className={linkClass} href={path}>
          {children}
        </Link>
      );
    }
    return (
      <a className={linkClass} href={href} {...props}>
        {children}
      </a>
    );
  },
};

export function useMDXComponents(): MDXComponents {
  return components;
}
