
-- Enums
DO $$ BEGIN CREATE TYPE public.employment_status AS ENUM ('active','on_leave','terminated','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.attendance_status AS ENUM ('present','absent','leave','holiday','weekend'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payroll_run_status AS ENUM ('draft','approved','posted','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payroll_draft_status AS ENUM ('pending_review','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: is HR or admin
CREATE OR REPLACE FUNCTION public.is_hr_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin'::public.app_role,'hr'::public.app_role))
$$;
REVOKE EXECUTE ON FUNCTION public.is_hr_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hr_staff(uuid) TO authenticated, service_role;

-- 1. employees
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  national_id text,
  position text,
  department text,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  termination_date date,
  employment_status public.employment_status NOT NULL DEFAULT 'active',
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  allowances jsonb NOT NULL DEFAULT '[]'::jsonb,
  deductions jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency text NOT NULL DEFAULT 'AED',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employees_user_idx ON public.employees(user_id);
CREATE INDEX employees_status_idx ON public.employees(employment_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage employees" ON public.employees FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own record" ON public.employees FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER employees_audit AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 2. employee_documents
CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  doc_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage employee docs" ON public.employee_documents FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own docs" ON public.employee_documents FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

-- 3. attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in time,
  check_out time,
  hours numeric(6,2),
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);
CREATE INDEX attendance_date_idx ON public.attendance(date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. leave_types
CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  days_per_year numeric(5,1) NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated view leave types" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR manage leave types" ON public.leave_types FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE TRIGGER leave_types_updated_at BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.leave_types (code, name, days_per_year, paid) VALUES
  ('ANNUAL','Annual Leave',30,true),
  ('SICK','Sick Leave',15,true),
  ('UNPAID','Unpaid Leave',0,false);

-- 5. leave_balances
CREATE TABLE public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year int NOT NULL,
  entitled numeric(5,1) NOT NULL DEFAULT 0,
  used numeric(5,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage balances" ON public.leave_balances FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own balance" ON public.leave_balances FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE TRIGGER leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. leave_requests
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  from_date date NOT NULL,
  to_date date NOT NULL,
  days numeric(5,1) NOT NULL,
  reason text,
  status public.leave_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leave_req_emp_idx ON public.leave_requests(employee_id);
CREATE INDEX leave_req_status_idx ON public.leave_requests(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage leave requests" ON public.leave_requests FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own requests" ON public.leave_requests FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE POLICY "Employee create own request" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()) AND status = 'pending');
CREATE POLICY "Employee cancel own pending" ON public.leave_requests FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()) AND status = 'pending')
  WITH CHECK (status IN ('pending','cancelled'));
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER leave_requests_audit AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 7. payroll_runs
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year int NOT NULL,
  status public.payroll_run_status NOT NULL DEFAULT 'draft',
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  employee_count int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  posted_at timestamptz,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_year, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage payroll" ON public.payroll_runs FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Finance view payroll" ON public.payroll_runs FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));
CREATE TRIGGER payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER payroll_runs_audit AFTER INSERT OR UPDATE OR DELETE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 8. payslips
CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  basic numeric(12,2) NOT NULL DEFAULT 0,
  allowances_total numeric(12,2) NOT NULL DEFAULT 0,
  overtime numeric(12,2) NOT NULL DEFAULT 0,
  deductions_total numeric(12,2) NOT NULL DEFAULT 0,
  leave_adjustment numeric(12,2) NOT NULL DEFAULT 0,
  gross numeric(12,2) NOT NULL DEFAULT 0,
  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  days_worked numeric(5,1) NOT NULL DEFAULT 0,
  days_absent numeric(5,1) NOT NULL DEFAULT 0,
  days_leave numeric(5,1) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payroll_run_id, employee_id)
);
CREATE INDEX payslips_emp_idx ON public.payslips(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage payslips" ON public.payslips FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Employee view own payslips" ON public.payslips FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE TRIGGER payslips_updated_at BEFORE UPDATE ON public.payslips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. payroll_journal_drafts
CREATE TABLE public.payroll_journal_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL UNIQUE REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.payroll_draft_status NOT NULL DEFAULT 'pending_review',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_journal_drafts TO authenticated;
GRANT ALL ON public.payroll_journal_drafts TO service_role;
ALTER TABLE public.payroll_journal_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage drafts" ON public.payroll_journal_drafts FOR ALL TO authenticated USING (public.is_hr_staff(auth.uid())) WITH CHECK (public.is_hr_staff(auth.uid()));
CREATE POLICY "Finance review drafts" ON public.payroll_journal_drafts FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));
CREATE POLICY "Finance update drafts" ON public.payroll_journal_drafts FOR UPDATE TO authenticated
  USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE TRIGGER payroll_drafts_updated_at BEFORE UPDATE ON public.payroll_journal_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: init leave balances for a newly created employee
CREATE OR REPLACE FUNCTION public.init_employee_leave_balances()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled, used)
  SELECT NEW.id, lt.id, EXTRACT(YEAR FROM CURRENT_DATE)::int, lt.days_per_year, 0
  FROM public.leave_types lt WHERE lt.is_active = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.init_employee_leave_balances() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER employees_init_balances AFTER INSERT ON public.employees FOR EACH ROW EXECUTE FUNCTION public.init_employee_leave_balances();
