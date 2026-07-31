"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import {
  generarLlaveAction,
  subirCertificadoAction,
  verificarCertificadoAction,
} from "@/app/actions/certificado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeCuit } from "@/lib/fiscal-profile";
import type { PasoWizard } from "@/lib/fiscal/estado";

type CertificadoWizardProps = {
  paso: PasoWizard;
  cuitVerificado: string | null;
  venceEl: string | null;
};

const TOTAL_PASOS = 5;

// "subir" nunca lo devuelve pasoDelWizard (vive dentro de "tramite"), pero
// como forma parte del tipo lo mapeamos igual para que este objeto sea
// exhaustivo sin recurrir a un cast.
const PASO_INDEX: Record<PasoWizard, number> = {
  datos: 1,
  generar: 2,
  tramite: 3,
  subir: 3,
  verificar: 4,
  listo: 5,
};

const DIAS_AVISO_RENOVACION = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const ERROR_GENERAR_LLAVE =
  "No pudimos generar tu llave. Probá de nuevo en un momento.";
const ERROR_SUBIR_CERTIFICADO =
  "No pudimos guardar el certificado. Probá de nuevo en un momento.";
const ERROR_VERIFICAR =
  "No pudimos completar la verificación. Probá de nuevo en un momento.";

/** Dispara la descarga del CSR en el navegador. La clave privada nunca sale del servidor. */
function descargarCsr(csrPem: string, nombreArchivo: string): void {
  const blob = new Blob([csrPem], { type: "application/x-pem-file" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

function diasHastaVencimiento(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / MS_POR_DIA);
}

export function CertificadoWizard({
  paso,
  cuitVerificado,
  venceEl,
}: CertificadoWizardProps) {
  const router = useRouter();

  const [loadingGenerar, setLoadingGenerar] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);

  const [loadingRedescargar, setLoadingRedescargar] = useState(false);
  const [errorRedescargar, setErrorRedescargar] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingSubir, setLoadingSubir] = useState(false);
  const [errorSubir, setErrorSubir] = useState<string | null>(null);

  const [loadingVerificar, setLoadingVerificar] = useState(false);
  const [errorVerificar, setErrorVerificar] = useState<string | null>(null);

  async function handleGenerar() {
    setLoadingGenerar(true);
    setErrorGenerar(null);
    try {
      const res = await generarLlaveAction();
      if (res.ok) {
        descargarCsr(res.csrPem, res.nombreArchivo);
        router.refresh();
      } else {
        setErrorGenerar(res.error);
      }
    } catch {
      setErrorGenerar(ERROR_GENERAR_LLAVE);
    } finally {
      setLoadingGenerar(false);
    }
  }

  async function handleRedescargar() {
    setLoadingRedescargar(true);
    setErrorRedescargar(null);
    try {
      const res = await generarLlaveAction();
      if (res.ok) {
        descargarCsr(res.csrPem, res.nombreArchivo);
      } else {
        setErrorRedescargar(res.error);
      }
    } catch {
      setErrorRedescargar(ERROR_GENERAR_LLAVE);
    } finally {
      setLoadingRedescargar(false);
    }
  }

  async function handleSubir() {
    const archivo = fileInputRef.current?.files?.[0];
    if (!archivo) {
      setErrorSubir("Elegí el archivo .crt que bajaste de ARCA.");
      return;
    }

    const formData = new FormData();
    formData.set("cert", archivo);

    setLoadingSubir(true);
    setErrorSubir(null);
    try {
      const res = await subirCertificadoAction(formData);
      if (res.ok) {
        router.refresh();
      } else {
        setErrorSubir(res.error);
      }
    } catch {
      setErrorSubir(ERROR_SUBIR_CERTIFICADO);
    } finally {
      setLoadingSubir(false);
    }
  }

  async function handleVerificar() {
    setLoadingVerificar(true);
    setErrorVerificar(null);
    try {
      const res = await verificarCertificadoAction();
      if (res.ok) {
        router.refresh();
      } else {
        setErrorVerificar(res.error);
      }
    } catch {
      setErrorVerificar(ERROR_VERIFICAR);
    } finally {
      setLoadingVerificar(false);
    }
  }

  const cuitFormateado = cuitVerificado ? normalizeCuit(cuitVerificado) : null;
  const fechaVencimiento = venceEl ? formatearFecha(venceEl) : null;
  const diasRestantes = venceEl ? diasHastaVencimiento(venceEl) : null;
  const proximoAVencer =
    diasRestantes !== null && diasRestantes > 0 && diasRestantes <= DIAS_AVISO_RENOVACION;

  return (
    <section className="shell-panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="space-y-1">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-[11px] font-medium text-muted-foreground">
          Paso {PASO_INDEX[paso]} de {TOTAL_PASOS}
        </span>
        <h3 className="text-xl font-semibold tracking-tight">
          Certificado digital de ARCA
        </h3>
        <p className="text-sm text-muted-foreground">
          Es lo que necesitás para que Cotizapp pueda emitir tus facturas
          electrónicas.
        </p>
      </div>

      {paso === "datos" ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Primero completá tus datos fiscales acá abajo: CUIT, razón social y
          punto de venta.
        </p>
      ) : null}

      {paso === "generar" ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            Cotizapp te genera la llave privada automáticamente: no hace falta
            instalar nada ni usar la terminal. Vas a bajar un archivo (el{" "}
            <code>.csr</code>) que necesitás para el trámite en ARCA.
          </p>
          <Button
            type="button"
            onClick={handleGenerar}
            disabled={loadingGenerar}
            className="min-h-11 w-full sm:w-fit"
          >
            {loadingGenerar ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {loadingGenerar ? "Generando tu llave..." : "Generar mi llave"}
          </Button>
          {errorGenerar ? (
            <p className="text-sm text-destructive">{errorGenerar}</p>
          ) : null}
        </div>
      ) : null}

      {paso === "tramite" || paso === "subir" ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm leading-6 text-foreground">
              Ya generamos tu llave. Ahora te toca hacer esto en el sitio de
              ARCA:
            </p>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-foreground">
              <li>
                Entrá a ARCA con tu Clave Fiscal y andá a{" "}
                <strong>Administración de Certificados Digitales</strong>. Subí
                el archivo <code>.csr</code> que descargaste y bajá el{" "}
                <code>.crt</code> que te genera.
              </li>
              <li>
                Andá a <strong>Administrador de Relaciones</strong> y delegá el
                servicio de <strong>Facturación Electrónica</strong> al
                certificado que acabás de crear.
              </li>
              <li>
                Andá a{" "}
                <strong>Regímenes de Facturación y Registración</strong> y creá
                tu punto de venta con el tipo <strong>Web Services</strong>.
              </li>
            </ol>
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                Los pasos 2 y 3 son los que más se saltean, y sin ellos la
                facturación no va a funcionar aunque el certificado esté bien
                cargado. No te quedes solo con el paso 1.
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-token/80 pt-4">
            <Label htmlFor="cert-file">
              Certificado (.crt) que bajaste de ARCA
            </Label>
            <Input
              id="cert-file"
              name="cert"
              type="file"
              accept=".crt,.pem"
              ref={fileInputRef}
            />
            <Button
              type="button"
              onClick={handleSubir}
              disabled={loadingSubir}
              className="min-h-11 w-full sm:w-fit"
            >
              {loadingSubir ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              {loadingSubir ? "Subiendo..." : "Subir certificado"}
            </Button>
            {errorSubir ? (
              <p className="text-sm text-destructive">{errorSubir}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Button
              type="button"
              variant="link"
              onClick={handleRedescargar}
              disabled={loadingRedescargar}
              className="h-auto min-h-0 p-0 text-sm"
            >
              {loadingRedescargar
                ? "Generando..."
                : "¿Perdiste el archivo .csr? Volvé a descargarlo"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Esto genera un archivo nuevo. Si ya le diste el anterior a ARCA,
              usá este de acá en adelante.
            </p>
            {errorRedescargar ? (
              <p className="text-sm text-destructive">{errorRedescargar}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {paso === "verificar" ? (
        <div className="space-y-3">
          <div className="space-y-1 text-sm text-foreground">
            {cuitFormateado ? <p>CUIT del certificado: {cuitFormateado}</p> : null}
            {fechaVencimiento ? <p>Vence el {fechaVencimiento}</p> : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Ahora probamos la conexión con ARCA. Es una prueba de solo
            lectura: no emite ninguna factura.
          </p>
          <Button
            type="button"
            onClick={handleVerificar}
            disabled={loadingVerificar}
            className="min-h-11 w-full sm:w-fit"
          >
            {loadingVerificar ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {loadingVerificar ? "Probando conexión..." : "Probar conexión con ARCA"}
          </Button>
          {errorVerificar ? (
            <p className="text-sm text-destructive">{errorVerificar}</p>
          ) : null}
        </div>
      ) : null}

      {paso === "listo" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-accent-token" />
            <p className="text-sm font-semibold text-foreground">
              Ya podés emitir facturas
            </p>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            {cuitFormateado ? <p>CUIT verificado: {cuitFormateado}</p> : null}
            {fechaVencimiento ? <p>Vence el {fechaVencimiento}</p> : null}
          </div>
          {proximoAVencer ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                Tu certificado vence en {diasRestantes} día
                {diasRestantes === 1 ? "" : "s"}. Antes de esa fecha, repetí el
                trámite en ARCA para renovarlo y no te quedes sin poder
                facturar.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
