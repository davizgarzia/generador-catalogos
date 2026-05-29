import { COMPANY } from "../config/categories"
import styles from "./InfoPage.module.css"
import { PhoneCall, Truck, ShoppingCart, PackageSearch, ArrowRight } from "lucide-react"

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
        <div className={styles.kicker}>Distribución para profesionales</div>
        <h2>¿Por qué {COMPANY.name}?</h2>
        <p>
          Un catálogo internacional pensado para que restaurantes, tiendas y
          negocios especializados puedan comprar con agilidad y confianza.
        </p>
      </div>

      <div className={styles.main}>
        <div className={styles.statement}>
          <div className={styles.statementNumber}>+500</div>
          <div className={styles.statementText}>
            referencias seleccionadas para cubrir el día a día de tu negocio:
            bebidas, alimentación, congelado, refrigerado y mucho más.
          </div>
        </div>

        <div className={styles.benefits}>
        {INFO_ITEMS.map((item) => (
          <div key={item.title} className={styles.benefit}>
            <div className={styles.benefitIcon}>
              <item.icon size={18} strokeWidth={1.7} />
            </div>
            <div>
              <div className={styles.benefitTitle}>{item.title}</div>
              <div className={styles.benefitText}>{item.text}</div>
            </div>
          </div>
        ))}
        </div>
      </div>

      <div className={styles.contact}>
        <div>
          <div className={styles.contactLabel}>Realiza tu pedido</div>
          <div className={styles.contactHint}>Te ayudamos a preparar tu compra y resolver dudas de producto.</div>
        </div>
        <div className={styles.contactItems}>
          <span>{COMPANY.phone}</span>
          <span>{COMPANY.email}</span>
          <span>{COMPANY.web}</span>
        </div>
        <ArrowRight className={styles.contactIcon} size={22} strokeWidth={1.8} />
      </div>
    </div>
  )
}
