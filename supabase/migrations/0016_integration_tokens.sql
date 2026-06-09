CREATE TABLE public.integration_tokens (
  provider text PRIMARY KEY,
  refresh_token text,
  access_token text,
  expires_at timestamptz,
  scope text,
  token_type text,
  connected_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER integration_tokens_updated_at BEFORE UPDATE ON public.integration_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;
