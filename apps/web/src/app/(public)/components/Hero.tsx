type Props = {
    headline: string;
    subheadline: string;
  };
  
  export default function Hero({ headline, subheadline }: Props) {
    return (
      <section className="flex flex-col items-center text-center gap-[var(--spacing-md)] p-[var(--spacing-xl)] px-[var(--spacing-lg)]">
        <h2 className="m-0 text-[2rem]">{headline}</h2>
        <p className="m-0 max-w-[600px] text-subtitle">{subheadline}</p>
      </section>
    );
  }
  