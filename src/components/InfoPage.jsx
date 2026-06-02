import { COMPANY } from "../config/categories"
import styles from "./InfoPage.module.css"
import { PhoneCall, Truck, PackageSearch, Mail, Globe2 } from "lucide-react"

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
    icon: PackageSearch,
    title: "Productos a medida",
    text: "¿No encuentras lo que buscas? Pídenos cualquier producto y lo gestionamos por ti.",
  },
]

function WhatsAppIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.1 3.9A11.45 11.45 0 0 0 12 0.55C5.7 0.55 0.58 5.67 0.58 11.97c0 2.02 0.53 3.99 1.53 5.73L0.5 23.55l5.99-1.57a11.42 11.42 0 0 0 5.46 1.39h0.01c6.3 0 11.42-5.12 11.42-11.42A11.35 11.35 0 0 0 20.1 3.9Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M8.45 6.63c-0.25-0.55-0.51-0.56-0.75-0.57h-0.64c-0.22 0-0.58 0.08-0.88 0.41-0.3 0.33-1.16 1.13-1.16 2.76 0 1.63 1.19 3.2 1.35 3.42 0.16 0.22 2.29 3.67 5.67 5 2.81 1.1 3.39 0.88 4 0.82 0.61-0.05 1.97-0.8 2.25-1.58 0.28-0.77 0.28-1.44 0.19-1.58-0.08-0.14-0.3-0.22-0.64-0.39-0.33-0.16-1.97-0.97-2.27-1.08-0.3-0.11-0.52-0.17-0.75 0.16-0.22 0.33-0.86 1.08-1.05 1.3-0.19 0.22-0.39 0.25-0.72 0.08-0.33-0.16-1.41-0.52-2.69-1.66-0.99-0.88-1.66-1.98-1.85-2.31-0.19-0.33-0.02-0.51 0.14-0.68 0.15-0.15 0.33-0.39 0.5-0.58 0.17-0.19 0.22-0.33 0.33-0.55 0.11-0.22 0.06-0.41-0.03-0.58-0.08-0.16-0.72-1.79-1.01-2.4Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
          <span className={styles.contactItem}>
            <span className={styles.contactItemIcon} aria-label="Teléfono">
              <PhoneCall size={12} strokeWidth={2.2} />
            </span>
            <span className={styles.contactItemText}>{COMPANY.phone}</span>
          </span>
          <span className={styles.contactItem}>
            <span className={`${styles.contactItemIcon} ${styles.whatsappIcon}`} aria-label="WhatsApp">
              <WhatsAppIcon size={14} />
            </span>
            <span className={styles.contactItemText}>{COMPANY.whatsapp}</span>
          </span>
          <span className={styles.contactItem}>
            <span className={styles.contactItemIcon} aria-label="Email">
              <Mail size={12} strokeWidth={2.2} />
            </span>
            <span className={styles.contactItemText}>{COMPANY.email}</span>
          </span>
          <span className={styles.contactItem}>
            <span className={styles.contactItemIcon} aria-label="Web">
              <Globe2 size={12} strokeWidth={2.2} />
            </span>
            <span className={styles.contactItemText}>{COMPANY.web}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
