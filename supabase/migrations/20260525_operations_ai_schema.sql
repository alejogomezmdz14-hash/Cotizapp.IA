CREATE TABLE quotation_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT DEFAULT 'uploaded',
  raw_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quotation attachments" ON quotation_attachments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own invoice scans" ON invoice_scans FOR ALL USING (auth.uid() = user_id);
