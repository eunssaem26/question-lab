create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null check (role in ('student', 'teacher', 'parent')),
  grade int check (grade between 3 and 9),
  assigned_level text check (assigned_level in ('middle', 'advanced')),
  created_at timestamptz default now()
);

create table books (
  id serial primary key,
  title text not null,
  author text not null,
  died_year int,
  genre text not null check (genre in ('소설', '시', '수필', '동화')),
  level text not null check (level in ('middle', 'advanced')),
  description text
);

create table passages (
  id serial primary key,
  book_id int references books on delete cascade,
  unit_number int not null,
  title text,
  body text not null,
  word_count int,
  level text not null check (level in ('middle', 'advanced')),
  reading_strategy text,
  vocab_preview jsonb,
  background_question text
);

create table questions (
  id serial primary key,
  passage_id int references passages on delete cascade,
  order_num int not null,
  question_type text not null check (
    question_type in ('fact', 'vocab', 'inference', 'compare', 'theme', 'critical', 'short_answer')
  ),
  question_text text not null,
  options jsonb,
  correct_answer text not null,
  explanation text not null
);

create table lesson_sessions (
  id serial primary key,
  user_id uuid references profiles on delete cascade,
  passage_id int references passages on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  score numeric(5,2)
);

create table answers (
  id serial primary key,
  session_id int references lesson_sessions on delete cascade,
  question_id int references questions on delete cascade,
  user_answer text not null,
  is_correct boolean not null,
  ai_feedback text,
  time_spent_sec int,
  answered_at timestamptz default now()
);

create table progress_summary (
  user_id uuid references profiles on delete cascade primary key,
  level text,
  total_sessions int default 0,
  completed_passages int[] default '{}',
  accuracy_fact numeric(5,2),
  accuracy_vocab numeric(5,2),
  accuracy_inference numeric(5,2),
  accuracy_theme numeric(5,2),
  accuracy_short_answer numeric(5,2),
  updated_at timestamptz default now()
);

create table teacher_students (
  teacher_id uuid references profiles on delete cascade,
  student_id uuid references profiles on delete cascade,
  primary key (teacher_id, student_id)
);

alter table profiles enable row level security;
alter table lesson_sessions enable row level security;
alter table answers enable row level security;
alter table progress_summary enable row level security;

create policy "본인 프로필만 조회" on profiles
  for select using (auth.uid() = id);

create policy "본인 세션만 조회" on lesson_sessions
  for select using (auth.uid() = user_id);

create policy "본인 답변만 조회" on answers
  for select using (
    session_id in (
      select id from lesson_sessions where user_id = auth.uid()
    )
  );
