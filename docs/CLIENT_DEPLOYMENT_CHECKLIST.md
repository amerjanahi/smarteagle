# SmartEagle Client Deployment Checklist

Each client receives an isolated deployment. Never share a Supabase project,
storage bucket, service-role key, or production administrator between clients.

## Provisioning

- Create a dedicated Lovable project/deployment from the approved release tag.
- Create a dedicated Supabase project in the client's agreed region.
- Configure a client-owned production domain and TLS.
- Configure production environment variables in the deployment platform only.
- Apply every migration in order and confirm the migration history.
- Create one named Top Admin account; do not use a shared administrator login.
- Enable MFA for the owner's GitHub, Lovable, Supabase, email, and domain accounts.

## Configuration

- Enter the legal organization name, address, currency, fiscal year, and timezone.
- Upload approved branding and document templates.
- Configure invoice, receipt, credit-note, and purchase document numbering.
- Configure email sender identity and verify its domain.
- Import units, opening residents, vendors, chart of accounts, and opening balances.
- Reconcile import totals with the signed client source files.

## Security acceptance

- Confirm a pending signup has no portal or data access.
- Confirm only Top Admin can assign roles or change permissions.
- Confirm Property Manager cannot open Finance, HR, Settings, or security controls.
- Confirm residents can see only their approved villas and related records.
- Confirm rejected and disabled users cannot access protected routes or data.
- Confirm storage policies prevent access to another resident's private documents.
- Rotate all demonstration passwords and revoke old API keys before launch.

## Business acceptance

- Complete an invoice, payment, allocation, credit note, and customer statement.
- Complete a vendor invoice, vendor payment, and reconciliation.
- Complete resident onboarding and multi-user villa approval.
- Complete maintenance, visitor, notice, document, and amenity workflows.
- Test PDF/CSV exports and verify currency rounding and document numbering.
- Test the approved workflows on desktop, Android, and iPhone-sized screens.

## Operations and handover

- Enable database backups and document the recovery point and retention period.
- Perform a restore rehearsal before launch.
- Configure error monitoring and an operational contact.
- Record release version, migration version, environment owner, and launch date.
- Provide administrator and resident quick-start guides.
- Obtain written client acceptance before importing final production data.
