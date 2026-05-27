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

import {
  formatCurrencyAmount,
  formatDateOnly,
  formatDateTime,
  formatPercentage,
} from "@/lib/formatting";
import { sanitizeQuotationValidityDate } from "@/lib/quotation-validity";
import type { HydratedQuotation } from "@/types";

export type QuotationPdfTemplateData = {
  businessName: string;
  businessContact: string[];
  customerName: string;
  customerContact: string[];
  quotationNumber: string;
  issuedAtLabel: string;
  generatedAtLabel: string;
  validUntilLabel: string;
  notes: string | null;
  footerNote: string | null;
  logoDataUrl: string | null;
  taxRateLabel: string;
  subtotalLabel: string;
  taxAmountLabel: string;
  totalLabel: string;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    quantityLabel: string;
    unitPriceLabel: string;
    totalLabel: string;
  }>;
};

type BuildQuotationPdfTemplateDataInput = {
  quotation: HydratedQuotation;
  generatedAt: string;
  logoDataUrl: string | null;
};

type QuotationPdfDocumentProps = {
  data: QuotationPdfTemplateData;
};

function getContactLines(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value));
}

function normalizeOptionalText(value: string | null) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function formatQuantityLabel(quantity: number, unit: string) {
  const quantityLabel = Number.isInteger(quantity)
    ? quantity.toString()
    : quantity.toString();

  return `${quantityLabel} ${unit}`.trim();
}

