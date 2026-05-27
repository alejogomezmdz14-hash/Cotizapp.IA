export type Profile = {
  id: string;
  business_name: string | null;
  industry: string | null;
  tax_id?: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string | null;
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  city?: string | null;
  birth_date?: string | null;
  avatar_url?: string | null;
  logo_onboarding_completed?: boolean | null;
  pdf_footer?: string | null;
  pdf_accent_color?: string | null;
  pdf_template?: string | null;
  quotation_numbering_mode?: string | null;
  quotation_prefix?: string | null;
  quotation_counter?: number | null;
  theme: string | null;
  created_at: string | null;
};

export type CatalogItem = {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  unit: string;
  price: number;
  category: string | null;
  created_at: string | null;
};

export type Client = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string | null;
};

export type QuotationStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";

export type Quotation = {
  id: string;
  user_id: string | null;
  client_id: string | null;
  client_name: string | null;
  number: string;
  status: QuotationStatus | null;
  notes: string | null;
  subtotal: number | null;
  tax_rate: number | null;
  total: number | null;
  valid_until: string | null;
  pdf_path: string | null;
  pdf_generated_at: string | null;
  share_token: string | null;
  sent_at: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  paid_at?: string | null;
  signature_url?: string | null;
  created_at: string | null;
};

export type Invoice = {
  id: string;
  user_id: string;
  quotation_id: string | null;
  client_id: string | null;
  client_name: string | null;
  invoice_number: string;
  status: string | null;
  notes: string | null;
  subtotal: number | null;
  tax_rate: number | null;
  total: number | null;
  valid_until: string | null;
  pdf_path: string | null;
  pdf_generated_at: string | null;
  share_token: string | null;
  sent_at: string | null;
  paid_at: string | null;
  signature_url: string | null;
  created_at: string | null;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  position: number;
  catalog_item_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
};

export type QuotationItem = {
  id: string;
  quotation_id: string;
  position: number;
  catalog_item_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
};

export type HydratedQuotationBranding = {
  businessName: string | null;
  logoPath: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string | null;
  pdfFooter: string | null;
  pdfAccentColor: string | null;
  pdfTemplate: string;
};

export type HydratedQuotationCustomer = {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type HydratedQuotationItem = {
  id: string;
  quotationId: string;
  position: number;
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type QuotationOutputMetadata = {
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  shareToken: string | null;
  sentAt: string | null;
};

export type HydratedQuotation = {
  quotation: Quotation;
  branding: HydratedQuotationBranding;
  customer: HydratedQuotationCustomer;
  items: HydratedQuotationItem[];
  output: QuotationOutputMetadata;
};

export type DashboardQuotationMetrics = {
  totalQuotedThisMonth: number;
  sentQuotations: number;
  acceptedQuotations: number;
  pendingQuotations: number;
};

export type DashboardMonthlyPoint = {
  monthLabel: string;
  quoted: number;
  expenses: number;
};

export type DashboardStats = {
  quotations: number;
  clients: number;
  catalogItems: number;
  quotationMetrics: DashboardQuotationMetrics;
  expensesThisMonth: number;
  expensesByCurrency: ExpenseCurrencyTotal[];
  acceptedQuotedThisMonth: number;
  collectedThisMonth: number;
  netProfitThisMonth: number;
  canCalculateNetProfit: boolean;
  monthlyComparison: DashboardMonthlyPoint[];
};

export type ExpenseCurrencyTotal = {
  currency: string;
  total: number;
};

export type Expense = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  receipt_url: string | null;
  receipt_path: string | null;
  notes: string | null;
  created_at: string | null;
};

export type ExpenseMonthGroup = {
  monthKey: string;
  monthLabel: string;
  expenses: Expense[];
};

export type ExpenseMonthStats = {
  totalsByCurrency: ExpenseCurrencyTotal[];
  expenseCount: number;
  topCategory: string | null;
  topCategoryAmount: number;
};

export type ExpenseReceiptScanResult = {
  description: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  date: string | null;
};

export type QuotationAttachment = {
  id: string;
  quotation_id: string;
  user_id: string;
  file_path: string;
  file_name: string | null;
  file_type: string | null;
  created_at: string | null;
};

export type HydratedQuotationAttachment = {
  id: string;
  quotationId: string;
  filePath: string;
  fileName: string | null;
  fileType: string | null;
  createdAt: string | null;
  url: string | null;
};

export type InvoiceScan = {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string | null;
  status: string | null;
  raw_result: Record<string, unknown> | null;
  created_at: string | null;
};

export type InvoiceScanItemDraft = {
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type InvoiceCatalogDraft = {
  name: string;
  description: string | null;
  unit: string;
  price: number;
};

export type InvoiceScanResult = {
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string | null;
  notes: string | null;
  items: InvoiceScanItemDraft[];
  warnings: string[];
};

export type HydratedInvoiceScanReview = {
  scanId: string;
  fileName: string;
  status: "uploaded" | "processing" | "failed" | "completed";
  failureMessage: string | null;
  result: InvoiceScanResult | null;
};

export type ChatRole = "user" | "assistant";

export type ChatConversationMessage = {
  role: ChatRole;
  content: string;
};

export type ChatSuggestedQuotationItem = {
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type ChatDraftQuotationCreateAction = {
  type: "draft_quotation_create";
  clientId: string | null;
  clientName: string | null;
  clientSource: "existing" | "inline";
  notes: string | null;
  items: ChatSuggestedQuotationItem[];
};

export type ChatCatalogPriceUpdateAction = {
  type: "catalog_price_update";
  itemId: string;
  itemName: string;
  currentPrice: number;
  suggestedPrice: number;
  reason: string | null;
};

export type ChatSuggestedAction =
  | ChatDraftQuotationCreateAction
  | ChatCatalogPriceUpdateAction;

export type ChatReplyPayload = {
  reply: string;
  suggestedAction: ChatSuggestedAction | null;
};
