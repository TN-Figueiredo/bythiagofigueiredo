-- Seed the manifesto blog post with pt-BR and en translations.
-- Idempotent: skips if slug 'manifesto' already exists for the site.

do $$
declare
  v_site_id uuid;
  v_author_id uuid;
  v_post_id uuid;
  v_existing uuid;
  v_content_pt text;
  v_content_en text;
begin
  -- 1. Resolve site
  select id into v_site_id from public.sites where slug = 'bythiagofigueiredo';
  if v_site_id is null then
    raise notice 'Site bythiagofigueiredo not found — skipping manifesto seed';
    return;
  end if;

  -- 2. Ensure default author exists
  select id into v_author_id from public.authors
    where site_id = v_site_id and slug = 'thiago'
    limit 1;

  if v_author_id is null then
    insert into public.authors (site_id, name, slug, display_name, bio_md, is_default, sort_order)
    values (
      v_site_id,
      'Thiago Figueiredo',
      'thiago',
      'Thiago Figueiredo',
      'Dev, escritor, construtor de coisas na internet.',
      true,
      0
    )
    on conflict (site_id, slug) do nothing
    returning id into v_author_id;

    if v_author_id is null then
      select id into v_author_id from public.authors where site_id = v_site_id and slug = 'thiago';
    end if;
  end if;

  -- 3. Check if manifesto already exists (idempotent guard)
  select bt.post_id into v_existing
    from public.blog_translations bt
    where bt.slug = 'manifesto' and bt.locale = 'pt-BR'
    limit 1;

  if v_existing is not null then
    raise notice 'Manifesto post already exists (%) — skipping', v_existing;
    return;
  end if;

  -- 4. Insert blog post (bypass publish trigger by inserting as draft, then updating directly)
  insert into public.blog_posts (site_id, author_id, status, category, is_featured)
  values (v_site_id, v_author_id, 'draft', 'vida', true)
  returning id into v_post_id;

  -- Disable the publish-permission trigger for the seed update
  alter table public.blog_posts disable trigger trg_enforce_publish_blog;
  update public.blog_posts
    set status = 'published', published_at = now() - interval '1 hour'
    where id = v_post_id;
  alter table public.blog_posts enable trigger trg_enforce_publish_blog;

  -- 5. pt-BR translation
  v_content_pt := '---
key_points:
  - "Um caderno, nao um produto"
  - "Ritmo sem rigidez — semanal quando da"
  - "CMS proprio: um artigo, muitos destinos"
  - "Monetizacao indireta via Vagalume"
  - "Direito de parar sem culpa"
tags:
  - meta
  - manifesto
  - "2026"
  - hub
pull_quote: ''"um caderno, nao um produto"''
pull_quote_attribution: "promessa 3"
hero_illustration: constellation
series_title: "Construindo em publico: o proprio projeto"
series_part: 1
series_total: 3
series_next_slug: um-cms-para-governar
series_next_title: "Um CMS para governar todos — arquitetura de publicacao cross-site"
series_next_excerpt: "A arquitetura por tras de publicar o mesmo post em seis sites diferentes sem copy-paste."
colophon: "Escrito em iA Writer numa MacBook Air M2. Publicado pelo CMS que eu mesmo construi, que roda em Supabase + Vercel. Tipografia: Source Serif 4 para corpo, Inter pro resto. Ilustracao de capa desenhada em SVG direto no codigo — sem stock photo, sem Midjourney."
---

Eu tenho seis apps em producao, um canal de YouTube bilingue, uma newsletter que saiu de 40 para 1.400 leitores em um ano, e uma pasta chamada `drafts/` com 83 arquivos `.md` que nunca viram a luz do dia. Tudo isso vivia espalhado. Este site e o lugar onde eu junto.

Mas antes de explicar o que e — deixa eu explicar o que *nao* e. Porque e o *nao* que me manteve longe de fazer isso por tres anos.

## O que nao e

Isto nao e um portfolio. Portfolio e um museu — voce visita, aplaude educadamente, vai embora. Eu nao quero um museu. Eu quero um caderno aberto em cima da mesa, com cafe derramado no canto e anotacoes na margem.

