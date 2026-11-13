-- Replace the old starter wording with the three standard Vident contracts.
-- The new templates (DMC, AV only, DMC plus AV) are added by the Hub itself the next time a
-- Pipeline project page is opened; this removes everything else.
delete from public.contract_templates
where lower(btrim(name)) not in (
  lower('Services Agreement - DMC (non-AV)'),
  lower('AV Agreement - Audio Visual only'),
  lower('Services and AV Agreement - DMC plus AV')
);
