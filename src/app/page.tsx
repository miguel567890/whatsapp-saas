import { headers } from "next/headers";
import { redirect } from "next/navigation";
import WelcomePage, { metadata as welcomeMetadata } from "./bienvenida/page";

const PUBLIC_HOST = new RegExp(
  `^${process.env.PUBLIC_HOST_RE ?? "(?:www\\.)?holacitaya\\.app"}$`,
  "i",
);

async function isPublicHost(): Promise<boolean> {
  const host = ((await headers()).get("host") ?? "").split(":")[0];
  return PUBLIC_HOST.test(host);
}

export async function generateMetadata() {
  return (await isPublicHost()) ? welcomeMetadata : {};
}

// holacitaya.app → portada de Citaya. Panel → bandeja de entrada.
export default async function Home() {
  if (await isPublicHost()) return <WelcomePage />;
  redirect("/inbox");
}
