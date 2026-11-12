import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/features/legal/legal-page";
import { OWNER } from "@/features/legal/owner";

export const metadata: Metadata = {
  title: "Aviso legal · Citaya",
  robots: { index: true, follow: true },
};

const sections: LegalSection[] = [
  {
    title: "Datos del titular",
    blocks: [
      {
        type: "p",
        text: "En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se informa de los datos del titular de este sitio web:",
      },
      {
        type: "ul",
        items: [
          <>Titular: {OWNER.name}</>,
          ...(OWNER.nif ? [<>NIF: {OWNER.nif}</>] : []),
          <>Domicilio: {OWNER.address}</>,
          OWNER.email ? <>Email: {OWNER.email}</> : <>Contacto: WhatsApp {OWNER.whatsapp}</>,
          <>Sitio web: {OWNER.site} (marca comercial «{OWNER.brand}»)</>,
        ],
      },
    ],
  },
  {
    title: "Objeto",
    blocks: [
      {
        type: "p",
        text: "Citaya es un servicio para negocios con cita previa (peluquerías, barberías y similares) que incluye una recepcionista automática por WhatsApp, una agenda online, páginas de reservas para sus clientes y un panel de gestión. Este aviso regula el uso de holacitaya.app, de sus subdominios y de las páginas de reservas que los negocios publican en él.",
      },
    ],
  },
  {
    title: "Condiciones de uso",
    blocks: [
      {
        type: "p",
        text: "Quien navega por el sitio se compromete a usarlo de forma lícita y a no introducir datos falsos o de terceros sin su permiso, no intentar acceder a zonas restringidas y no realizar reservas masivas o fraudulentas. El titular puede bloquear el acceso a quien incumpla estas condiciones.",
      },
      {
        type: "p",
        text: "Las reservas que se hacen en la página de un negocio son un acuerdo entre la persona que reserva y ese negocio. Citaya proporciona la herramienta, pero no presta el servicio reservado (corte, tinte, etc.) ni responde de él.",
      },
    ],
  },
  {
    title: "Propiedad intelectual",
    blocks: [
      {
        type: "p",
        text: "La marca Citaya, el diseño de la web, sus textos y el software son propiedad de su titular o se usan con licencia. No se pueden copiar, distribuir ni modificar sin autorización. Los nombres, logotipos y contenidos de cada negocio pertenecen a ese negocio.",
      },
    ],
  },
  {
    title: "Responsabilidad",
    blocks: [
      {
        type: "p",
        text: "El titular trabaja para que el servicio funcione de forma continua y sin errores, pero no puede garantizarlo en todo momento. No se hace responsable de interrupciones causadas por terceros (proveedores de alojamiento, WhatsApp, conexión a internet) ni del uso indebido que los usuarios hagan del sitio.",
      },
      {
        type: "p",
        text: "Las respuestas de la recepcionista se generan automáticamente a partir de la información que cada negocio proporciona. Si un dato es incorrecto, el negocio debe corregirlo en su panel.",
      },
    ],
  },
  {
    title: "Protección de datos y cookies",
    blocks: [
      {
        type: "p",
        text: "El tratamiento de datos personales se explica en la Política de privacidad y cookies, disponible en el pie de cada página.",
      },
    ],
  },
  {
    title: "Ley aplicable",
    blocks: [
      {
        type: "p",
        text: "Este aviso se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan según la ley; si quien reclama es consumidor, los de su domicilio.",
      },
    ],
  },
];

export default function AvisoLegalPage() {
  return <LegalPage title="Aviso legal" sections={sections} />;
}
