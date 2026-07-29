// QR de AFIP para comprobantes electrónicos (RG 4291). El QR codifica una URL
// https://www.afip.gob.ar/fe/qr/?p=<base64> donde <base64> es un JSON con los
// datos del comprobante. Sin este QR el comprobante impreso no es válido.

export type FacturaQrData = {
  fecha: string; // YYYY-MM-DD (fecha de emisión)
  cuit: number; // CUIT del emisor
  ptoVta: number;
  tipoCmp: number; // CbteTipo (Factura C = 11)
  nroCmp: number; // CbteNro
  importe: number; // ImpTotal
  moneda: string; // "PES"
  ctz: number; // cotización de la moneda (1 para PES)
  tipoDocRec?: number; // DocTipo receptor (99 = Consumidor Final)
  nroDocRec?: number; // DocNro receptor (0)
  codAut: number; // CAE
};

export function buildAfipQrUrl(data: FacturaQrData): string {
  const payload = {
    ver: 1,
    fecha: data.fecha,
    cuit: data.cuit,
    ptoVta: data.ptoVta,
    tipoCmp: data.tipoCmp,
    nroCmp: data.nroCmp,
    importe: data.importe,
    moneda: data.moneda,
    ctz: data.ctz,
    tipoDocRec: data.tipoDocRec ?? 99,
    nroDocRec: data.nroDocRec ?? 0,
    tipoCodAut: "E", // "E" = CAE
    codAut: data.codAut,
  };
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

/** Genera el QR como data URL PNG para embeber en el PDF. */
export async function buildAfipQrDataUrl(data: FacturaQrData): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(buildAfipQrUrl(data), {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
}
