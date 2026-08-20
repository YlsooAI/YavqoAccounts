import AccountShell from "@/components/AccountShell";
import Avatar from "@/components/Avatar";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function PhotoPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="personal-photo" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">Photo</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          This photo is visible on your Yavqo Account and in Yavqo services
          you use.
        </p>

        <section className="mt-8 rounded-2xl border border-[#3c4043] px-6 py-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative inline-block">
              <Avatar
                avatarUrl={user.avatarUrl}
                initial={user.initial}
                className="h-28 w-28 text-[44px] font-normal"
              />
              <AvatarUploadButton userId={user.id} />
            </div>
            <p className="mt-5 text-[14px]">{user.displayName}</p>
            <p className="mt-1 text-[13px] text-[#9aa0a6]">{user.email}</p>
            <p className="mt-4 max-w-sm text-[12px] leading-relaxed text-[#9aa0a6]">
              Click the pencil to upload a new photo. Images up to 2&nbsp;MB
              are stored in your private Yavqo storage folder.
            </p>
          </div>
        </section>
      </div>
    </AccountShell>
  );
}
