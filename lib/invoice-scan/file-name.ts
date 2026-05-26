type InvoiceScanFileNameSource = {
  file_name: string | null;
  file_path: string;
};

export function getInvoiceScanDisplayFileName({
  file_name,
  file_path,
}: InvoiceScanFileNameSource) {
  const trimmedOriginalName = file_name?.trim();

  if (trimmedOriginalName) {
    return trimmedOriginalName;
  }

  return file_path.split("/").pop() ?? "factura";
}
