
-- 1. Add 'review' to payroll_run_status enum
ALTER TYPE public.payroll_run_status ADD VALUE IF NOT EXISTS 'review' BEFORE 'approved';

-- 2. Extend leave_types
ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS carry_forward BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_carry_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_document BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_half_day BOOLEAN NOT NULL DEFAULT false;

-- HR can now manage leave types (previously read-only for all)
DROP POLICY IF EXISTS "HR manage leave types" ON public.leave_types;
CREATE POLICY "HR manage leave types" ON public.leave_types
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));

-- 3. Extend leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS unpaid_days NUMERIC(5,1) NOT NULL DEFAULT 0;

-- 4. Extend payslips with detailed columns
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS grants_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_security_ee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_security_er NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft';

-- 5. Extend payroll_runs
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- 6. Extend employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- 7. allowance_types
CREATE TABLE IF NOT EXISTS public.allowance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_taxable BOOLEAN NOT NULL DEFAULT true,
  default_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowance_types TO authenticated;
GRANT ALL ON public.allowance_types TO service_role;
ALTER TABLE public.allowance_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage allowance types" ON public.allowance_types
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employees view active allowance types" ON public.allowance_types
  FOR SELECT TO authenticated USING (is_active = true);
CREATE TRIGGER allowance_types_updated BEFORE UPDATE ON public.allowance_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. deduction_types
CREATE TABLE IF NOT EXISTS public.deduction_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_statutory BOOLEAN NOT NULL DEFAULT false,
  default_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deduction_types TO authenticated;
GRANT ALL ON public.deduction_types TO service_role;
ALTER TABLE public.deduction_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage deduction types" ON public.deduction_types
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employees view active deduction types" ON public.deduction_types
  FOR SELECT TO authenticated USING (is_active = true);
CREATE TRIGGER deduction_types_updated BEFORE UPDATE ON public.deduction_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. grant_types
CREATE TABLE IF NOT EXISTS public.grant_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  calc_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed' | 'rate'
  rate_or_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_types TO authenticated;
GRANT ALL ON public.grant_types TO service_role;
ALTER TABLE public.grant_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage grant types" ON public.grant_types
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE TRIGGER grant_types_updated BEFORE UPDATE ON public.grant_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. social_security_config (single-row-ish, but versioned by effective_from)
CREATE TABLE IF NOT EXISTS public.social_security_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_name TEXT NOT NULL DEFAULT 'default',
  employee_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  employer_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  cap_amount NUMERIC(12,2),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_security_config TO authenticated;
GRANT ALL ON public.social_security_config TO service_role;
ALTER TABLE public.social_security_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage ss config" ON public.social_security_config
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE TRIGGER ss_config_updated BEFORE UPDATE ON public.social_security_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. employee_allowances
CREATE TABLE IF NOT EXISTS public.employee_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  allowance_type_id UUID NOT NULL REFERENCES public.allowance_types(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_allowances_emp_idx ON public.employee_allowances(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_allowances TO authenticated;
GRANT ALL ON public.employee_allowances TO service_role;
ALTER TABLE public.employee_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage employee allowances" ON public.employee_allowances
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own allowances" ON public.employee_allowances
  FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE TRIGGER employee_allowances_updated BEFORE UPDATE ON public.employee_allowances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. employee_deductions
CREATE TABLE IF NOT EXISTS public.employee_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  deduction_type_id UUID NOT NULL REFERENCES public.deduction_types(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_deductions_emp_idx ON public.employee_deductions(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_deductions TO authenticated;
GRANT ALL ON public.employee_deductions TO service_role;
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage employee deductions" ON public.employee_deductions
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own deductions" ON public.employee_deductions
  FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE TRIGGER employee_deductions_updated BEFORE UPDATE ON public.employee_deductions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. employee_grants
CREATE TABLE IF NOT EXISTS public.employee_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  grant_type_id UUID NOT NULL REFERENCES public.grant_types(id) ON DELETE RESTRICT,
  amount_override NUMERIC(12,2),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_grants_emp_idx ON public.employee_grants(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_grants TO authenticated;
GRANT ALL ON public.employee_grants TO service_role;
ALTER TABLE public.employee_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage employee grants" ON public.employee_grants
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own grants" ON public.employee_grants
  FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE TRIGGER employee_grants_updated BEFORE UPDATE ON public.employee_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. payslip_lines
CREATE TABLE IF NOT EXISTS public.payslip_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- basic|allowance|deduction|grant|ss_ee|ss_er|overtime|unpaid_leave|adjustment
  ref_id UUID,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payslip_lines_payslip_idx ON public.payslip_lines(payslip_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslip_lines TO authenticated;
GRANT ALL ON public.payslip_lines TO service_role;
ALTER TABLE public.payslip_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage payslip lines" ON public.payslip_lines
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own payslip lines" ON public.payslip_lines
  FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.payslips p JOIN public.employees e ON e.id = p.employee_id
    WHERE p.id = payslip_id AND e.user_id = auth.uid()
  ));

-- 15. payroll_adjustments (post-approval)
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_adjustments_payslip_idx ON public.payroll_adjustments(payslip_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_adjustments TO authenticated;
GRANT ALL ON public.payroll_adjustments TO service_role;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage payroll adjustments" ON public.payroll_adjustments
  FOR ALL TO authenticated
  USING (public.is_hr_staff(auth.uid()))
  WITH CHECK (public.is_hr_staff(auth.uid()));

-- 16. Seed defaults (only if empty)
INSERT INTO public.allowance_types (code, name, default_amount) VALUES
  ('HOUSING','Housing Allowance',0),
  ('TRANSPORT','Transport Allowance',0),
  ('OTHER','Other Allowance',0)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.deduction_types (code, name, is_statutory, default_amount) VALUES
  ('LOAN','Salary Loan',false,0),
  ('ADVANCE','Salary Advance',false,0),
  ('OTHER','Other Deduction',false,0)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.social_security_config (scheme_name, employee_rate, employer_rate)
SELECT 'default', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.social_security_config);
