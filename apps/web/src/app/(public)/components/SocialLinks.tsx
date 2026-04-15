type Link = {
  platform: string;
  url: string;
  label: string;
};

export default function SocialLinks({ links }: { links: Link[] }) {
  return (
    <ul className="flex gap-[var(--spacing-md)] list-none p-0 m-0 justify-center">
      {links.map((link) => (
        <li key={link.platform}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary no-underline hover:underline"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
