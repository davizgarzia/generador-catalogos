import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { Button } from "@/components/ui/button"

export default function LoginDialog({ open, onClose }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      await signIn(email, password)
      onClose()
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <form onSubmit={submit} style={{
        width: 360, background: "#fff", borderRadius: 12, padding: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,.2)",
      }}>
        <h2 style={{ margin: "0 0 18px", fontSize: 18 }}>Acceso de administración</h2>
        <label style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
          Email
          <input type="email" required value={email} onChange={event => setEmail(event.target.value)}
            style={{ display: "block", width: "100%", marginTop: 5, padding: 9, border: "1px solid #ddd", borderRadius: 6 }} />
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
          Contraseña
          <input type="password" required value={password} onChange={event => setPassword(event.target.value)}
            style={{ display: "block", width: "100%", marginTop: 5, padding: 9, border: "1px solid #ddd", borderRadius: 6 }} />
        </label>
        {error && <p style={{ color: "#b91c1c", fontSize: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="button" variant="outline" onClick={onClose} style={{ flex: 1 }}>Cancelar</Button>
          <Button type="submit" disabled={loading} style={{ flex: 1 }}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </div>
      </form>
    </div>
  )
}
