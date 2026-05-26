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
    validUntilLabel: formatDateOnly(quotation.quotation.valid_until),
    notes: normalizeOptionalText(quotation.quotation.notes),
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
    padding: 32,
    fontSize: 10,
    color: "#111827",
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#E5E7EB",
  },
  brandBlock: {
    flexDirection: "row",
    gap: 12,
    flexGrow: 1,
    maxWidth: "62%",
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: "contain",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  muted: {
    color: "#6B7280",
  },
  metaBlock: {
    alignItems: "flex-end",
    gap: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  sectionGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  sectionCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#6B7280",
  },
  sectionLine: {
    lineHeight: 1.4,
  },
  table: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#4B5563",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  colConcept: {
    width: "43%",
    paddingRight: 8,
  },
  colQty: {
    width: "17%",
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
    width: "45%",
    gap: 8,
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  totalStrong: {
    fontSize: 13,
    fontWeight: 700,
  },
  notesCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  footer: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    fontSize: 9,
    color: "#6B7280",
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
              {data.businessContact.map((line) => (
                <Text key={line} style={styles.sectionLine}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Cotizacion</Text>
            <Text style={styles.metaValue}>{data.quotationNumber}</Text>
            <Text style={styles.metaLabel}>Emitida</Text>
            <Text>{data.issuedAtLabel}</Text>
            <Text style={styles.metaLabel}>Valida hasta</Text>
            <Text>{data.validUntilLabel}</Text>
          </View>
        </View>

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
            <Text style={styles.sectionLine}>Impuesto: {data.taxRateLabel}</Text>
            <Text style={styles.sectionLine}>
              PDF generado: {data.generatedAtLabel}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colConcept}>Concepto</Text>
            <Text style={styles.colQty}>Cantidad</Text>
            <Text style={styles.colPrice}>Unitario</Text>
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
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{data.subtotalLabel}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>Impuesto ({data.taxRateLabel})</Text>
            <Text>{data.taxAmountLabel}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalStrong}>Total</Text>
            <Text style={styles.totalStrong}>{data.totalLabel}</Text>
          </View>
        </View>

        {data.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text style={styles.sectionLine}>{data.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>Documento generado por Cotizapp.</Text>
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
