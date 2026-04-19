type Props = { locale: 'en' | 'pt-BR' }

export function PinboardHome({ locale }: Props) {
  return <div data-testid="pinboard-home">Homepage {locale}</div>
}
