-- O aceite de convite com usuário explícito e a leitura do convite pelo token só são
-- chamados pelo servidor (service role), depois de ele conferir quem está aceitando.
--
-- accept_invitation_atomic(p_token_hash, p_user_id) é SECURITY DEFINER e não confere
-- auth.uid() nem o e-mail: com EXECUTE para anon/authenticated, quem tivesse o link de
-- um convite podia chamar a função direto pela API e gravar o vínculo em QUALQUER conta
-- (p_user_id à escolha), passando por fora da conferência de e-mail da server action.
-- get_invitation_by_token devolve o e-mail do convidado e de quem convidou.
--
-- A sobrecarga antiga accept_invitation_atomic(p_token) fica como está: ela usa auth.uid().

revoke all on function public.accept_invitation_atomic(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_invitation_atomic(text, uuid) to service_role;

revoke all on function public.get_invitation_by_token(text) from public, anon, authenticated;
grant execute on function public.get_invitation_by_token(text) to service_role;
