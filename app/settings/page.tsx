import { requireAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  await requireAuth();

  return (
    <AppSidebar>
      <div className="p-6">
        <SettingsForm />
      </div>
    </AppSidebar>
  );
}
