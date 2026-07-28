import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMyProfile, listMyEmailChangeRequests, requestMyEmailChange, updateMyPersonalDetails } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/portal/profile")({
  head: () => ({ meta: [{ title: "Personal details — Hayy" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const getProfile = useServerFn(getMyProfile);
  const updateDetails = useServerFn(updateMyPersonalDetails);
  const requestEmailChange = useServerFn(requestMyEmailChange);
  const getRequests = useServerFn(listMyEmailChangeRequests);
  const { data: profile, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => getProfile() });
  const { data: requests = [] } = useQuery({ queryKey: ["my-email-change-requests"], queryFn: () => getRequests() });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");

  const name = fullName || profile?.full_name || "";
  const phoneValue = phone || profile?.phone || "";
  const pending = requests.find((request: any) => request.status === "pending");

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateDetails({ data: { fullName: name, phone: phoneValue } });
      setFullName(""); setPhone("");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Your personal details have been updated.");
    } catch (error: any) { toast.error(error.message ?? "Could not update your details."); }
  }

  async function submitEmailChange(event: React.FormEvent) {
    event.preventDefault();
    try {
      await requestEmailChange({ data: { newEmail, currentPassword: password, fullName: name, phone: phoneValue } });
      setNewEmail(""); setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["my-email-change-requests"] });
      toast.success("Your email-change request was sent to the administrator.");
    } catch (error: any) { toast.error(error.message ?? "Could not send the request."); }
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading personal details…</div>;
  return <div className="mx-auto max-w-xl space-y-5">
    <header>
      <h1 className="font-display text-2xl font-bold">Personal details</h1>
      <p className="text-sm text-muted-foreground">Keep your current contact information up to date.</p>
    </header>

    <form onSubmit={saveDetails} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4" /> Contact information</div>
      <label className="block text-sm font-medium">Full name<Input className="mt-1" value={name} onChange={(e) => setFullName(e.target.value)} required /></label>
      <label className="block text-sm font-medium">Phone number<Input className="mt-1" value={phoneValue} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></label>
      <Button type="submit">Save personal details</Button>
      <p className="text-xs text-muted-foreground">These changes update your active account and resident contact record. Published records keep their original details.</p>
    </form>

    <form onSubmit={submitEmailChange} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Change email securely</div>
      <p className="text-sm text-muted-foreground">Email changes require your current password and administrator approval.</p>
      <label className="block text-sm font-medium">Current email<Input className="mt-1" value={profile?.email ?? ""} disabled /></label>
      <label className="block text-sm font-medium">New email<Input className="mt-1" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required /></label>
      <label className="block text-sm font-medium">Current password<Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      <Button type="submit" disabled={!!pending}>{pending ? "Approval pending" : "Request email change"}</Button>
      {pending && <p className="rounded-md bg-muted p-3 text-sm">Requested change to <strong>{pending.requested_email}</strong> on {new Date(pending.requested_at).toLocaleDateString()}. Awaiting administrator approval.</p>}
    </form>
  </div>;
}
