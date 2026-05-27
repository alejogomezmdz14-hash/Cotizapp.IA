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
  formatPercentage,
} from "@/lib/formatting";
import { normalizePdfAccentColor } from "@/lib/pdf-accent-color";
import {
  normalizeDateOnlyString,
  sanitizeQuotationValidityDate,
} from "@/lib/quotation-validity";
import type { HydratedQuotation } from "@/types";

const NAVY = "#1A2A4A";
const MUTED = "#64748B";
const ROW_ALT = "#F5F5F5";
const CLIENT_BG = "#F5F5F5";

export type QuotationPdfTemplateData = {
  businessName: string;
  businessContact: string[];
  customerName: string;
  customerContact: string[];
  quotationNumber: string;
  issuedAtLabel: string;
  validUntilLabel: string;
  notes: string | null;
  footerNote: string | null;
  pdfAccentColor: string;
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
    amountLabel: string;
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

function formatQuantityLabel(quantity: number) {
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toString();
}

function formatIssueDateLabel(createdAt: string | null, fallback: string) {
  const normalizedCreatedAt = normalizeDateOnlyString(createdAt);

  if (normalizedCreatedAt) {
    return formatDateOnly(normalizedCreatedAt);
  }

  const normalizedFallback = normalizeDateOnlyString(fallback);

  if (normalizedFallback) {
    return formatDateOnly(normalizedFallback);
  }

  return formatDateOnly(fallback.slice(0, 10));
}

export function buildQuotationPdfTemplateData({
  quotation,
  generatedAt,
  logoDataUrl,
}: BuildQuotationPdfTemplateDataInput): QuotationPdfTemplateData {
  const subtotal = quotation.quotation.subtotal ?? 0;
  const taxAmount = Math.max((quotation.quotation.total ?? 0) - subtotal, 0);
  const currency = quotation.branding.currency;

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
    issuedAtLabel: formatIssueDateLabel(
      quotation.quotation.created_at,
      generatedAt,
    ),
    validUntilLabel: formatDateOnly(
      sanitizeQuotationValidityDate(quotation.quotation.valid_until),
    ),
    notes: normalizeOptionalText(quotation.quotation.notes),
    footerNote: normalizeOptionalText(quotation.branding.pdfFooter),
    pdfAccentColor: normalizePdfAccentColor(quotation.branding.pdfAccentColor),
    logoDataUrl,
    taxRateLabel: formatPercentage(quotation.quotation.tax_rate),
    subtotalLabel: formatCurrencyAmount(subtotal, currency),
    taxAmountLabel: formatCurrencyAmount(taxAmount, currency),
    totalLabel: formatCurrencyAmount(quotation.quotation.total, currency),
    items: quotation.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: normalizeOptionalText(item.description),
      quantityLabel: formatQuantityLabel(item.quantity),
      unitPriceLabel: formatCurrencyAmount(item.unitPrice, currency),
      amountLabel: formatCurrencyAmount(item.total, currency),
    })),
  };
}

