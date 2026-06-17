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
import { normalizePdfTemplate, type PdfTemplateId } from "@/lib/pdf-template";
import {
  normalizeDateOnlyString,
  sanitizeQuotationValidityDate,
} from "@/lib/quotation-validity";
import type { HydratedQuotation } from "@/types";

const GRAY_500 = "#6B7280";
const GRAY_700 = "#374151";
const GRAY_50 = "#F9FAFB";
const INK = "#111827";

export type QuotationPdfTemplateData = {
  businessName: string;
  businessContact: string[];
  customerName: string;
  customerContact: string[];
  documentTypeLabel: string;
  quotationNumber: string;
  issuedAtLabel: string;
  validUntilLabel: string;
  notes: string | null;
  footerNote: string | null;
  pdfAccentColor: string;
  pdfTemplate: PdfTemplateId;
  logoDataUrl: string | null;
  signatureDataUrl: string | null;
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
  signatureDataUrl?: string | null;
  documentTypeLabel?: string;
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
  signatureDataUrl = null,
  documentTypeLabel = "COTIZACIÓN",
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
    documentTypeLabel,
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
    pdfTemplate: normalizePdfTemplate(quotation.branding.pdfTemplate),
    logoDataUrl,
    signatureDataUrl,
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
      color: INK,
      fontFamily: "Helvetica",
      backgroundColor: "#FFFFFF",
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    brandColumn: {
      maxWidth: "58%",
      gap: 8,
    },
    logo: {
      width: 80,
      height: 80,
      objectFit: "contain",
    },
    businessName: {
      fontSize: 18,
      fontWeight: 700,
      color: INK,
      marginBottom: 4,
    },
    contactLine: {
      fontSize: 10,
      color: GRAY_500,
      lineHeight: 1.45,
      marginBottom: 2,
    },
    metaColumn: {
      alignItems: "flex-end",
      minWidth: 210,
      gap: 4,
    },
    docTypeLabel: {
      fontSize: 11,
      letterSpacing: 1.65,
      color: GRAY_500,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    quotationNumber: {
      fontSize: 13,
      fontFamily: "Courier",
      color: GRAY_700,
      marginBottom: 8,
    },
    metaBlock: {
      gap: 4,
      alignItems: "flex-end",
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "baseline",
      gap: 8,
    },
    metaRowLabel: {
      fontSize: 10,
      fontWeight: 700,
      color: GRAY_500,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    metaRowValue: {
      fontSize: 10,
      color: GRAY_700,
      minWidth: 88,
      textAlign: "right",
    },
    separator: {
      height: 2,
      backgroundColor: accentColor,
      marginBottom: 18,
    },
    clientSection: {
      backgroundColor: GRAY_50,
      borderRadius: 6,
      padding: 12,
      marginBottom: 20,
      gap: 4,
    },
    clientLabel: {
      fontSize: 9,
      fontWeight: 700,
      color: GRAY_500,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    clientName: {
      fontSize: 14,
      fontWeight: 700,
      color: INK,
      marginBottom: 2,
    },
    clientLine: {
      fontSize: 10,
      color: GRAY_500,
      lineHeight: 1.45,
    },
    table: {
      marginBottom: 20,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: accentColor,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    tableHeaderCell: {
      fontSize: 10,
      fontWeight: 700,
      color: "#FFFFFF",
      textTransform: "uppercase",
      letterSpacing: 0.35,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: "#FFFFFF",
    },
    tableRowAlt: {
      backgroundColor: GRAY_50,
    },
    colDescription: { width: "50%", paddingRight: 8 },
    colQuantity: { width: "15%", textAlign: "center" },
    colUnitPrice: { width: "17%", textAlign: "right", paddingRight: 6 },
    colAmount: { width: "18%", textAlign: "right" },
    itemName: {
      fontSize: 10,
      fontWeight: 700,
      color: INK,
      marginBottom: 2,
    },
    itemDescription: {
      fontSize: 9,
      color: GRAY_500,
      lineHeight: 1.35,
    },
    cellText: {
      fontSize: 10,
      color: INK,
    },
    totalsSection: {
      marginLeft: "auto",
      width: 240,
      gap: 6,
      marginBottom: 18,
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    totalsLabel: {
      fontSize: 10,
      color: GRAY_500,
      textTransform: "uppercase",
      letterSpacing: 0.35,
    },
    totalsValue: {
      fontSize: 11,
      color: INK,
    },
    totalHighlightBox: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: accentColor,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginTop: 4,
      borderRadius: 4,
    },
    totalHighlightLabel: {
      fontSize: 10,
      fontWeight: 700,
      color: "#FFFFFF",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    totalHighlightValue: {
      fontSize: 13,
      fontWeight: 700,
      color: "#FFFFFF",
    },
    notesSection: {
      marginBottom: 16,
      gap: 4,
    },
    notesLabel: {
      fontSize: 9,
      fontWeight: 700,
      color: GRAY_500,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    notesText: {
      fontSize: 10,
      color: GRAY_700,
      lineHeight: 1.5,
    },
    footer: {
      marginTop: "auto",
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: "#E5E7EB",
      gap: 4,
    },
    footerBusiness: {
      fontSize: 9,
      color: GRAY_700,
    },
    footerBrand: {
      fontSize: 7,
      color: "#9CA3AF",
      textAlign: "center",
      marginTop: 4,
    },
    signatureSection: {
      marginTop: 16,
      gap: 6,
    },
    signatureLabel: {
      fontSize: 9,
      fontWeight: 700,
      color: GRAY_500,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    signatureImage: {
      width: 180,
      height: 64,
      objectFit: "contain",
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
          <View style={styles.brandColumn}>
            {data.logoDataUrl ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={data.logoDataUrl} style={styles.logo} />
              </>
            ) : null}
            <Text style={styles.businessName}>{data.businessName}</Text>
            {data.businessContact.map((line) => (
              <Text key={line} style={styles.contactLine}>
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.metaColumn}>
            <Text style={styles.docTypeLabel}>{data.documentTypeLabel}</Text>
            <Text style={styles.quotationNumber}>{data.quotationNumber}</Text>
            <View style={styles.metaBlock}>
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
        </View>

        <View style={styles.separator} />

        <View style={styles.clientSection}>
          <Text style={styles.clientLabel}>Cliente</Text>
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

        {data.signatureDataUrl ? (
          <View style={styles.signatureSection}>
            <Text style={styles.signatureLabel}>Firma del cliente</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.signatureDataUrl} style={styles.signatureImage} />
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
