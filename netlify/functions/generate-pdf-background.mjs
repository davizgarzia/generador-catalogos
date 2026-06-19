import chromium from "@sparticuz/chromium"
import puppeteer from "puppeteer-core"
import { createClient } from "@supabase/supabase-js"

export default async function handler(request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const authorization = request.headers.get("authorization")
  const token = authorization?.replace(/^Bearer\s+/i, "")
  const { exportId } = await request.json()

  if (!supabaseUrl || !serviceRoleKey || !token || !exportId) {
    return new Response("Invalid request", { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return new Response("Unauthorized", { status: 401 })

  const { data: admin } = await supabase
    .from("catalog_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle()
  if (!admin) return new Response("Forbidden", { status: 403 })

  const { data: job, error: jobError } = await supabase
    .from("pdf_exports")
    .select("id,catalog_id,requested_by,options,catalog:catalogs(slug,edition)")
    .eq("id", exportId)
    .eq("requested_by", userData.user.id)
    .single()
  if (jobError) return new Response("Export not found", { status: 404 })

  let browser
  try {
    await supabase.from("pdf_exports").update({
      status: "processing",
      updated_at: new Date().toISOString(),
    }).eq("id", exportId)

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1600, height: 900 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    const baseUrl = process.env.DEPLOY_PRIME_URL || process.env.URL
    const params = new URLSearchParams({
      marks: job.options.marks ? "1" : "0",
      size: job.options.size || "A4",
      draft: job.options.draft ? "1" : "0",
      grid: job.options.grid || "4x4",
      hideNoImage: job.options.hideNoImage ? "1" : "0",
      render: "pdf",
    })

    await page.goto(`${baseUrl}/?${params}`, {
      waitUntil: "networkidle0",
      timeout: 120000,
    })
    await page.emulateMediaType("print")
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map(image => {
        if (image.complete) return Promise.resolve()
        return new Promise(resolve => {
          image.onload = resolve
          image.onerror = resolve
        })
      }))
    })

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 120000,
    })
    const storagePath = `${userData.user.id}/${exportId}.pdf`
    const { error: uploadError } = await supabase.storage
      .from("catalog-pdfs")
      .upload(storagePath, pdf, {
        upsert: true,
        contentType: "application/pdf",
      })
    if (uploadError) throw uploadError

    await supabase.from("pdf_exports").update({
      status: "completed",
      storage_path: storagePath,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", exportId)

    return new Response("Accepted", { status: 202 })
  } catch (error) {
    await supabase.from("pdf_exports").update({
      status: "failed",
      error_message: error.message,
      updated_at: new Date().toISOString(),
    }).eq("id", exportId)
    return new Response("Failed", { status: 500 })
  } finally {
    await browser?.close()
  }
}

export const config = {
  background: true,
  path: "/.netlify/functions/generate-pdf-background",
}