Tambem nao e um feed. Feed e algoritmo — ele decide o que voce le. Aqui voce decide. A ordem e cronologica. A curadoria e minha. A leitura e sua.

E nao e um blog corporativo. Nao vou escrever "5 dicas para voce aumentar sua produtividade em 2026". Vou escrever "semana 14: quase desisti". Se isso nao te ajuda — e pode nao ajudar — pelo menos vai ser verdade.

> Um caderno aberto e pior que um portfolio, mas honesto. Eu prefiro honesto.

## O que e, entao

E um hub. Um ponto central que concentra tres coisas que antes viviam em pastas separadas na minha cabeca:

- **Escritos** — posts, ensaios, relatos. Portugues e ingles, mesma cabeca.
- **Videos** — o que eu filmo pro canal, com link e resumo.
- **Newsletters** — quatro cartas diferentes, voce assina as que interessam.

Tudo isso puxa do mesmo CMS. Um post meu vai pro blog, pro feed da newsletter, pro YouTube description, e pro campaign landing se eu quiser — com *um clique*. Isso e o que me fez parar de procrastinar e finalmente construir.

### Um parentese sobre o CMS

Eu gastei tres meses construindo o mecanismo antes de pensar no design. Isso e coisa de dev — errado, provavelmente, mas foi o que fez sentido. A ideia e simples: em vez de publicar seis vezes, publico uma. O mesmo conteudo vira seis coisas diferentes dependendo do destino.

```ts
// Publicar uma vez, distribuir para onde importa
await publish(post, {
  sites: ["bythiago", "dev.bythiago", "tng-blog"],
  as: {
    newsletter: "main",
    campaign: null,
    youtube: { includeDescription: true },
  },
})
```

Isso nao e magica. E uma junction table no Supabase e uma caixa de checkbox[^1]. Mas e o que me permitiu parar de copiar e colar.

## As tres promessas

Eu prometi a mim mesmo tres coisas quando abri este caderno. Estou colocando elas aqui em publico pra que voce cobre — e pra que eu nao esqueca quando cansar.

### 1. Escrever mesmo quando for ruim

Dos 83 drafts na pasta, uns 60 sao ruins. O erro foi pensar que eu podia decidir antes de escrever se eles seriam bons[^2]. Voce so sabe escrevendo. Entao a promessa e: termina. Publica. Se nao prestar, apaga depois. Mas termina.

### 2. Nunca rodar anuncio que eu nao usaria

Vai ter publicidade neste site — Google Ads porque blog precisa pagar servidor, e autopromocao dos meus proprios projetos. Mas eu prometi que nunca vou rodar anuncio de terceiro que eu mesmo nao usaria. Sem affiliate link de curso que eu nao fiz. Sem banner de produto que eu nao testei.

### 3. Nao transformar em startup

Este lugar e um caderno, nao um produto. Nao vai ter CEO. Nao vai ter series A. Nao vai virar uma holding[^3]. Quando eu cansar — e eu vou cansar — eu paro de publicar, deixo o arquivo no ar, e vou fazer outra coisa. Esse e o acordo comigo mesmo.

:::callout
Se voce achar este site daqui a cinco anos e a ultima publicacao for de 2028, e porque eu estava cansado e fui fazer outra coisa. Ta tudo bem. O arquivo fica.
:::

## Como navegar

Se voce e dev, vai curtir a categoria **Codigo**. Se voce gosta de diario, o **Diario** e onde moram os textos curtos e pessoais. **Ensaios** e onde eu me demoro em um assunto. **Produto** e **Ferramentas** sao pra quem quer saber como eu construo e com o que.

