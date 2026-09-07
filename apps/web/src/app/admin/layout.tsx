import { AdminChrome } from "@/components/layout/AdminChrome";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
