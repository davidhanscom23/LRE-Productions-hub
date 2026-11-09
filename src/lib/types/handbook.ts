export type HandbookAcknowledgement = {
  id: string;
  user_id: string;
  signer_name: string;
  signer_email: string;
  signature_data: string;
  ip_address: string | null;
  user_agent: string | null;
  handbook_revision: string;
  signed_at: string;
};