A [newsletter](#newsletter) e o melhor jeito de nao perder nada. Quatro cartas diferentes — voce escolhe quais assinar. Sem spam, cancelar e um clique.

E se voce caiu aqui por acaso — oi. Fica. Le o que te chamar atencao. Vai embora. Volta quando quiser. E isso.

[^1]: A junction table tem tres colunas: `post_id`, `destination_id`, `rendered_at`. Isso e suficiente pra saber pra onde cada post foi e quando. O resto e template por destino.

[^2]: Ryan Holiday chama isso de "Finished is better than perfect". Eu descobri do jeito dificil: o melhor texto da minha vida morreu na pasta `drafts/` porque eu queria "so mais uma revisao". Tres anos depois ainda esta la.

[^3]: Isso inclui aceitar patrocinio. Se eu aceitar grana pra publicar algo, vira um produto. Se vira um produto, tem cliente. Se tem cliente, tem stakeholder. Se tem stakeholder, acabou o caderno.';

  insert into public.blog_translations (post_id, locale, title, slug, excerpt, content_mdx, reading_time_min, content_toc)
  values (
    v_post_id,
    'pt-BR',
    'Manifesto: um caderno aberto na internet',
    'manifesto',
    'Eu tenho seis apps em producao, um canal bilingue, uma newsletter de 1.400 leitores, e 83 drafts que nunca viram a luz. Este site e onde eu junto tudo.',
    v_content_pt,
    5,
    '[{"slug":"o-que-nao-e","text":"O que nao e","depth":2},{"slug":"o-que-e-entao","text":"O que e, entao","depth":2},{"slug":"um-parentese-sobre-o-cms","text":"Um parentese sobre o CMS","depth":3},{"slug":"as-tres-promessas","text":"As tres promessas","depth":2},{"slug":"1-escrever-mesmo-quando-for-ruim","text":"1. Escrever mesmo quando for ruim","depth":3},{"slug":"2-nunca-rodar-anuncio-que-eu-nao-usaria","text":"2. Nunca rodar anuncio que eu nao usaria","depth":3},{"slug":"3-nao-transformar-em-startup","text":"3. Nao transformar em startup","depth":3},{"slug":"como-navegar","text":"Como navegar","depth":2}]'::jsonb
  );

  -- 6. en translation
  v_content_en := '---
key_points:
  - "A notebook, not a product"
  - "Rhythm without rigidity — weekly when possible"
  - "Own CMS: one article, many destinations"
  - "Indirect monetization via Vagalume"
  - "The right to stop without guilt"
tags:
  - meta
  - manifesto
  - "2026"
  - hub
pull_quote: ''"a notebook, not a product"''
pull_quote_attribution: "promise 3"
hero_illustration: constellation
series_title: "Building in public: the project itself"
series_part: 1
series_total: 3
series_next_slug: um-cms-para-governar
series_next_title: "One CMS to rule them all — cross-site publishing architecture"
series_next_excerpt: "The architecture behind publishing the same post to six different sites without copy-paste."
colophon: "Written in iA Writer on a MacBook Air M2. Published by the CMS I built myself, running on Supabase + Vercel. Typography: Source Serif 4 for body, Inter for the rest. Header illustration drawn in SVG straight in the code — no stock photo, no Midjourney."
---

I have six apps in production, a bilingual YouTube channel, a newsletter that grew from 40 to 1,400 readers in a year, and a folder called `drafts/` with 83 `.md` files that never saw daylight. All of it lived scattered. This site is the place where I pull it together.

But before I explain what it is — let me explain what it *isn''t*. Because it''s the *isn''t* that kept me from doing this for three years.

## What it isn''t

This isn''t a portfolio. A portfolio is a museum — you visit, clap politely, leave. I don''t want a museum. I want a notebook open on the desk, with coffee spilled in the corner and notes in the margin.

It also isn''t a feed. A feed is an algorithm — it decides what you read. Here you decide. The order is chronological. The curation is mine. The reading is yours.

And it isn''t a corporate blog. I won''t write "5 tips to boost your productivity in 2026". I''ll write "week 14: I almost gave up". If it doesn''t help you — and it might not — at least it''ll be true.

> An open notebook is worse than a portfolio, but honest. I''ll take honest.

## What it is, then

It''s a hub. A central place that pulls together three things that used to live in separate folders in my head:

- **Writing** — posts, essays, journal entries. Portuguese and English, same head.
- **Videos** — what I film for the channel, with a link and a summary.
- **Newsletters** — four different letters, you pick the ones you want.

All of it pulls from the same CMS. One post of mine goes to the blog, to the newsletter, to the YouTube description, and to a campaign landing if I want — with *one click*. That''s what made me stop procrastinating and finally ship.

### An aside about the CMS

I spent three months building the engine before thinking about the design. That''s a dev thing — wrong, probably, but it''s what made sense. The idea is simple: instead of publishing six times, I publish once. The same content becomes six different things depending on where it''s going.

```ts
// Publish once, distribute where it matters
await publish(post, {
  sites: ["bythiago", "dev.bythiago", "tng-blog"],
  as: {
    newsletter: "main",
    campaign: null,
    youtube: { includeDescription: true },
  },
})
```

This isn''t magic. It''s a junction table in Supabase and a checkbox[^1]. But it''s what let me stop copy-pasting.

## The three promises

I promised myself three things when I opened this notebook. I''m putting them here in public so you can hold me accountable — and so I don''t forget when I get tired.

### 1. Write even when it''s bad

Of the 83 drafts in the folder, about 60 are bad. The mistake was thinking I could decide before writing whether they''d be good[^2]. You only find out by writing. So the promise is: finish it. Publish it. If it doesn''t hold up, delete it later. But finish.

### 2. Never run an ad I wouldn''t use myself

There will be advertising on this site — Google Ads because a blog has to pay its server, and self-promotion of my own projects. But I promised I''d never run a third-party ad for something I wouldn''t use myself. No affiliate links for courses I haven''t taken. No banner ads for products I haven''t tried.

### 3. Don''t turn it into a startup

This place is a notebook, not a product. There won''t be a CEO. There won''t be a Series A. It won''t become a holding company[^3]. When I get tired — and I will get tired — I stop publishing, leave the archive up, and go do something else. That''s the deal with myself.

:::callout
If you find this site five years from now and the last post is from 2028, it''s because I got tired and went to do something else. That''s okay. The archive stays.
:::

## How to get around

If you''re a dev, you''ll like the **Code** category. If you like journal stuff, **Journal** is where the short, personal pieces live. **Essays** is where I take my time on something. **Product** and **Tools** are for people who want to know how I build and with what.

The [newsletter](#newsletter) is the best way not to miss anything. Four different letters — pick the ones that interest you. No spam, unsubscribe is one click.

And if you landed here by accident — hi. Stay. Read whatever catches your eye. Leave. Come back whenever. That''s it.

[^1]: The junction table has three columns: `post_id`, `destination_id`, `rendered_at`. That''s enough to know where each post went and when. The rest is per-destination templating.

[^2]: Ryan Holiday calls this "Finished is better than perfect". I learned the hard way: the best piece I ever wrote died in `drafts/` because I wanted "just one more revision". Three years later, still there.

[^3]: That includes taking sponsorships. If I take money to publish something, it becomes a product. If it''s a product, it has customers. If it has customers, it has stakeholders. If it has stakeholders, the notebook is over.';

  insert into public.blog_translations (post_id, locale, title, slug, excerpt, content_mdx, reading_time_min, content_toc)
  values (
    v_post_id,
    'en',
    'Manifesto: an open notebook on the internet',
    'manifesto',
    'I have six apps in production, a bilingual YouTube channel, a newsletter with 1,400 readers, and 83 drafts that never saw daylight. This site is where I pull it all together.',
    v_content_en,
    5,
    '[{"slug":"what-it-isnt","text":"What it isn''t","depth":2},{"slug":"what-it-is-then","text":"What it is, then","depth":2},{"slug":"an-aside-about-the-cms","text":"An aside about the CMS","depth":3},{"slug":"the-three-promises","text":"The three promises","depth":2},{"slug":"1-write-even-when-its-bad","text":"1. Write even when it''s bad","depth":3},{"slug":"2-never-run-an-ad-i-wouldnt-use-myself","text":"2. Never run an ad I wouldn''t use myself","depth":3},{"slug":"3-dont-turn-it-into-a-startup","text":"3. Don''t turn it into a startup","depth":3},{"slug":"how-to-get-around","text":"How to get around","depth":2}]'::jsonb
  );

  raise notice 'Seeded manifesto post % with pt-BR + en translations', v_post_id;
end $$;
