import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";
import { WorkerFaceButton } from "@/components/WorkerFaceButton";
import { WorkerProfilePhotoButton } from "@/components/WorkerProfilePhotoButton";

export const Route = createFileRoute("/_authenticated/admin/pegawai")({
  head: () => ({
    meta: [
      { title: "Data Pekerja — Panel BRI BO Pringsewu" },
      { name: "description", content: "Data pekerja per unit kerja." },
      { property: "og:title", content: "Data Pekerja — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Data pekerja per unit kerja." },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  const allowed = true;
  return (
    <AdminLayout>
      {r.loading ? null : allowed ? (
        <ResourceManager
          table="employees"
          title="Data Pekerja"
          description="Data pekerja per unit kerja."
          canWrite={r.isItAdmin}
          extraColumn={{
            label: "Foto & Wajah",
            render: (row) => (
              <div className="flex flex-wrap items-center gap-2">
                <WorkerProfilePhotoButton
                  workerId={String(row["id"])}
                  personalNumber={String(row["personal_number"] ?? "")}
                  nama={String(row["nama"] ?? "")}
                  photo={(row["n"] as string | null) ?? null}
                  canWrite={r.isItAdmin}
                />
                <WorkerFaceButton
                  workerId={String(row["id"])}
                  personalNumber={String(row["personal_number"] ?? "")}
                  nama={String(row["nama"] ?? "")}
                  canWrite={r.isItAdmin}
                />
              </div>
            ),
          }}
          fields={[
            {
              key: "personal_number",
              label: "Personal Number",
              type: "digits",
              digitsLength: 8,
              required: true,
              unique: true,
              placeholder: "8 digit angka",
            },
            { key: "nama", label: "Nama Pekerja", required: true },
            {
              key: "jabatan_id",
              label: "Jabatan",
              type: "ref",
              refTable: "job_titles",
              refLabelColumn: "nama_jabatan",
              required: true,
            },
            { key: "uker_id", label: "Unit Kerja", type: "uker", required: true },
            {
              key: "status_karyawan",
              label: "Status Karyawan",
              type: "select",
              options: ["Pegawai Tetap", "Kontrak/Magang", "Outsourcing"],
              required: true,
            },
            {
              key: "no_telepon",
              label: "Nomor Telepon",
              type: "digits",
              required: true,
              placeholder: "hanya angka",
            },
            {
              key: "profil",
              label: "Deskripsi Profile",
              type: "textarea",
              hideInTable: true,
              placeholder: "Deskripsi singkat profil pekerja",
            },
          ]}
        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
