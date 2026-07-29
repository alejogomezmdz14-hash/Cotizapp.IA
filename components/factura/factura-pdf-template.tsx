import React from "react";
import {
  Document,
  type DocumentProps,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatCurrencyAmount } from "@/lib/formatting";

const INK = "#111827";
const GRAY_600 = "#4B5563";
const GRAY_400 = "#9CA3AF";
const BORDER = "#111827";

export type FacturaPdfItem = {
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type FacturaPdfData = {
  razonSocial: string;
  cuit: string; // "20-44757535-4"
  puntoVenta: string; // "0001"
  numeroComprobante: string; // "00000001"
  fechaEmision: string; // "28/06/2026"
  clienteNombre: string;
  items: FacturaPdfItem[];
  total: number;
  currency: string | null;
  cae: string;
  caeVencimiento: string; // "28/06/2026"
  qrDataUrl: string;
  esPrueba: boolean; // homologación / demo → sin valor fiscal
};

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    fontSize: 9,
    color: INK,
    fontFamily: "Helvetica",
  },
  pruebaBanner: {
    marginBottom: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderStyle: "solid",
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: "center",
    fontSize: 8,
    color: "#92400E",
  },
  header: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
  },
  headerSide: { width: "44%", padding: 10 },
  headerCenter: {
    width: "12%",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
  },
  letra: { fontSize: 30, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  codigo: { fontSize: 7, color: GRAY_600, marginTop: 2 },
  facturaTitle: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  emisorNombre: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  line: { marginBottom: 2 },
  label: { color: GRAY_600 },
  bold: { fontFamily: "Helvetica-Bold" },
  receptor: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
    padding: 8,
  },
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "solid",
  },
  th: {
    backgroundColor: "#F3F4F6",
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  cellDesc: { width: "52%", padding: 5 },
  cellQty: { width: "12%", padding: 5, textAlign: "right" },
  cellPrice: { width: "18%", padding: 5, textAlign: "right" },
  cellTotal: { width: "18%", padding: 5, textAlign: "right" },
  totalRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  totalLabel: { fontSize: 9, color: GRAY_600, textAlign: "right" },
  totalValue: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  footer: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  qr: { width: 96, height: 96 },
  caeBlock: { alignItems: "flex-end" },
  caeText: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  disclaimer: { marginTop: 6, fontSize: 7, color: GRAY_400 },
});

export function createFacturaPdfDocument(
  data: FacturaPdfData,
): React.ReactElement<DocumentProps> {
  const money = (value: number) => formatCurrencyAmount(value, data.currency);

  return (
    <Document title={`Factura ${data.puntoVenta}-${data.numeroComprobante}`}>
      <Page size="A4" style={styles.page}>
        {data.esPrueba ? (
          <Text style={styles.pruebaBanner}>
            COMPROBANTE DE PRUEBA (HOMOLOGACIÓN) — SIN VALOR FISCAL
          </Text>
        ) : null}

        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Text style={styles.emisorNombre}>{data.razonSocial}</Text>
            <Text style={styles.line}>
              <Text style={styles.label}>CUIT: </Text>
              {data.cuit}
            </Text>
            <Text style={styles.line}>
              <Text style={styles.label}>Condición IVA: </Text>
              Monotributo
            </Text>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.letra}>C</Text>
            <Text style={styles.codigo}>COD. 011</Text>
          </View>

          <View style={styles.headerSide}>
            <Text style={styles.facturaTitle}>FACTURA</Text>
            <Text style={[styles.line, { marginTop: 6 }]}>
              <Text style={styles.label}>Punto de Venta: </Text>
              <Text style={styles.bold}>{data.puntoVenta}</Text>
              <Text style={styles.label}>   Comp. Nro: </Text>
              <Text style={styles.bold}>{data.numeroComprobante}</Text>
            </Text>
            <Text style={styles.line}>
              <Text style={styles.label}>Fecha de Emisión: </Text>
              {data.fechaEmision}
            </Text>
          </View>
        </View>

        <View style={styles.receptor}>
          <Text style={styles.line}>
            <Text style={styles.label}>Cliente: </Text>
            {data.clienteNombre || "Consumidor Final"}
          </Text>
          <Text style={styles.line}>
            <Text style={styles.label}>Condición frente al IVA: </Text>
            Consumidor Final
          </Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <Text style={styles.cellDesc}>Descripción</Text>
            <Text style={styles.cellQty}>Cant.</Text>
            <Text style={styles.cellPrice}>P. Unit.</Text>
            <Text style={styles.cellTotal}>Subtotal</Text>
          </View>
          {data.items.map((item, index) => (
            <View style={styles.tr} key={index} wrap={false}>
              <View style={styles.cellDesc}>
                <Text>{item.name}</Text>
                {item.description ? (
                  <Text style={{ color: GRAY_600, fontSize: 8 }}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.cellQty}>
                {item.quantity} {item.unit}
              </Text>
              <Text style={styles.cellPrice}>{money(item.unitPrice)}</Text>
              <Text style={styles.cellTotal}>{money(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Importe Total</Text>
            <Text style={styles.totalValue}>{money(data.total)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {/* react-pdf Image (no es un <img> HTML; no admite alt). */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={data.qrDataUrl} style={styles.qr} />
          <View style={styles.caeBlock}>
            <Text style={styles.label}>CAE N.º</Text>
            <Text style={styles.caeText}>{data.cae}</Text>
            <Text style={[styles.label, { marginTop: 4 }]}>
              Fecha de Vto. de CAE
            </Text>
            <Text style={styles.bold}>{data.caeVencimiento}</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Comprobante autorizado por ARCA (ex-AFIP). Generado con Cotizapp.
        </Text>
      </Page>
    </Document>
  );
}
