"use client";

import { emailSchema, type CreateInvitationInput, type Invitation, type Member, type SalonRole, type UpdateMemberInput } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FieldError } from "@/components/field-error";
import { RolePicker } from "@/components/role-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { rolesLabel } from "@/lib/format";
import { salonKeys, useSalon } from "@/lib/salon-context";

export default function TeamPage() {
  const { salon, members, me, isManager } = useSalon();

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <section className="grid gap-3">
        <h2 className="text-lg">Members</h2>
        {members.map((m) => (
          <MemberCard key={m.id} member={m} canEdit={isManager || me?.id === m.id} isManager={isManager} salonId={salon.id} />
        ))}
      </section>
      {isManager && (
        <aside className="grid gap-6 self-start">
          <InviteCard salonId={salon.id} />
          <PendingInvitations salonId={salon.id} />
        </aside>
      )}
    </div>
  );
}

function MemberCard({ member, canEdit, isManager, salonId }: { member: Member; canEdit: boolean; isManager: boolean; salonId: string }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: salonKeys.members(salonId) });

  const remove = useMutation({
    mutationFn: () => api<void>(`/salons/${salonId}/members/${member.id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            {member.displayName}
            <Badge variant={member.roles.includes("MANAGER") ? "default" : "secondary"}>{rolesLabel(member.roles)}</Badge>
          </CardTitle>
          <CardDescription>
            {member.email ?? ""}
            {member.email && member.bio ? " · " : ""}
            {member.bio ?? ""}
          </CardDescription>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "Edit"}
            </Button>
            {isManager && (
              <Button
                size="sm"
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(`Remove ${member.displayName} from the salon?`)) remove.mutate();
                }}
              >
                Remove
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      {remove.isError && (
        <CardContent>
          <FieldError message={remove.error instanceof ApiError ? remove.error.message : "Could not remove"} />
        </CardContent>
      )}
      {editing && (
        <CardContent>
          <MemberForm member={member} isManager={isManager} salonId={salonId} onSaved={() => setEditing(false)} />
        </CardContent>
      )}
    </Card>
  );
}

function MemberForm({ member, isManager, salonId, onSaved }: { member: Member; isManager: boolean; salonId: string; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(member.displayName);
  const [bio, setBio] = useState(member.bio ?? "");
  const [roles, setRoles] = useState<SalonRole[]>(member.roles);

  const save = useMutation({
    mutationFn: (input: UpdateMemberInput) => api<Member>(`/salons/${salonId}/members/${member.id}`, { method: "PATCH", json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salonKeys.members(salonId) });
      void queryClient.invalidateQueries({ queryKey: ["salons", salonId, "availability"] });
      onSaved();
    },
  });

  const rolesChanged = roles.length !== member.roles.length || roles.some((r) => !member.roles.includes(r));

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          ...(isManager && rolesChanged ? { roles } : {}),
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`dn-${member.id}`}>Display name</Label>
        <Input id={`dn-${member.id}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`bio-${member.id}`}>Bio</Label>
        <Textarea id={`bio-${member.id}`} value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
      </div>
      {isManager && (
        <div className="grid gap-1.5">
          <Label>Roles</Label>
          <RolePicker idPrefix={`roles-${member.id}`} value={roles} onChange={setRoles} />
          {rolesChanged && !member.roles.includes("DESIGNER") && roles.includes("DESIGNER") && (
            <p className="text-xs text-muted-foreground">Their hours will start as a copy of the salon hours.</p>
          )}
        </div>
      )}
      <FieldError message={save.error instanceof ApiError ? save.error.message : undefined} />
      <Button type="submit" size="sm" disabled={save.isPending || roles.length === 0}>
        {save.isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function InviteCard({ salonId }: { salonId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<SalonRole[]>(["DESIGNER"]);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = useMutation({
    mutationFn: (input: CreateInvitationInput) => api<Invitation>(`/salons/${salonId}/invitations`, { method: "POST", json: input }),
    onSuccess: (inv) => {
      setInviteUrl(inv.inviteUrl ?? null);
      setCopied(false);
      setEmail("");
      setRoles(["DESIGNER"]);
      void queryClient.invalidateQueries({ queryKey: salonKeys.invitations(salonId) });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite someone</CardTitle>
        <CardDescription>They accept the link with an account that uses this email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const parsed = emailSchema.safeParse(email);
            if (!parsed.success) {
              setError("Enter a valid email");
              return;
            }
            if (roles.length === 0) return;
            invite.mutate({ email: parsed.data, roles });
          }}
          className="grid gap-3"
          noValidate
        >
          <div className="grid gap-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldError message={error ?? undefined} />
          </div>
          <div className="grid gap-1.5">
            <Label>Roles</Label>
            <RolePicker idPrefix="inv" value={roles} onChange={setRoles} />
          </div>
          <FieldError message={invite.error instanceof ApiError ? invite.error.message : undefined} />
          <Button type="submit" size="sm" disabled={invite.isPending || roles.length === 0}>
            {invite.isPending ? "Creating…" : "Create invite link"}
          </Button>
        </form>
        {inviteUrl && (
          <div className="mt-4 grid gap-2 rounded-md border bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">Share this link — it works once and expires in 7 days.</p>
            <code className="break-all">{inviteUrl}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => setCopied(true))}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingInvitations({ salonId }: { salonId: string }) {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: salonKeys.invitations(salonId),
    queryFn: () => api<Invitation[]>(`/salons/${salonId}/invitations`),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api<void>(`/salons/${salonId}/invitations/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: salonKeys.invitations(salonId) }),
  });

  if (!pending.data?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invites</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {pending.data.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between gap-2">
            <span>
              {inv.email} <span className="text-muted-foreground">· {rolesLabel(inv.roles)}</span>
            </span>
            <Button size="xs" variant="ghost" onClick={() => revoke.mutate(inv.id)} disabled={revoke.isPending}>
              Revoke
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
