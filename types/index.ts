export type Profile = {
  id: string;
  business_name: string | null;
  industry: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string | null;
  theme: string | null;
  created_at: string | null;
};

export type CatalogItem = {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  unit: string | null;
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

export type Quotation = {
  id: string;
  user_id: string | null;
  client_id: string | null;
  client_name: string | null;
  number: string;
  status: string | null;
  notes: string | null;
  subtotal: number | null;
  tax_rate: number | null;
  total: number | null;
  valid_until: string | null;
  created_at: string | null;
};

export type DashboardStats = {
  quotations: number;
  clients: number;
  catalogItems: number;
};
