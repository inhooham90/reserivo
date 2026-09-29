"use client";

import { emailSchema, type CreateInvitationInput, type Invitation, type Member, type SalonRole, type UpdateMemberInput } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FieldError } from "@/components/field-error";
import { RolePicker } from "@/components/role-picker";
import { SettingsRows, SettingsSection } from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useFormat } from "@/lib/use-format";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { ghostPillSm, outlinePillSm, pillButtonSm, pillInputSm } from "@/lib/v3";
import { cn } from "cn";

export default function TeamSettings() {
  const { salon, members, me, isManager } = useSalon();
  const t = useTranslations("settings.team");
  // Opened from the setup guide's profile step: the person's own row starts open.
  const guide = useSearchParams().get("guide");

  return (
    // minmax(0, 1fr): a long email in a row is truncated, not allowed to widen the pane.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <SettingsSection title={t("members")}>
        <SettingsRows>
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isMe={me?.id === m.id}
              canEdit={isManager || me?.id === m.id}
              isManager={isManager}
              salonId={salon.id}
              startEditing={guide === "profile" && me?.id === m.id}
            />
          ))}
        </SettingsRows>
      </SettingsSection>
      {isManager && (
        <>
          <div id="guide-invite" className="scroll-mt-48 md:scroll-mt-36">
            <InviteSection salonId={salon.id} />
          </div>
          <PendingInvitations salonId={salon.id} />
        </>
      )}
    </div>
  );
}

/** Up to two letters: the first and last word of the name. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((w) => Array.from(w)[0] ?? "").join("").toUpperCase();
}

function MemberRow({
  member,
  isMe,
  canEdit,
  isManager,
  salonId,
  startEditing = false,
}: {
  member: Member;
  isMe: boolean;
  canEdit: boolean;
  isManager: boolean;
  salonId: string;
  startEditing?: boolean;
}) {
  const f = useFormat();
  const t = useTranslations("settings.team");
  const [editing, setEditing] = useState(startEditing);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: salonKeys.members(salonId) });

  const remove = useMutation({
    mutationFn: () => api<void>(`/salons/${salonId}/members/${member.id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  // Email is only in the payload for managers; the API decides, not this row.
  const detail = [f.roles(member.roles), member.email, member.bio].filter(Boolean).join(" · ");

  return (
    <div id={startEditing ? "guide-profile" : undefined} className="grid scroll-mt-48 grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 md:scroll-mt-36 md:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender text-xs font-semibold shadow-[inset_0_0_0_1px_var(--border)]"
        >
          {initials(member.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {member.displayName}
            {isMe && (
              <span className="inline-flex h-6 items-center rounded-full bg-lavender px-2.5 text-xs font-medium">{t("you")}</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{detail}</p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" aria-expanded={editing} className={outlinePillSm} onClick={() => setEditing((v) => !v)}>
              {editing ? t("close") : t("edit")}
            </Button>
            {isManager && (
              <Button
                variant="ghost"
                className={cn(ghostPillSm, "text-destructive")}
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(t("confirmRemove", { name: member.displayName }))) remove.mutate();
                }}
              >
                {t("remove")}
              </Button>
            )}
          </div>
        )}
      </div>
      {remove.isError && <FieldError message={remove.error instanceof ApiError ? remove.error.message : t("removeFailed")} />}
      {editing && <MemberForm member={member} isManager={isManager} salonId={salonId} onSaved={() => setEditing(false)} />}
    </div>
  );
}

function MemberForm({ member, isManager, salonId, onSaved }: { member: Member; isManager: boolean; salonId: string; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const t = useTranslations("settings.team");
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
      className="grid gap-4 rounded-lg bg-muted p-4 md:ml-14"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          ...(isManager && rolesChanged ? { roles } : {}),
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor={`dn-${member.id}`}>{t("displayName")}</Label>
        <Input id={`dn-${member.id}`} className={pillInputSm} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`bio-${member.id}`}>{t("bio")}</Label>
        <Textarea id={`bio-${member.id}`} className="rounded-2xl bg-card px-4 py-3" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
      </div>
      {isManager && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("roles")}</legend>
          <RolePicker idPrefix={`roles-${member.id}`} value={roles} onChange={setRoles} />
          {rolesChanged && !member.roles.includes("DESIGNER") && roles.includes("DESIGNER") && (
            <p className="text-sm text-muted-foreground">{t("hoursSeeded")}</p>
          )}
        </fieldset>
      )}
      <FieldError message={save.error instanceof ApiError ? save.error.message : undefined} />
      <Button type="submit" className={cn(pillButtonSm, "justify-self-start")} disabled={save.isPending || roles.length === 0}>
        {save.isPending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}

function InviteSection({ salonId }: { salonId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("settings.team");
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
    <SettingsSection title={t("inviteTitle")} hint={t("inviteHint")}>
      <SettingsRows className="p-4 md:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const parsed = emailSchema.safeParse(email);
            if (!parsed.success) {
              setError(t("invalidEmail"));
              return;
            }
            if (roles.length === 0) return;
            invite.mutate({ email: parsed.data, roles });
          }}
          className="grid gap-5"
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="inv-email">{t("email")}</Label>
            <Input id="inv-email" type="email" className={pillInputSm} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} />
            <FieldError message={error ?? undefined} />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t("roles")}</legend>
            <RolePicker idPrefix="inv" value={roles} onChange={setRoles} />
          </fieldset>
          <FieldError message={invite.error instanceof ApiError ? invite.error.message : undefined} />
          <Button type="submit" variant="outline" className={cn(outlinePillSm, "justify-self-start")} disabled={invite.isPending || roles.length === 0}>
            <Link2 aria-hidden />
            {invite.isPending ? t("creating") : t("createInvite")}
          </Button>
        </form>
        {inviteUrl && (
          <div className="mt-5 grid gap-3 rounded-lg bg-butter p-4 text-sm">
            <p className="text-body">{t("share")}</p>
            <code className="font-mono break-all">{inviteUrl}</code>
            <Button
              variant="outline"
              className={cn(outlinePillSm, "justify-self-start")}
              onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => setCopied(true))}
            >
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
        )}
      </SettingsRows>
    </SettingsSection>
  );
}

function PendingInvitations({ salonId }: { salonId: string }) {
  const f = useFormat();
  const t = useTranslations("settings.team");
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
    <SettingsSection title={t("pending")}>
      <SettingsRows>
        {pending.data.map((inv) => (
          <div key={inv.id} className="flex items-center gap-4 px-4 py-3 md:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{inv.email}</p>
              <p className="text-sm text-muted-foreground">{f.roles(inv.roles)}</p>
            </div>
            <Button variant="ghost" className={ghostPillSm} onClick={() => revoke.mutate(inv.id)} disabled={revoke.isPending}>
              {t("revoke")}
            </Button>
          </div>
        ))}
      </SettingsRows>
    </SettingsSection>
  );
}
