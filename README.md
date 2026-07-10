# 📝 My Blog Platform

A modern, fully-featured blog platform built with **Next.js 14**, **Supabase**, and **Tiptap** rich text editor.

## ✨ Features

- 📰 Create, edit, and delete blog posts
- 🏷️ Tags and categories for posts
- 💬 Comments on posts
- 👍 Like posts functionality
- 🔍 Search and filter posts
- 🎨 Rich text editor (Tiptap)
- 📱 Responsive design with Tailwind CSS
- ⚡ Full-stack TypeScript
- 🚀 Ready for Vercel deployment

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Rich Text Editor**: Tiptap
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Form Handling**: React Hook Form
- **Validation**: Zod

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
cd nvhug.github.io
npm install
```

### 2. Setup Supabase

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Get your API credentials from **Settings** → **API**
4. Copy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Create Database Tables

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Posts table
CREATE TABLE posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Post tags junction table
CREATE TABLE post_tags (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Comments table
CREATE TABLE comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Likes table
CREATE TABLE likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS (Row Level Security) - for public access
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read posts" ON posts FOR SELECT USING (TRUE);
CREATE POLICY "Public read comments" ON comments FOR SELECT USING (TRUE);
CREATE POLICY "Public insert comments" ON comments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public read likes" ON likes FOR SELECT USING (TRUE);
CREATE POLICY "Public insert likes" ON likes FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public read tags" ON tags FOR SELECT USING (TRUE);
```

### 4. Configure Environment

Create/update `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 5. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
├── app/
│   ├── page.tsx                 # Homepage (blog list)
│   ├── blog/[slug]/page.tsx     # Post detail page
│   ├── admin/page.tsx           # Admin dashboard
│   ├── admin/create/page.tsx    # Create post
│   ├── admin/[id]/edit/page.tsx # Edit post
│   └── layout.tsx               # Root layout
├── src/
│   ├── components/
│   │   ├── RichEditor.tsx       # Tiptap editor
│   │   └── BlogCard.tsx         # Post card component
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   └── utils.ts             # Utility functions
│   └── types/
│       └── index.ts             # TypeScript types
├── public/                       # Static files
└── package.json
```

## 🎨 Pages

- **`/`** - Homepage with blog list and search
- **`/blog/[slug]`** - Individual post with comments
- **`/admin`** - Admin dashboard (list all posts)
- **`/admin/create`** - Create new post
- **`/admin/[id]/edit`** - Edit existing post

## 🔌 API Integration

All data is managed through **Supabase Realtime Database**:
- Read posts via `supabase.from('posts').select()`
- Create posts via `supabase.from('posts').insert()`
- Update posts via `supabase.from('posts').update()`
- Delete posts via `supabase.from('posts').delete()`

## 🚀 Deployment to Vercel

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "Initial blog setup"
   git push origin main
   ```

2. Deploy on Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - Deploy!

## 📝 Notes

- The blog is single-author by default. To add authentication, integrate Supabase Auth.
- Rich text editor uses Tiptap with basic formatting (bold, italic, headings, lists).
- All posts are stored in PostgreSQL via Supabase.
- Comments and likes are public by default (no authentication required).

## 🤝 Contributing

Feel free to modify and extend this blog platform!

## 📄 License

MIT
