// Estado del wizard del certificado. Puro para que la UI no tenga que decidir
// nada: cada estado muestra un solo paso, el siguiente.

export type PasoWizard =
  | "datos"      // faltan CUIT, razón social y punto de venta
  | "generar"    // hay datos, falta la llave
  | "tramite"    // hay llave, falta el certificado de ARCA
  | "subir"      // reservado: el paso de subida vive dentro de "tramite"
  | "verificar"  // hay certificado, falta probar la conexión
  | "listo";     // verificado y vigente

export type EntradaEstado = {
  tieneDatosFiscales: boolean;
  tieneLlave: boolean;
  tieneCertificado: boolean;
  verificado: boolean;
  certVencido: boolean;
};

export function pasoDelWizard(input: EntradaEstado): PasoWizard {
  if (!input.tieneDatosFiscales) {
    return "datos";
  }

  // Un certificado vencido manda de vuelta al trámite: hay que sacar uno nuevo
  // en ARCA, aunque en su momento haya estado verificado.
  if (input.certVencido) {
    return "tramite";
  }

  if (!input.tieneLlave) {
    return "generar";
  }

  if (!input.tieneCertificado) {
    return "tramite";
  }

  if (!input.verificado) {
    return "verificar";
  }

  return "listo";
}
