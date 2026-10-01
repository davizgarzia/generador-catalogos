-- Supabase Storage quedó retirado: las imágenes de producto viven en Cloudflare
-- R2 y los assets de marca en public/brand/. Esta migración elimina las
-- políticas de los buckets heredados. Los objetos y los propios buckets se
-- eliminan con `node scripts/delete-legacy-storage-buckets.mjs` (vía API de
-- Storage: borrarlos por SQL dejaría los ficheros físicos huérfanos).

drop policy if exists "catalog admins insert images" on storage.objects;
drop policy if exists "catalog admins update images" on storage.objects;
drop policy if exists "catalog admins delete images" on storage.objects;

drop policy if exists "catalog admins insert assets" on storage.objects;
drop policy if exists "catalog admins update assets" on storage.objects;
drop policy if exists "catalog admins delete assets" on storage.objects;

-- Nombres antiguos ya retirados en migraciones previas, por si algún entorno
-- los conserva.
drop policy if exists "catalog images are publicly readable" on storage.objects;
drop policy if exists "authenticated users manage catalog images" on storage.objects;
drop policy if exists "admins read generated pdf files" on storage.objects;

-- Red de seguridad: cualquier otra política sobre storage.objects que mencione
-- los buckets heredados.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ~ 'catalog-(images|assets|pdfs)'
        or coalesce(with_check, '') ~ 'catalog-(images|assets|pdfs)'
      )
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end
$$;
