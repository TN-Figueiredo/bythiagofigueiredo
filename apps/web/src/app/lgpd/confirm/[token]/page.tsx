import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createLgpdContainer } from '@/lib/lgpd/container';

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ action?: string; locale?: string }>;
}

// Like /unsubscribe, this page is side-effect-free on GET. Any destructive
// action happens only when the user submits the explicit confirm form.
// Email scanners / link previews that issue GETs therefore cannot fire
// the deletion / cancellation by accident.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  other: { 'cache-control': 'no-store' },
};

const COPY = {
  'pt-BR': {
    invalid_title: 'Link inválido ou expirado',
    invalid_body:
      'Este link de confirmação é inválido, expirou ou já foi usado.',
    delete_title: 'Confirmar exclusão da conta',
    delete_body:
      'Ao confirmar, sua conta entrará em um período de 15 dias de carência. Durante esse prazo você pode cancelar; após o prazo, os dados serão apagados em definitivo.',
    delete_button: 'Confirmar exclusão',
    cancel_title: 'Cancelar exclusão da conta',
    cancel_body:
      'Você pode cancelar a exclusão agendada durante o período de 15 dias de carência. Conteúdos já anonimizados/reatribuídos não serão restaurados.',
    cancel_button: 'Cancelar exclusão',
    error_title: 'Erro ao processar',
    error_body:
      'Ocorreu um erro ao processar seu pedido. Tente novamente mais tarde.',
  },
  en: {
    invalid_title: 'Invalid or expired link',
    invalid_body:
      'This confirmation link is invalid, has expired, or has already been used.',
    delete_title: 'Confirm account deletion',
    delete_body:
      'If you confirm, your account enters a 15-day grace window. You can cancel during that period; after it, your data will be permanently purged.',
    delete_button: 'Confirm deletion',
    cancel_title: 'Cancel account deletion',
    cancel_body:
      'You can cancel a scheduled deletion during the 15-day grace window. Content already anonymized or reassigned will not be restored.',
    cancel_button: 'Cancel deletion',
    error_title: 'Processing error',
    error_body:
      'An unexpected error occurred. Please try again later.',
  },
} as const;

type Locale = keyof typeof COPY;
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale];
}

// Two server actions — invoked only on explicit button press. Each posts
// to the matching API route via an absolute URL so we don't depend on the
// client for path resolution.
async function confirmDeletion(token: string) {
  'use server';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
  const res = await fetch(`${baseUrl}/api/lgpd/confirm-deletion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const status = res.ok ? 'ok' : 'error';
  redirect(`/account/deleted?status=${status}`);
}

async function cancelDeletion(token: string) {
  'use server';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
  const res = await fetch(`${baseUrl}/api/lgpd/cancel-deletion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const status = res.ok ? 'cancelled' : 'error';
  redirect(`/account/settings/privacy?notice=${status}`);
}

export default async function LgpdConfirmPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { action, locale } = await searchParams;
  const copy = pickCopy(locale);

  if (!token || typeof token !== 'string') {
    return (
      <main>
        <h1>{copy.invalid_title}</h1>
        <p>{copy.invalid_body}</p>
      </main>
    );
  }

  // Container exposes a token-lookup shim. If Track B ships a different
  // method name, Phase 2 integration patches the import — tests mock
  // `tokenLookup.resolve`.
  type Resolved =
    | { kind: 'data_export'; signedUrl: string }
    | { kind: 'account_deletion'; userId: string }
    | { kind: 'account_deletion_cancel'; userId: string };
  let resolved: Resolved | null = null;
  try {
    const container = createLgpdContainer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lookup = (container as unknown as {
      tokenLookup?: {
        resolve: (token: string) => Promise<unknown>;
      };
    }).tokenLookup;

    if (!lookup) {
      // Track B hasn't shipped tokenLookup yet — in that fallback we can't
      // branch on token kind, so we render the generic "invalid" UI.
      return (
        <main>
          <h1>{copy.invalid_title}</h1>
          <p>{copy.invalid_body}</p>
        </main>
      );
    }

    resolved = (await lookup.resolve(token)) as Resolved | null;
  } catch {
    return (
      <main>
        <h1>{copy.invalid_title}</h1>
        <p>{copy.invalid_body}</p>
      </main>
    );
  }

  if (!resolved) {
    return (
      <main>
        <h1>{copy.invalid_title}</h1>
        <p>{copy.invalid_body}</p>
      </main>
    );
  }

  if (resolved.kind === 'data_export') {
    // Immediate 302 to the short-lived signed URL. `redirect()` throws
    // NEXT_REDIRECT; the response carries `Cache-Control: no-store`
    // because of the `dynamic = 'force-dynamic'` declaration above.
    redirect(resolved.signedUrl);
  }

  if (resolved.kind === 'account_deletion_cancel' || action === 'cancel') {
    return (
      <main>
        <h1>{copy.cancel_title}</h1>
        <p>{copy.cancel_body}</p>
        <form
          action={async () => {
            'use server';
            await cancelDeletion(token);
          }}
          method="post"
        >
          <button type="submit">{copy.cancel_button}</button>
        </form>
      </main>
    );
  }

  // Default branch — account deletion confirmation
  return (
    <main>
      <h1>{copy.delete_title}</h1>
      <p>{copy.delete_body}</p>
      <form
        action={async () => {
          'use server';
          await confirmDeletion(token);
        }}
      >
        <button type="submit">{copy.delete_button}</button>
      </form>
    </main>
  );
}
