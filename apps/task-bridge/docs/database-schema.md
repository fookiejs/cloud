# Task Bridge — Veritabanı Şeması

Tek SQLite dosyası: `data/bridge.db` (veya `config.databasePath`).

---

## Tablolar

### `projects`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | ID PK | Proje kimliği |
| `name` | TEXT | Proje adı |
| `description` | TEXT | Açıklama |
| `workflow_id` | ID | → `workflow_templates.id` |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

---

### `users`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | ID PK | Kullanıcı kimliği |
| `name` | TEXT | Ad |
| `email` | TEXT UNIQUE | E-posta |
| `password_hash` | TEXT | Şifre hash |
| `role` | TEXT | `admin` / `read-write` / `read` |
| `is_system_admin` | INTEGER | Sistem admini (0/1) |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

---

### `workflow_templates`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | ID PK | Şablon kimliği |
| `title` | TEXT | Başlık |
| `description` | TEXT | Açıklama |
| `updated_at` | TEXT | |

---

### `workflow_template_stages`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `workflow_id` | ID | → `workflow_templates.id` |
| `id` | ID | Aşama kimliği |
| `title` | TEXT | |
| `description` | TEXT | |
| `position` | INTEGER | Sıra |

**PK:** `(workflow_id, id)`

---

### `workflow_template_tasks`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | ID | Şablon görev kimliği |
| `stage_id` | ID | → `workflow_template_stages.id` |
| `parent_id` | ID NULLABLE | → `workflow_template_tasks.id` |
| `title` | TEXT | |
| `description` | TEXT | |
| `assignee_role_id` | ID | → `roles.id` |
| `execution` | TEXT | `parallel` / `sequential` |

---

### `workflow_state`

Projede çalışan workflow. Şablondan kopyalanır, proje boyunca bu tablolar kullanılır.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | ID PK | |
| `epic_id` | ID | → `epics.id` |
| `epic_id` | JSON | → `all workflowstate` |


---

### `roles`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | ID PK | Rol kimliği |
| `project_id` | ID | → `projects.id` |
| `title` | TEXT | Rol adı |
| `description` | TEXT | Rol açıklaması |

**UNIQUE:** `(project_id, title)`

---

### `epics`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | ID PK | Epic kimliği |
| `project_id` | ID | → `projects.id` |
| `title` | TEXT | |
| `description` | TEXT | |
| `stage_id` | ID NULL | → `workflow_stages.id` |
| `created_by` | ID | → `users.id` |

---

### `project_members`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | TEXT PK | Üye kimliği |
| `project_id` | TEXT | → `projects.id` |
| `user_id` | ID | → `users.id` |
| `role_id` | ID | → `roles.id` |

**UNIQUE:** `(project_id, user_id)`

---

### `inbox`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | ID PK | |
| `user_id` | ID | → `users.id` |
| `comment` | TEXT | |
| `project_id` | ID | → `projects.id` |

---

### `libraries`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | TEXT PK | |
| `title` | TEXT | |
| `description` | TEXT | |
| `updated_at` | TEXT | |

---

### `library_documents`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | TEXT PK | |
| `library_id` | TEXT FK | → `libraries.id` ON DELETE CASCADE |
| `title` | TEXT | |
| `description` | TEXT | |

**İndeks:** `idx_library_documents_library_id`

---

### `library_document_links`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `document_id` | TEXT FK | → `library_documents.id` ON DELETE CASCADE |
| `epic_id` | INTEGER NULL | → `epics.id` |

**İndeks:** `idx_library_document_links_epic_id`

---

## Worker queue (tablo yok)

| Endpoint | Açıklama |
|----------|----------|
| `GET /worker/pending` | Claim edilebilir görevler |
| `POST /worker/claim-next` | Atomik claim |

---
