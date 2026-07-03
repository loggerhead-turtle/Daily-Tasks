import type { Member } from "@/lib/types";

export function MemberAvatar({
  member,
  size = 36,
}: {
  member: Pick<Member, "name" | "color" | "emoji" | "avatar_url">;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white shadow"
      style={{ width: size, height: size, backgroundColor: member.color, fontSize: size * 0.55 }}
      title={member.name}
    >
      {member.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatar_url} alt={member.name} className="h-full w-full object-cover" />
      ) : (
        <span>{member.emoji}</span>
      )}
    </span>
  );
}

export function MemberChip({ member }: { member: Member }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2.5 text-xs font-bold text-slate-700">
      <MemberAvatar member={member} size={22} />
      {member.name}
    </span>
  );
}
