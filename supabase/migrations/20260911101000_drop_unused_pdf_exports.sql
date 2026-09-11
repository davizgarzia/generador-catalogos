-- La generación de PDF server-side (Puppeteer en Netlify) se retiró en favor de la
-- impresión nativa del navegador. La tabla pdf_exports quedó sin escritores ni lectores.
-- El bucket catalog-pdfs se conserva: si contiene PDFs antiguos, vaciarlo y eliminarlo
-- manualmente desde el panel de Supabase.

drop policy if exists "admins read generated pdf files" on storage.objects;

drop table if exists public.pdf_exports cascade;
