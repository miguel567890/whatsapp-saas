import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/features/legal/legal-page";
import { OWNER, SUBPROCESSORS } from "@/features/legal/owner";

export const metadata: Metadata = {
  title: "Privacidad y cookies · Citaya",
  robots: { index: true, follow: true },
};

const contact = OWNER.email || `el WhatsApp ${OWNER.whatsapp}`;

const sections: LegalSection[] = [
  {
    title: "Quién trata tus datos",
    blocks: [
      {
        type: "p",
        text: `Responsable: ${OWNER.name}${OWNER.nif ? `, NIF ${OWNER.nif}` : ""}, con domicilio en ${OWNER.address}. Contacto para cualquier tema de privacidad: ${contact}.`,
      },
      {
        type: "p",
        text: "Hay que distinguir dos situaciones, porque el responsable cambia:",
      },
      {
        type: "ul",
        items: [
          <>
            <strong className="text-foreground">Si contactas con Citaya</strong> (por esta web o por el WhatsApp de Citaya) o eres un negocio
            que usa el servicio, el responsable de tus datos es el titular de Citaya.
          </>,
          <>
            <strong className="text-foreground">Si reservas cita o escribes a un negocio</strong> que usa Citaya (por ejemplo, una
            peluquería), el responsable es <strong className="text-foreground">ese negocio</strong>. Citaya solo trata tus datos
            por su cuenta, como encargado del tratamiento, para gestionar su agenda y su WhatsApp. Para ejercer tus derechos
            puedes dirigirte al negocio o a Citaya, y lo trasladaremos.
          </>,
        ],
      },
    ],
  },
  {
    title: "Qué datos tratamos y para qué",
    blocks: [
      {
        type: "ul",
        items: [
          <>
            <strong className="text-foreground">Reservas:</strong> nombre, teléfono, servicio, día y hora elegidos. Sirven
            para gestionar la cita y, si marcas la casilla, para enviarte por WhatsApp la confirmación y el recordatorio.
          </>,
          <>
            <strong className="text-foreground">Conversaciones de WhatsApp:</strong> número, nombre de perfil y mensajes. Sirven
            para responderte, darte cita y atender cambios o cancelaciones.
          </>,
          <>
            <strong className="text-foreground">Negocios clientes:</strong> nombre y email de acceso, datos del negocio y
            facturación. Sirven para prestar el servicio contratado y facturarlo.
          </>,
          <>
            <strong className="text-foreground">Datos técnicos:</strong> registros de acceso y de errores para mantener la
            seguridad y el buen funcionamiento del servicio.
          </>,
        ],
      },
      {
        type: "p",
        text: "No vendemos datos, no los usamos para publicidad de terceros ni tomamos decisiones automatizadas con efectos legales sobre ti. La recepcionista usa inteligencia artificial solo para redactar respuestas y gestionar citas.",
      },
    ],
  },
  {
    title: "Base legal",
    blocks: [
      {
        type: "ul",
        items: [
          "Gestionar una cita o responder a tu consulta: la ejecución del servicio que tú mismo solicitas.",
          "Enviarte la confirmación y el recordatorio por WhatsApp: tu consentimiento (la casilla del formulario o el hecho de escribirnos por WhatsApp). Puedes retirarlo cuando quieras pidiéndolo en la propia conversación o al negocio.",
          "Prestar el servicio a los negocios y facturarlo: el contrato y las obligaciones legales (fiscales y contables).",
          "Seguridad del servicio: el interés legítimo en proteger la plataforma y a sus usuarios.",
        ],
      },
    ],
  },
  {
    title: "Cuánto tiempo se guardan",
    blocks: [
      {
        type: "ul",
        items: [
          "Citas y conversaciones: mientras el negocio use Citaya o hasta que se solicite su supresión. Al terminar el servicio se devuelven o eliminan según el contrato con el negocio.",
          "Datos de negocios clientes: mientras dure la relación y, después, el tiempo que exijan las obligaciones legales (por ejemplo, fiscales).",
          "Registros técnicos: el tiempo imprescindible para la seguridad, normalmente unos meses.",
        ],
      },
    ],
  },
  {
    title: "Con quién se comparten",
    blocks: [
      {
        type: "p",
        text: "Solo con el negocio con el que reservas y con los proveedores que necesitamos para que el servicio funcione, que actúan como encargados del tratamiento y tienen contratos que les obligan a proteger los datos:",
      },
      {
        type: "ul",
        items: SUBPROCESSORS.map((s) => (
          <>
            <strong className="text-foreground">{s.name}</strong>: {s.role} ({s.where}).
          </>
        )),
      },
      {
        type: "p",
        text: "Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo. En esos casos las transferencias se amparan en las garantías previstas en el RGPD, como el Marco de Privacidad de Datos UE-EE. UU. o las cláusulas contractuales tipo de la Comisión Europea.",
      },
    ],
  },
  {
    title: "Tus derechos",
    blocks: [
      {
        type: "p",
        text: `Puedes pedir acceso a tus datos, su rectificación o supresión, limitar u oponerte a su tratamiento, su portabilidad y retirar el consentimiento, escribiendo a ${contact}. Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`,
      },
      {
        type: "p",
        text: "Para dejar de recibir mensajes de WhatsApp de un negocio, basta con pedirlo en esa conversación o decírselo al negocio.",
      },
    ],
  },
  {
    title: "Seguridad",
    blocks: [
      {
        type: "p",
        text: "Los datos viajan cifrados (HTTPS), las claves de conexión con WhatsApp se guardan cifradas y cada negocio solo puede ver su propia información. Solo el personal imprescindible tiene acceso, y únicamente para dar soporte.",
      },
    ],
  },
  {
    title: "Cookies",
    blocks: [
      {
        type: "p",
        text: "Este sitio solo usa cookies y almacenamiento técnicos, imprescindibles para que funcione, por lo que no requieren tu consentimiento:",
      },
      {
        type: "ul",
        items: [
          "Sesión de acceso al panel de los negocios (para mantener la sesión iniciada).",
          "Negocio activo y preferencias de pantalla (por ejemplo, tema claro u oscuro, o si has cerrado el aviso para instalar la app).",
        ],
      },
      {
        type: "p",
        text: "No usamos cookies de analítica, publicidad ni seguimiento. Si algún día se añadieran, se pedirá antes tu permiso.",
      },
    ],
  },
  {
    title: "Cambios en esta política",
    blocks: [
      {
        type: "p",
        text: "Si cambia algo importante, actualizaremos esta página y la fecha de arriba, y avisaremos a los negocios clientes.",
      },
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de privacidad y cookies"
      intro="Aquí te explicamos, sin letra pequeña, qué datos se recogen cuando usas Citaya o reservas en un negocio que lo usa, para qué y qué puedes hacer con ellos."
      sections={sections}
    />
  );
}
