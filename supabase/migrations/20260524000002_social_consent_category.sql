-- BTF-021: Add social_integration consent category for LGPD Art. 7 compliance.
-- Social OAuth connections store tokens + access analytics data → requires granular consent.

-- 1. Expand the CHECK constraint to include 'social_integration' and 'newsletter_analytics'
ALTER TABLE public.consents
  DROP CONSTRAINT IF EXISTS consents_category_check;

ALTER TABLE public.consents
  ADD CONSTRAINT consents_category_check CHECK (
    category = ANY (ARRAY[
      'cookie_functional'::text,
      'cookie_analytics'::text,
      'cookie_marketing'::text,
      'newsletter'::text,
      'newsletter_analytics'::text,
      'privacy_policy'::text,
      'terms_of_service'::text,
      'social_integration'::text
    ])
  );

-- 2. Seed consent texts for social_integration (pt-BR + en)
INSERT INTO public.consent_texts (id, category, locale, version, text_md, effective_at, superseded_at)
VALUES
  (
    'social_integration_v1_pt-BR',
    'social_integration',
    'pt-BR',
    '1.0',
    '**Integração com redes sociais**

Ao conectar sua conta de rede social (YouTube, Facebook, Instagram, Bluesky), você autoriza:

- **Armazenamento seguro** de tokens de acesso (criptografia AES-256-GCM)
- **Publicação de conteúdo** em seu nome nas plataformas conectadas
- **Leitura de métricas** de desempenho das publicações

**Processadores:** Google LLC (YouTube — EUA, SCCs), Meta Platforms Inc. (Facebook/Instagram — EUA, SCCs), Bluesky PBC (AT Protocol — EUA, SCCs).
**Retenção:** Tokens mantidos enquanto a conexão estiver ativa. Removidos imediatamente ao desconectar.
**Revogação:** Desconecte a conta a qualquer momento nas configurações do CMS ou solicite via tnfigueiredotv@gmail.com.',
    now(),
    NULL
  ),
  (
    'social_integration_v1_en',
    'social_integration',
    'en',
    '1.0',
    '**Social media integration**

By connecting your social media account (YouTube, Facebook, Instagram, Bluesky), you authorize:

- **Secure storage** of access tokens (AES-256-GCM encryption)
- **Content publishing** on your behalf on connected platforms
- **Reading performance metrics** from your publications

**Processors:** Google LLC (YouTube — US, SCCs), Meta Platforms Inc. (Facebook/Instagram — US, SCCs), Bluesky PBC (AT Protocol — US, SCCs).
**Retention:** Tokens kept while the connection is active. Removed immediately upon disconnection.
**Revocation:** Disconnect your account at any time in CMS settings or request via tnfigueiredotv@gmail.com.',
    now(),
    NULL
  )
ON CONFLICT (category, locale, version) DO NOTHING;
