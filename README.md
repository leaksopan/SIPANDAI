## SMART-ID (Sistem Manajemen Arsip Terpusat – IrbanDua)

Ringkas untuk LinkedIn: Aplikasi React + Firebase untuk manajemen arsip terpusat dengan autentikasi, peran/izin granular, unggah/kelola file, serta alur pendaftaran staff dan persetujuan. Dibangun ringan, modern, dan production-ready.

### Highlight
- **Auth**: Firebase Auth (Google, email/password) + sinkronisasi user ke `Firestore`.
- **RBAC**: Role `super_admin`, `Irban`, `Auditor`, `guest` dengan izin granular (view/upload/download/manage).
- **File Manager**: Upload, foldering, search/filter tanggal, preview PDF/CSV/XLSX, bulk progress.
- **User & Staff Ops**: Form aplikasi staff, persetujuan/penolakan, promosi role, aktivasi/deaktivasi user.
- **UI/UX**: Dashboard tab-based, komponen terpisah, responsive styling.

---

## Arsitektur Singkat
- **Frontend**: React (CRA), hooks kustom (`useAuth`, `useUserRole`).
- **Backend-as-a-Service**: Firebase (Auth, Firestore, Storage).
- **Data**:
  - Collection `users`: profil + `role`, `isActive`.
  - Collection `staff_applications`: pengajuan menjadi staff dan statusnya.
  - Metadata file/folder tersimpan di Firestore; konten file di Storage.

Skema alur utama:
1) Login → sinkronisasi user ke `users` (default role `guest`).
2) Role/permission di-resolve via `useUserRole` → kontrol tab/aksi UI.
3) File manager beroperasi ke Firestore/Storage sesuai izin.
4) Staff mendaftar → admin menyetujui → role user dipromosikan otomatis.

---

## Indeks Kode (Codebase Index)
- `src/index.js`: Entrypoint React.
- `src/App.js`: Gate auth → `Dashboard` atau `LoginButton`.
- `src/firebase/config.js`: Inisialisasi Firebase (Auth, Firestore, Storage).
- `src/hooks/useAuth.js`: State auth, Google/email login, register, logout, sinkronisasi user → Firestore.
- `src/hooks/useUserRole.js`: Load role dari Firestore, pemetaan izin, helper role-label, update role.
- `src/components/Dashboard.js`: Shell dashboard, tab: `filemanager`, `applications`, `usermanagement`, guard izin.
- `src/components/FileManagerTab.js`: UI file manager lengkap (upload, folder, filter, preview PDF/CSV/XLSX, bulk).
- `src/components/FileManager.js`: Varian file manager (lebih sederhana).
- `src/components/UserManagement.js`: Listing user, edit role, toggle aktif.
- `src/components/ApplicationManagement.js`: Tabel aplikasi staff, approve/reject/delete, auto-promote role.
- `src/components/StaffApplicationForm.js`: Form pengajuan menjadi staff (Irban/Auditor).
- `public/*`: Asset statis, manifest.

---

## Fitur Utama (Detail)
- **Role & Permission**
  - `super_admin`: full access, kelola user/role, semua file.
  - `Irban`: akses penuh arsip, kelola file/folder.
  - `Auditor`: akses baca file, upload dibatasi, tanpa download (sesuai mapping).
  - `guest`: akses sangat terbatas.
- **File Ops**: buat folder, upload multi-file dgn progress total, hapus, filter tanggal, pencarian, preview langsung.
- **Staff Apps**: user ajukan diri → admin setujui/tolak → status dan tanggal proses terekam.
- **User Ops**: ganti role, aktif/nonaktif user, badge/label per role.

---

## Teknologi
- React 19, CRA 5
- Firebase 12 (Auth, Firestore, Storage)
- XLSX untuk parsing/previews
- Tailwind (konfigurasi tersertakan), CSS modular sederhana

---

## Menjalankan Secara Lokal
1. Node LTS disarankan. Install dep:
   ```bash
   npm install
   ```
2. Buat file `.env` di root (prefiks `REACT_APP_`):
   ```bash
   REACT_APP_FIREBASE_API_KEY=xxx
   REACT_APP_FIREBASE_AUTH_DOMAIN=xxx
   REACT_APP_FIREBASE_PROJECT_ID=xxx
   REACT_APP_FIREBASE_STORAGE_BUCKET=xxx
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=xxx
   REACT_APP_FIREBASE_APP_ID=xxx
   REACT_APP_FIREBASE_MEASUREMENT_ID=xxx
   ```
3. Jalankan:
   ```bash
   npm start
   ```
4. Build prod:
   ```bash
   npm run build
   ```

---

## Praktik Keamanan yang Disarankan
- Batasi rules `firestore.rules` dan `storage.rules` sesuai `role` dan `isActive`.
- Validasi ukuran/jenis file saat upload.
- Audit log untuk perubahan role dan operasi file sensitif (opsional).

---

## Catatan Implementasi
- Default user baru → `guest` hingga dipromosikan.
- Izin UI ditentukan via `useUserRole.hasPermission()`; tab/aksi tersembunyi jika tak berizin.
- Aksi admin (approve aplikasi) memanggil `updateUserRole` untuk promosi (`Auditor` by default).

---

## Status Proyek
Production-ready untuk lingkungan kecil/menengah berbasis Firebase. Dapat di-scale dengan indexing Firestore dan CDN Storage.

---

## Kredit
CRA, Firebase, XLSX, Tailwind. 
