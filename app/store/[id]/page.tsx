import { requireAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { FileManager } from "@/components/file-manager/file-manager";

interface StorePageProps {
  params: Promise<{ id: string }>;
}

export default async function StorePage({ params }: StorePageProps) {
  await requireAuth();
  const { id } = await params;

  return (
    <AppSidebar>
      <FileManager fileStoreId={id} />
    </AppSidebar>
  );
}
