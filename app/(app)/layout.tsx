import { redirect } from "next/navigation"
import { currentUser } from "@/lib/engine/auth"
import Sidebar from "@/components/Sidebar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect("/login")

  return (
    <div className="shell">
      <Sidebar user={user} />
      <main className="main">{children}</main>
    </div>
  )
}
