import { COMPANY } from "../config/categories"
import styles from "./InfoPage.module.css"
import { PhoneCall, Truck, ShoppingCart, PackageSearch } from "lucide-react"

const INFO_ITEMS = [
  {
    icon: PhoneCall,
    title: "Atención personalizada",
    text: `Atención telefónica de ${COMPANY.hours}, excepto festivos nacionales y de la Comunidad Valenciana.`,
  },
  {
    icon: Truck,
    title: "Distribución nacional",
    text: "Rutas semanales fijas en distribución nacional e internacional. Tu pedido llega donde lo necesitas.",
  },
  {
    icon: ShoppingCart,
    title: `Pedido mínimo ${COMPANY.minOrder}`,
    text: "Accesible para todo tipo de negocios. Sin complicaciones, sin grandes compromisos de volumen.",
  },
  {
    icon: PackageSearch,
    title: "Productos a medida",
    text: "¿No encuentras lo que buscas? Pídenos cualquier producto y lo gestionamos por ti.",
  },
]

export default function InfoPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>¿Por qué {COMPANY.name}?</h2>
        <p>Tu distribuidor de confianza en productos internacionales</p>
      </div>

      <div className={styles.grid}>
        {INFO_ITEMS.map((item) => (
          <div key={item.title} className={styles.card}>
            <item.icon className={styles.cardIcon} size={20} strokeWidth={1.5} />
            <div className={styles.cardTitle}>{item.title}</div>
            <div className={styles.cardText}>{item.text}</div>
          </div>
        ))}
      </div>

      <div className={styles.contact}>
        <div className={styles.contactLabel}>Realiza tu pedido</div>
        <div className={styles.contactItems}>
          <span>{COMPANY.phone}</span>
          <span>{COMPANY.email}</span>
          <span>{COMPANY.web}</span>
        </div>
      </div>
    </div>
  )
}
