# Supabase Database Setup Guide

This guide walks you through setting up your Supabase database for the hosting platform.

## 🚀 Quick Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub (recommended)
4. Click "New project"
5. Choose your organization
6. Fill in project details:
   - **Name**: `hosting-platform` (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
7. Click "Create new project"
8. Wait for the project to be ready (2-3 minutes)

### Step 2: Get Your Credentials

Once your project is ready:

1. Go to **Settings** → **API**
2. Copy these values to your `.env` file:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### Step 3: Run Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New query"
3. Copy and paste the entire contents of `supabase/schema.sql`
4. Click "Run" to execute the schema
5. You should see "Success. No rows returned" message

### Step 4: Verify Setup

Check that tables were created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see these tables:
- `analytics`
- `deployments`
- `domains`
- `form_submissions`
- `function_logs`
- `projects`
- `users`

## 🔐 Authentication Setup

### Enable Email Authentication

1. Go to **Authentication** → **Settings**
2. Under **Auth Providers**, ensure **Email** is enabled
3. Configure email settings:
   - **Enable email confirmations**: ✅ (recommended)
   - **Enable email change confirmations**: ✅ (recommended)

### Optional: Enable OAuth Providers

For GitHub integration:
1. Go to **Authentication** → **Settings**
2. Under **Auth Providers**, click **GitHub**
3. Enable GitHub provider
4. Add your GitHub OAuth app credentials:
   - **Client ID**: From your GitHub OAuth app
   - **Client Secret**: From your GitHub OAuth app
   - **Redirect URL**: `https://your-project.supabase.co/auth/v1/callback`

## 📊 Sample Data (Optional)

### Option 1: Use the Application

The safest way to add sample data:

1. Start your application locally
2. Register a new user
3. Create a project through the UI
4. Deploy a test site
5. This creates real data without foreign key issues

### Option 2: Manual Sample Data

If you want to add sample data manually:

1. **First, create a user through your app's registration**
2. **Find the user ID**:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
   ```
3. **Copy the user ID and replace it in the seed file**
4. **Run the modified seed data**

## 🔧 Row Level Security (RLS)

The schema automatically sets up RLS policies. Verify they're working:

```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 🗄️ Storage Setup

### Create Storage Buckets

1. Go to **Storage** in Supabase dashboard
2. Create these buckets:

**Deployments Bucket:**
- **Name**: `deployments`
- **Public**: ✅ Yes
- **File size limit**: 100MB
- **Allowed MIME types**: Leave empty (all types)

**Functions Bucket:**
- **Name**: `functions`  
- **Public**: ❌ No
- **File size limit**: 10MB
- **Allowed MIME types**: Leave empty

**Assets Bucket:**
- **Name**: `assets`
- **Public**: ✅ Yes  
- **File size limit**: 50MB
- **Allowed MIME types**: Leave empty

### Verify Storage Policies

The schema includes storage policies. Verify in **Storage** → **Policies**:
- Authenticated users can upload to deployments
- Public can view deployment files
- Function owners can manage function files

## 🔄 Real-time Setup

Real-time is enabled by default. To verify:

1. Go to **Database** → **Replication**
2. Ensure these tables have replication enabled:
   - `deployments`
   - `projects`
   - `analytics`

## 🧪 Test Your Setup

### Test Database Connection

Run this in SQL Editor:
```sql
-- Test basic functionality
SELECT 'Database setup successful!' as message;

-- Test user table
SELECT COUNT(*) as user_count FROM public.users;

-- Test projects table  
SELECT COUNT(*) as project_count FROM public.projects;
```

### Test from Your Application

1. Start your local development server
2. Check the console for "✅ Connected to Supabase"
3. Try registering a new user
4. Try creating a project

## 🚨 Troubleshooting

### Common Issues

**1. Schema Creation Failed**
```
ERROR: permission denied for schema public
```
**Solution**: Make sure you're using the service role key, not the anon key

**2. RLS Blocking Queries**
```
ERROR: new row violates row-level security policy
```
**Solution**: Ensure you're authenticated when testing, or temporarily disable RLS for testing

**3. Storage Bucket Creation Failed**
```
ERROR: bucket already exists
```
**Solution**: Buckets might already exist, check Storage dashboard

**4. Foreign Key Constraint Errors**
```
ERROR: insert or update violates foreign key constraint
```
**Solution**: Don't run seed data until you have real users created through auth

### Debug Queries

**Check table structure:**
```sql
\d+ public.projects
```

**Check RLS policies:**
```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

**Check user authentication:**
```sql
SELECT auth.uid(), auth.email();
```

**Check storage buckets:**
```sql
SELECT * FROM storage.buckets;
```

## 🔄 Database Migrations

For future schema changes:

1. Create migration files in `supabase/migrations/`
2. Use descriptive names: `20240127000000_add_new_feature.sql`
3. Test migrations on staging first
4. Apply to production during maintenance windows

## 📈 Performance Optimization

### Indexes

The schema includes essential indexes. Monitor query performance:

```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Connection Pooling

For production, consider:
- Supabase connection pooling (enabled by default)
- Application-level connection pooling
- Read replicas for analytics queries

## 🔒 Security Best Practices

1. **Never use service role key in client-side code**
2. **Regularly rotate API keys**
3. **Monitor auth logs for suspicious activity**
4. **Use RLS policies for all sensitive data**
5. **Enable MFA for your Supabase account**
6. **Regularly backup your database**

## 📊 Monitoring

### Database Health

Monitor in Supabase dashboard:
- **Database** → **Health** for performance metrics
- **Auth** → **Users** for user growth
- **Storage** → **Usage** for storage consumption

### Custom Monitoring

Set up alerts for:
- High connection count
- Slow query performance  
- Storage quota approaching limits
- Authentication failures

## 🆘 Support

If you encounter issues:

1. **Check Supabase Status**: [status.supabase.com](https://status.supabase.com)
2. **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
3. **Community**: [github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)
4. **Discord**: [discord.supabase.com](https://discord.supabase.com)

## ✅ Setup Checklist

- [ ] Supabase project created
- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] RLS policies verified
- [ ] Storage buckets created
- [ ] Authentication configured
- [ ] Real-time enabled
- [ ] Application connection tested
- [ ] Sample user created
- [ ] Sample project created

Once all items are checked, your Supabase setup is complete! 🎉