export function buildQuotationPdfTemplateData({
  quotation,
  generatedAt,
  logoDataUrl,
}: BuildQuotationPdfTemplateDataInput): QuotationPdfTemplateData {
  const taxAmount = Math.max(
    (quotation.quotation.total ?? 0) - (quotation.quotation.subtotal ?? 0),
    0,
  );

  return {
    businessName: quotation.branding.businessName ?? "Cotizapp",
    businessContact: getContactLines([
      quotation.branding.phone,
      quotation.branding.email,
      quotation.branding.address,
    ]),
    customerName: quotation.customer.name ?? "Cliente no especificado",
    customerContact: getContactLines([
      quotation.customer.email,
      quotation.customer.phone,
      quotation.customer.address,
    ]),
    quotationNumber: quotation.quotation.number,
    issuedAtLabel: formatDateTime(quotation.quotation.created_at ?? generatedAt),
    generatedAtLabel: formatDateTime(generatedAt),
    validUntilLabel: formatDateOnly(
      sanitizeQuotationValidityDate(quotation.quotation.valid_until),
    ),
    notes: normalizeOptionalText(quotation.quotation.notes),
    footerNote: normalizeOptionalText(quotation.branding.pdfFooter),
    logoDataUrl,
    taxRateLabel: formatPercentage(quotation.quotation.tax_rate),
    subtotalLabel: formatCurrencyAmount(
      quotation.quotation.subtotal,
      quotation.branding.currency,
    ),
    taxAmountLabel: formatCurrencyAmount(taxAmount, quotation.branding.currency),
    totalLabel: formatCurrencyAmount(
      quotation.quotation.total,
      quotation.branding.currency,
    ),
    items: quotation.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: normalizeOptionalText(item.description),
      quantityLabel: formatQuantityLabel(item.quantity, item.unit),
      unitPriceLabel: formatCurrencyAmount(
        item.unitPrice,
        quotation.branding.currency,
      ),
      totalLabel: formatCurrencyAmount(item.total, quotation.branding.currency),
    })),
  };
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingRight: 32,
    paddingBottom: 28,
    paddingLeft: 32,
    fontSize: 10.5,
    color: "#0F172A",
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 18,
  },
  brandBlock: {
    flexDirection: "row",
    gap: 14,
    flexGrow: 1,
    maxWidth: "62%",
  },
  logo: {
    width: 58,
    height: 58,
    objectFit: "contain",
    borderWidth: 1,
    borderColor: "#D4D8E1",
    borderRadius: 8,
    padding: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  muted: {
    color: "#64748B",
  },
  subtitle: {
    fontSize: 9.5,
    color: "#64748B",
    marginBottom: 7,
    textTransform: "uppercase",
  },
  headerLine: {
    marginBottom: 3,
    lineHeight: 1.45,
  },
  metaCard: {
    width: 180,
    borderWidth: 1,
    borderColor: "#D9DEE8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F8FAFC",
    gap: 8,
  },
  metaLabel: {
    fontSize: 8.5,
    color: "#64748B",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  divider: {
    height: 1,
    backgroundColor: "#D9DEE8",
    marginBottom: 18,
  },
  sectionGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 18,
  },
  sectionCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: "#D9DEE8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 7,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#64748B",
  },
  sectionLine: {
    lineHeight: 1.45,
  },
  sectionSpacer: {
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryLabel: {
    color: "#64748B",
  },
  summaryValue: {
    fontWeight: 700,
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  summaryTotalLabel: {
    fontSize: 10.5,
    fontWeight: 700,
  },
  summaryTotalValue: {
    fontSize: 13.5,
    fontWeight: 700,
    color: "#0F172A",
  },
  table: {
    borderWidth: 1,
    borderColor: "#D9DEE8",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#475569",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  colConcept: {
    width: "44%",
    paddingRight: 8,
  },
  colQty: {
    width: "16%",
    paddingRight: 8,
  },
  colPrice: {
    width: "20%",
    paddingRight: 8,
    textAlign: "right",
  },
  colTotal: {
    width: "20%",
    textAlign: "right",
  },
  conceptTitle: {
    fontWeight: 700,
    marginBottom: 3,
  },
  totalsWrap: {
    marginLeft: "auto",
    width: "42%",
    borderWidth: 1,
    borderColor: "#D9DEE8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 18,
    backgroundColor: "#F8FAFC",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  totalsLabel: {
    color: "#64748B",
  },
  totalStrong: {
    fontSize: 15,
    fontWeight: 700,
  },
  notesCard: {
    borderWidth: 1,
    borderColor: "#D9DEE8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
  },
  notesHeading: {
    fontSize: 9,
    fontWeight: 700,
    color: "#64748B",
    textTransform: "uppercase",
  },
  footer: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#D9DEE8",
    fontSize: 9,
    color: "#64748B",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  footerLeft: {
    maxWidth: "70%",
    gap: 2,
  },
});

export function QuotationPdfDocument({ data }: QuotationPdfDocumentProps) {
  return (
    <Document
      title={`Cotizacion ${data.quotationNumber}`}
      author={data.businessName}
      subject="Cotizacion comercial"
      language="es-AR"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            {data.logoDataUrl ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={data.logoDataUrl} style={styles.logo} />
              </>
            ) : null}
            <View>
              <Text style={styles.title}>{data.businessName}</Text>
              <Text style={styles.subtitle}>Cotizacion comercial</Text>
              {data.businessContact.map((line) => (
                <Text key={line} style={styles.headerLine}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.metaCard}>
            <View>
              <Text style={styles.metaLabel}>Cotizacion</Text>
              <Text style={styles.metaValue}>{data.quotationNumber}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>Fecha de emision</Text>
              <Text>{data.issuedAtLabel}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>PDF generado</Text>
              <Text>{data.generatedAtLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionGrid}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            <Text style={styles.conceptTitle}>{data.customerName}</Text>
            {data.customerContact.length > 0 ? (
              data.customerContact.map((line) => (
                <Text key={line} style={styles.sectionLine}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={styles.muted}>Sin datos adicionales</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Resumen</Text>
            <Text style={styles.sectionLine}>Items: {data.items.length}</Text>
            <Text style={styles.sectionLine}>Valida hasta: {data.validUntilLabel}</Text>
            <View style={styles.sectionSpacer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{data.subtotalLabel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Impuesto ({data.taxRateLabel})
                </Text>
                <Text style={styles.summaryValue}>{data.taxAmountLabel}</Text>
              </View>
              <View style={styles.summaryTotalRow}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>{data.totalLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colConcept}>Descripcion</Text>
            <Text style={styles.colQty}>Cantidad</Text>
            <Text style={styles.colPrice}>Precio unitario</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>

          {data.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <View style={styles.colConcept}>
                <Text style={styles.conceptTitle}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.muted}>{item.description}</Text>
                ) : null}
              </View>
              <Text style={styles.colQty}>{item.quantityLabel}</Text>
              <Text style={styles.colPrice}>{item.unitPriceLabel}</Text>
              <Text style={styles.colTotal}>{item.totalLabel}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{data.subtotalLabel}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Impuesto ({data.taxRateLabel})</Text>
            <Text style={styles.summaryValue}>{data.taxAmountLabel}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalStrong}>Total</Text>
            <Text style={styles.totalStrong}>{data.totalLabel}</Text>
          </View>
        </View>

        <View style={styles.notesCard}>
          <Text style={styles.notesHeading}>Notas y condiciones</Text>
          <Text style={styles.sectionLine}>
            {data.notes ?? "Cotizacion sujeta a disponibilidad de stock y confirmacion final."}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text>{data.businessName}</Text>
            {data.footerNote ? <Text>{data.footerNote}</Text> : null}
          </View>
          <Text>Generado con Cotizapp</Text>
        </View>
      </Page>
    </Document>
  );
}

export function createQuotationPdfDocument(
  data: QuotationPdfTemplateData,
): React.ReactElement<DocumentProps> {
  return <QuotationPdfDocument data={data} />;
}
