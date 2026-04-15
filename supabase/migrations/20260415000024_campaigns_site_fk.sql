alter table public.campaigns
  add constraint campaigns_site_id_fkey
  foreign key (site_id) references public.sites(id) on delete restrict;
