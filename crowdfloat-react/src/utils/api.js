// Allow switching API host/port without editing source.
// Example (Windows cmd/powershell): set VITE_API_BASE_URL=http://localhost:8001/api
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001/api');

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || `Request failed: ${response.status}`);
  }

  return response.json();
}

async function getJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || `Request failed: ${response.status}`);
  }
  return response.json();
}

export const funderAPI = {
  submitKYC(data) {
    return postJson('/funder/kyc', data);
  },
};

export const companyAPI = {
  submitOnboarding(data) {
    return postJson('/company/onboard', data);
  },
  submitInvoice(data) {
    return postJson('/company/invoices', data);
  },
  getInvoiceStatus(invoiceId) {
    return getJson(`/company/invoices/${invoiceId}/status`);
  },
};
