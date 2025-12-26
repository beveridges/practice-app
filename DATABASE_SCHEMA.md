# Database Schema Design

## Overview
SQLite database using **UUID primary keys** for offline-sync capability. All primary keys and foreign keys use TEXT/UUID format.

## Database Structure Visualization

```
┌─────────────────────────────────────┐
│         UserProfile                 │
│  ┌─────────────────────────────┐   │
│  │ id (UUID) [PK]              │   │
│  │ username (unique, nullable) │   │
│  │ email (unique, nullable)    │   │
│  │ name                        │   │
│  │ biography (nullable)        │   │
│  │ reminder_hours              │   │
│  │ notifications_enabled       │   │
│  │ created_at                  │   │
│  │ updated_at                  │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │ 1
               │
               │ has many
               │
               ▼
┌─────────────────────────────────────┐
│         Instrument                   │
│  ┌─────────────────────────────┐   │
│  │ id (UUID) [PK]              │   │
│  │ user_profile_id (UUID) [FK] │───┘
│  │ name                        │   │
│  │ category                    │   │
│  │ notes (nullable)            │   │
│  │ created_at                  │   │
│  │ updated_at                  │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │ 1
               │
               │ has many
               │
               ▼
┌─────────────────────────────────────┐
│      TaskDefinition                 │
│  ┌─────────────────────────────┐   │
│  │ id (UUID) [PK]              │   │
│  │ instrument_id (UUID) [FK]    │───┘
│  │ task_type                   │   │
│  │ frequency_type              │   │
│  │ frequency_value             │   │
│  │ start_date                  │   │
│  │ created_at                  │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │ 1
               │
               │ generates many
               │
               ▼
┌─────────────────────────────────────┐
│      TaskOccurrence                 │
│  ┌─────────────────────────────┐   │
│  │ id (UUID) [PK]              │   │
│  │ task_definition_id (UUID)FK │───┘
│  │ instrument_id (UUID) [FK]    │───┐
│  │ due_date [INDEXED]          │   │
│  │ task_type                   │   │
│  │ completed                   │   │
│  │ completed_at (nullable)     │   │
│  │ notes (nullable)            │   │
│  │ photo_url (nullable)        │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │ 1
               │
               │ creates many
               │
               ▼
┌─────────────────────────────────────┐
│      TaskCompletion                 │
│  ┌─────────────────────────────┐   │
│  │ id (UUID) [PK]              │   │
│  │ task_occurrence_id (UUID)FK │───┘
│  │ instrument_id (UUID)         │───┐
│  │ task_type                   │   │
│  │ completed_at                │   │
│  │ notes (nullable)            │   │
│  │ photo_url (nullable)        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Tables

### 1. user_profile (Main Entry Point)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY | Unique identifier |
| username | TEXT | UNIQUE, NULL | Optional username |
| email | TEXT | UNIQUE, NULL | Optional email |
| name | TEXT | NOT NULL | User's full name |
| biography | TEXT | NULL | User bio/notes |
| reminder_hours | INTEGER | DEFAULT 24 | Hours before task due for reminder |
| notifications_enabled | BOOLEAN | DEFAULT TRUE | Enable notifications |
| created_at | DATETIME | DEFAULT NOW | Creation timestamp |
| updated_at | DATETIME | DEFAULT NOW | Last update timestamp |

### 2. instrument
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY | Unique identifier |
| user_profile_id | TEXT (UUID) | FOREIGN KEY → user_profile.id, NULL | Owner of instrument |
| name | TEXT | NOT NULL | Instrument name |
| category | TEXT | NOT NULL | Category enum (Woodwind, Brass, etc.) |
| notes | TEXT | NULL | Additional notes |
| created_at | DATETIME | DEFAULT NOW | Creation timestamp |
| updated_at | DATETIME | DEFAULT NOW | Last update timestamp |

### 3. task_definitions
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY | Unique identifier |
| instrument_id | TEXT (UUID) | FOREIGN KEY → instrument.id | Instrument this task is for |
| task_type | TEXT | NOT NULL | Task type enum (Cleaning, Drying, etc.) |
| frequency_type | TEXT | NOT NULL | Frequency enum (days, weekly, monthly) |
| frequency_value | INTEGER | NOT NULL | N days, or 1 for weekly/monthly |
| start_date | DATE | NOT NULL | When task schedule starts |
| created_at | DATETIME | DEFAULT NOW | Creation timestamp |

### 4. task_occurrences
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY | Unique identifier |
| task_definition_id | TEXT (UUID) | FOREIGN KEY → task_definitions.id | Parent task definition |
| instrument_id | TEXT (UUID) | FOREIGN KEY → instrument.id | Instrument (denormalized) |
| due_date | DATE | NOT NULL, INDEXED | When task is due |
| task_type | TEXT | NOT NULL | Task type (denormalized) |
| completed | BOOLEAN | DEFAULT FALSE | Completion status |
| completed_at | DATETIME | NULL | When task was completed |
| notes | TEXT | NULL | Task notes |
| photo_url | TEXT | NULL | Link to completion photo |

### 5. task_completions
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY | Unique identifier |
| task_occurrence_id | TEXT (UUID) | FOREIGN KEY → task_occurrences.id | Completed task |
| instrument_id | TEXT (UUID) | NOT NULL | Instrument (denormalized for queries) |
| task_type | TEXT | NOT NULL | Task type (denormalized) |
| completed_at | DATETIME | DEFAULT NOW | Completion timestamp |
| notes | TEXT | NULL | Completion notes |
| photo_url | TEXT | NULL | Completion photo URL |

## Relationships

1. **UserProfile → Instrument** (1:many)
   - One user can have many instrument items
   - Cascade delete: deleting user deletes all instrument

2. **Instrument → TaskDefinition** (1:many)
   - One instrument item can have many task definitions
   - Cascade delete: deleting instrument deletes all task definitions

3. **TaskDefinition → TaskOccurrence** (1:many)
   - One task definition generates many task occurrences
   - Cascade delete: deleting task definition deletes all occurrences

4. **TaskOccurrence → TaskCompletion** (1:many)
   - One task occurrence can have many completion records (for history)

## UUID Benefits

- **Offline Sync**: Devices can create records offline without ID collisions
- **Client-side Generation**: Generate IDs before sending to server
- **Conflict-free Merges**: Multiple devices can create records simultaneously
- **Photo Sync**: Photos can reference instrument/tasks by UUID before upload
- **Future Scalability**: Easy to sync with remote server

## Indexes

- Primary keys automatically indexed
- `task_occurrences.due_date` - Indexed for date range queries
- Foreign keys are automatically indexed in SQLite

## Creating the Database

Run:
```bash
cd backend
conda activate pwa-backend
python create_database.py
```

Or with sample data:
```bash
python create_database.py --with-samples
```

Then inspect with:
- DB Browser for SQLite: Open `backend/practice_tracker.db`
- SQLite command line: `sqlite3 backend/practice_tracker.db`
- Web viewer: `http://127.0.0.1:8000/admin/db-viewer` (after starting backend)

