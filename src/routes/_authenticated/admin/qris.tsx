import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { QrisImport } from "@/components/QrisImport";

import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/qris")({
  head: () => ({
    meta: [
      { title: "Merchant QRIS — Panel BRI BO Pringsewu" },
      { name: "description", content: "Data merchant QRIS beserta store ID, alamat, dan tipe merchant." },
      { property: "og:title", content: "Merchant QRIS — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Data merchant QRIS beserta store ID, alamat, dan tipe merchant.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminPage menuKey="qris">
      {r.loading ? null : (
        <>
          <QrisImport canWrite={r.isItAdmin} />
          <ResourceManager
            table="qris_merchants"
            title="Merchant QRIS"
            description="Data merchant QRIS BO Pringsewu hasil unggahan file."
            canWrite={r.isItAdmin}
            pageSize={100}

            fields={[
              { key: "store_id", label: "STORE ID", type: "digits", required: true, unique: true },
              { key: "nama_merchant", label: "Nama Merchant", required: true },
              { key: "alamat", label: "Alamat", type: "textarea" },
              { key: "brdesc", label: "UNIT KERJA" },
              { key: "merchant_type", label: "Merchant Type" },
              { key: "status_qris", label: "Status QRIS" },
            ]}
          />
        </>
      )}
    </AdminPage>
  );
}

