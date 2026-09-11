import { useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "../context/AuthContext"

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-svh grid place-items-center text-sm text-muted-foreground">
        Comprobando sesión…
      </div>
    )
  }

  if (user) {
    const from = location.state?.from ?? "/catalog"
    return <Navigate to={from} replace />
  }

  async function submit(event) {
    event.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await signIn(email, password)
      const from = location.state?.from ?? "/catalog"
      navigate(from, { replace: true })
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh grid place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <div className="size-10 bg-primary text-primary-foreground rounded-lg grid place-items-center mb-2">
            <span className="text-sm font-bold">IM</span>
          </div>
          <CardTitle>Impormed</CardTitle>
          <CardDescription>Accede al panel de catálogo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
