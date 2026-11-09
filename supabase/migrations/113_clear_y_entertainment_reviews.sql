-- Clear any testimonials previously synced from the Y Entertainment website
-- sheet. Vident uses its own blank Client Reviews spreadsheet going forward.
delete from public.event_external_reviews
where source = 'google_sheet';