function createPdfStyles(accentColor: string) {
  return StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingRight: 40,
    paddingBottom: 32,
    paddingLeft: 40,
    fontSize: 10,
    color: "#111827",
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    maxWidth: "62%",
  },
  logo: {
    width: 64,
    height: 64,
    objectFit: "contain",
    borderWidth: 1,
    borderColor: "#D9DEE8",
    borderRadius: 10,
    padding: 6,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
    color: "#111827",
  },
  contactLine: {
    fontSize: 9.5,
    color: "#374151",
    lineHeight: 1.5,
    marginBottom: 2,
  },
  metaColumn: {
    alignItems: "flex-end",
    minWidth: 200,
    gap: 4,
  },
  docTypeLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  quotationNumber: {
    fontSize: 28,
    fontWeight: 700,
    color: NAVY,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 3,
  },
  metaRowLabel: {
    fontSize: 8.5,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    width: 82,
    textAlign: "right",
  },
  metaRowValue: {
    fontSize: 9.5,
    color: "#111827",
    minWidth: 100,
    textAlign: "right",
  },
  separator: {
    height: 2,
    backgroundColor: accentColor,
    marginBottom: 18,
  },
  clientSection: {
    backgroundColor: CLIENT_BG,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 5,
  },
  clientLabel: {
    fontSize: 8.5,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  clientName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111827",
  },
  clientLine: {
    fontSize: 9.5,
    color: "#374151",
    lineHeight: 1.45,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    fontSize: 8.5,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRowAlt: {
    backgroundColor: ROW_ALT,
  },
  colDescription: { width: "42%", paddingRight: 8 },
  colQuantity: { width: "14%", textAlign: "center" },
  colUnitPrice: { width: "22%", textAlign: "right", paddingRight: 6 },
  colAmount: { width: "22%", textAlign: "right" },
  itemName: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 2,
    color: "#111827",
  },
  itemDescription: {
    fontSize: 8.5,
    color: MUTED,
    lineHeight: 1.35,
  },
  cellText: {
    fontSize: 9.5,
    color: "#111827",
  },
  totalsSection: {
    marginLeft: "auto",
    width: 250,
    gap: 6,
    marginBottom: 18,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  totalsLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalsValue: {
    fontSize: 10,
    fontWeight: 700,
    color: "#111827",
  },
  totalHighlightBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: NAVY,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  totalHighlightLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  totalHighlightValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#FFFFFF",
  },
  notesSection: {
    marginBottom: 16,
    gap: 4,
  },
  notesLabel: {
    fontSize: 8.5,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
  },
  notesText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.5,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 4,
  },
  footerBusiness: {
    fontSize: 9,
    color: "#374151",
  },
  footerBrand: {
    fontSize: 7,
    color: "#CBD5E1",
    textAlign: "center",
    marginTop: 4,
  },
  });
}

export function QuotationPdfDocument({ data }: QuotationPdfDocumentProps) {
  const styles = createPdfStyles(data.pdfAccentColor);

  return (
    <Document
      title={`Cotización ${data.quotationNumber}`}
      author={data.businessName}
      subject="Cotización comercial"
      language="es-AR"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            {data.logoDataUrl ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={data.logoDataUrl} style={styles.logo} />
              </>
            ) : null}
            <View>
              <Text style={styles.businessName}>{data.businessName}</Text>
              {data.businessContact.map((line) => (
                <Text key={line} style={styles.contactLine}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.metaColumn}>
            <Text style={styles.docTypeLabel}>COTIZACIÓN</Text>
            <Text style={styles.quotationNumber}>{data.quotationNumber}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaRowLabel}>Fecha</Text>
              <Text style={styles.metaRowValue}>{data.issuedAtLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaRowLabel}>Válida hasta</Text>
              <Text style={styles.metaRowValue}>{data.validUntilLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.clientSection}>
          <Text style={styles.clientLabel}>Facturar a</Text>
          <Text style={styles.clientName}>{data.customerName}</Text>
          {data.customerContact.length > 0 ? (
            data.customerContact.map((line) => (
              <Text key={line} style={styles.clientLine}>
                {line}
              </Text>
            ))
          ) : (
            <Text style={styles.clientLine}>—</Text>
          )}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>
              Descripción
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colQuantity]}>
              Cantidad
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>
              Unitario
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Total</Text>
          </View>

          {data.items.map((item, index) => (
            <View
              key={item.id}
              style={
                index % 2 === 1
                  ? [styles.tableRow, styles.tableRowAlt]
                  : styles.tableRow
              }
            >
              <View style={styles.colDescription}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.itemDescription}>{item.description}</Text>
                ) : null}
              </View>
              <Text style={[styles.cellText, styles.colQuantity]}>
                {item.quantityLabel}
              </Text>
              <Text style={[styles.cellText, styles.colUnitPrice]}>
                {item.unitPriceLabel}
              </Text>
              <Text style={[styles.cellText, styles.colAmount]}>
                {item.amountLabel}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{data.subtotalLabel}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              Impuesto ({data.taxRateLabel})
            </Text>
            <Text style={styles.totalsValue}>{data.taxAmountLabel}</Text>
          </View>
          <View style={styles.totalHighlightBox}>
            <Text style={styles.totalHighlightLabel}>Total</Text>
            <Text style={styles.totalHighlightValue}>{data.totalLabel}</Text>
          </View>
        </View>

        {data.notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notas</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerBusiness}>{data.businessName}</Text>
          {data.footerNote ? (
            <Text style={styles.footerBusiness}>{data.footerNote}</Text>
          ) : null}
          <Text style={styles.footerBrand}>Generado con Cotizapp</Text>
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
