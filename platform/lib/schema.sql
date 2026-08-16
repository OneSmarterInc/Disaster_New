-- Flexee Rapid Sims platform.
-- Deliberately small: people, courses, enrolments, entitlement. No payment tables —
-- money is handled outside the system and lands here as a "paid" flag.

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin','faculty','student')),
  password_hash  TEXT,                       -- null until they accept an invite
  institution    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ,
  disabled       BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- One-time links: faculty invites and password resets.
CREATE TABLE IF NOT EXISTS tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

-- Login sessions. Cookie holds the id; nothing sensitive lives in the browser.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- The catalogue. Each sim is its own deployment; the platform launches into it.
CREATE TABLE IF NOT EXISTS sims (
  id            TEXT PRIMARY KEY,            -- e.g. 'rapid-01-disaster'
  title         TEXT NOT NULL,
  tagline       TEXT,
  description   TEXT,
  minutes       INTEGER,
  launch_url    TEXT NOT NULL,               -- where a launch token is sent
  published     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A faculty member's seven-day look at a sim before committing to it.
CREATE TABLE IF NOT EXISTS previews (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, sim_id)
);

CREATE TABLE IF NOT EXISTS courses (
  id            TEXT PRIMARY KEY,
  faculty_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  term          TEXT,
  join_code     TEXT UNIQUE NOT NULL,        -- what goes in the student link
  archived      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS courses_faculty_idx ON courses(faculty_id);

-- Which sims a course uses, and how many students the faculty expects.
CREATE TABLE IF NOT EXISTS course_sims (
  course_id      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sim_id         TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  expected_seats INTEGER,
  hard_cap       BOOLEAN NOT NULL DEFAULT false,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, sim_id)
);

-- A student in a course. "paid" is the entitlement switch; without it they can
-- enrol and see the course but cannot launch a sim.
CREATE TABLE IF NOT EXISTS enrolments (
  id           TEXT PRIMARY KEY,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paid         BOOLEAN NOT NULL DEFAULT false,
  paid_at      TIMESTAMPTZ,
  paid_by      TEXT REFERENCES users(id),    -- which faculty marked it
  paid_note    TEXT,                          -- e.g. "dept PO 4471"
  dropped      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);
CREATE INDEX IF NOT EXISTS enrolments_course_idx ON enrolments(course_id);
CREATE INDEX IF NOT EXISTS enrolments_student_idx ON enrolments(student_id);

-- Every launch, so admin can see real usage and faculty can see who has played.
CREATE TABLE IF NOT EXISTS launches (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  course_id   TEXT REFERENCES courses(id) ON DELETE SET NULL,
  as_role     TEXT NOT NULL,                 -- 'student' | 'faculty_preview' | 'faculty'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launches_user_idx ON launches(user_id);
CREATE INDEX IF NOT EXISTS launches_course_idx ON launches(course_id);
