import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/features/legal/legal-page";
import { OWNER, SUBPROCESSORS } from "@/features/legal/owner";

export const metadata: Metadata = {
  title: "Contrato de encargo del tratamiento · Citaya",
  robots: { index: true, follow: true },
};

const contact = OWNER.email || `el WhatsApp ${OWNER.whatsapp}`;

const sections: LegalSection[] = [
  {
    title: "Partes y objeto",
    blocks: [
      {
        type: "p",
        text: `De una parte, el negocio que contrata Citaya (en adelante, «el Responsable»). De otra, ${OWNER.name}${OWNER.nif ? `, NIF ${OWNER.nif}` : ""}, titular de Citaya (en adelante, «el Encargado»).`,
      },
      {
        type: "p",
        text: "Este contrato, conforme al artículo 28 del Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD), regula cómo el Encargado trata, por cuenta del Responsable, los datos personales de sus clientes para prestarle el servicio Citaya: recepcionista de WhatsApp, agenda, página de reservas, confirmaciones y recordatorios.",
      },
    ],
  },
  {
    title: "Datos y personas afectadas",
    blocks: [
      {
        type: "ul",
        items: [
          "Personas afectadas: clientes y posibles clientes del Responsable, y su personal que usa el panel.",
          "Datos: nombre, teléfono, mensajes de WhatsApp, citas (servicio, profesional, fecha, hora, estado y notas) y datos de acceso del personal.",
          "Operaciones: recogida, registro, conservación, consulta, envío de mensajes, modificación y supresión, solo en la medida necesaria para el servicio.",
        ],
      },
      {
        type: "p",
        text: "El Responsable se compromete a no introducir en Citaya categorías especiales de datos (por ejemplo, de salud) salvo que sea imprescindible y lo haya acordado previamente con el Encargado.",
      },
    ],
  },
  {
    title: "Duración",
    blocks: [
      {
        type: "p",
        text: "Este contrato dura lo mismo que el servicio. Al terminar, el Encargado devolverá al Responsable, si lo pide en los 30 días siguientes, una copia de sus citas y contactos, y después suprimirá los datos, salvo los que deba conservar por obligación legal.",
      },
    ],
  },
  {
    title: "Obligaciones del Encargado",
    blocks: [
      {
        type: "ul",
        items: [
          "Tratar los datos solo siguiendo las instrucciones documentadas del Responsable y para prestar el servicio, nunca para fines propios.",
          "Mantener la confidencialidad y garantizar que quien acceda a los datos esté obligado a ella.",
          "Aplicar medidas de seguridad adecuadas: cifrado en tránsito, claves de integración cifradas, separación de datos entre negocios y acceso restringido.",
          "Ayudar al Responsable a atender los derechos de las personas (acceso, rectificación, supresión, oposición, etc.) y trasladarle cualquier solicitud que reciba directamente.",
          "Notificar al Responsable, sin dilación indebida, cualquier brecha de seguridad que afecte a sus datos, con la información disponible para que pueda cumplir sus obligaciones.",
          "Poner a disposición del Responsable la información necesaria para demostrar el cumplimiento de este contrato.",
        ],
      },
    ],
  },
  {
    title: "Subencargados",
    blocks: [
      {
        type: "p",
        text: "El Responsable autoriza al Encargado a usar los siguientes proveedores, que quedan sujetos a obligaciones de protección de datos equivalentes:",
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
        text: "Si el Encargado añade o cambia algún proveedor, avisará al Responsable con antelación, que podrá oponerse y, en su caso, dar por terminado el servicio. Las transferencias fuera del Espacio Económico Europeo se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales tipo de la Comisión Europea.",
      },
    ],
  },
  {
    title: "Obligaciones del Responsable",
    blocks: [
      {
        type: "ul",
        items: [
          "Contar con una base legal para tratar los datos de sus clientes e informarles de ello (por ejemplo, en su web o en su local).",
          "Dar instrucciones lícitas y mantener actualizada la información de su negocio en el panel.",
          "Usar las plantillas de WhatsApp y los envíos conforme a las normas de WhatsApp y a la normativa de comunicaciones comerciales.",
          "Custodiar sus claves de acceso al panel.",
        ],
      },
    ],
  },
  {
    title: "Aceptación",
    blocks: [
      {
        type: "p",
        text: `Este contrato forma parte de las condiciones del servicio Citaya y se entiende aceptado al darse de alta o al comenzar a usarlo. Si el Responsable desea una copia firmada, puede solicitarla en ${contact}.`,
      },
    ],
  },
];

export default function EncargoPage() {
  return (
    <LegalPage
      title="Contrato de encargo del tratamiento"
      intro="Para negocios que usan Citaya. Los datos de tus clientes son tuyos: Citaya solo los trata por tu cuenta para darte el servicio. Este contrato lo deja por escrito, como exige el RGPD."
      sections={sections}
    />
  );
}
