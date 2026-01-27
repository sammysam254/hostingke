-- Seed data for development and testing

-- NOTE: This seed data is for reference only
-- In a real Supabase setup, users are created through Supabase Auth
-- You'll need to replace the user IDs with actual user IDs from your auth.users table

-- To use this seed data:
-- 1. Create a user through your application's registration
-- 2. Find the user ID in the auth.users table
-- 3. Replace the placeholder user ID below with the real one
-- 4. Then run this seed data

-- Example: SELECT id FROM auth.users LIMIT 1;
-- Copy that ID and replace '00000000-0000-0000-0000-000000000001' below

-- First, let's create a sample user profile (optional - users are created via Supabase Auth)
-- This is just for the users table, not auth.users
INSERT INTO public.users (
  id,
  email,
  name,
  plan,
  bandwidth_used,
  build_minutes_used,
  sites_count
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- Replace with real user ID from auth.users
  'demo@example.com',
  'Demo User',
  'free',
  0,
  0,
  0
) ON CONFLICT (id) DO NOTHING; -- Ignore if user already exists

-- Sample projects (only run after replacing user ID above)
INSERT INTO public.projects (
  id,
  name,
  slug,
  owner_id,
  repository,
  build_settings,
  domains,
  status
) VALUES 
(
  uuid_generate_v4(),
  'My Portfolio',
  'my-portfolio-demo',
  '00000000-0000-0000-0000-000000000001', -- Replace with real user ID
  '{"provider": "github", "url": "https://github.com/user/portfolio", "branch": "main"}',
  '{"command": "npm run build", "directory": "dist", "environment": {}}',
  '[{"domain": "my-portfolio-demo.yourplatform.com", "is_custom": false, "ssl_enabled": true, "verified": true}]',
  'active'
),
(
  uuid_generate_v4(),
  'Company Website',
  'company-website-demo',
  '00000000-0000-0000-0000-000000000001', -- Replace with real user ID
  '{"provider": "gitlab", "url": "https://gitlab.com/company/website", "branch": "main"}',
  '{"command": "npm run build", "directory": "build", "environment": {"NODE_ENV": "production"}}',
  '[{"domain": "company-website-demo.yourplatform.com", "is_custom": false, "ssl_enabled": true, "verified": true}, {"domain": "demo-company.com", "is_custom": true, "ssl_enabled": true, "verified": true}]',
  'active'
);

-- Sample deployments (only run after projects are created)
INSERT INTO public.deployments (
  id,
  project_id,
  commit_sha,
  commit_message,
  branch,
  status,
  environment,
  build_time,
  size,
  url,
  build_settings
) VALUES 
(
  uuid_generate_v4(),
  (SELECT id FROM public.projects WHERE slug = 'my-portfolio-demo' LIMIT 1),
  'abc123def456',
  'Update homepage design',
  'main',
  'ready',
  'production',
  45,
  2048576, -- 2MB
  'https://my-portfolio-demo.yourplatform.com',
  '{"command": "npm run build", "directory": "dist", "environment": {}}'
),
(
  uuid_generate_v4(),
  (SELECT id FROM public.projects WHERE slug = 'company-website-demo' LIMIT 1),
  'def456ghi789',
  'Add contact form',
  'main',
  'ready',
  'production',
  67,
  5242880, -- 5MB
  'https://company-website-demo.yourplatform.com',
  '{"command": "npm run build", "directory": "build", "environment": {"NODE_ENV": "production"}}'
);

-- Sample analytics data (only run after projects are created)
INSERT INTO public.analytics (
  project_id,
  path,
  method,
  status_code,
  response_time,
  ip_address,
  user_agent,
  referer,
  country,
  city,
  timestamp
) VALUES 
(
  (SELECT id FROM public.projects WHERE slug = 'my-portfolio-demo' LIMIT 1),
  '/',
  'GET',
  200,
  150,
  '192.168.1.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'https://google.com',
  'US',
  'New York',
  NOW() - INTERVAL '1 hour'
),
(
  (SELECT id FROM public.projects WHERE slug = 'my-portfolio-demo' LIMIT 1),
  '/about',
  'GET',
  200,
  120,
  '192.168.1.2',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'https://twitter.com',
  'CA',
  'Toronto',
  NOW() - INTERVAL '2 hours'
),
(
  (SELECT id FROM public.projects WHERE slug = 'company-website-demo' LIMIT 1),
  '/',
  'GET',
  200,
  200,
  '10.0.0.1',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'https://linkedin.com',
  'UK',
  'London',
  NOW() - INTERVAL '30 minutes'
);

-- Sample form submissions (only run after projects are created)
INSERT INTO public.form_submissions (
  project_id,
  form_name,
  data,
  ip_address,
  user_agent
) VALUES 
(
  (SELECT id FROM public.projects WHERE slug = 'my-portfolio-demo' LIMIT 1),
  'contact',
  '{"name": "John Doe", "email": "john@example.com", "message": "Great portfolio!"}',
  '192.168.1.100',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
),
(
  (SELECT id FROM public.projects WHERE slug = 'company-website-demo' LIMIT 1),
  'newsletter',
  '{"email": "jane@example.com", "interests": ["web-development", "design"]}',
  '10.0.0.50',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
);

-- Sample function logs (only run after projects are created)
INSERT INTO public.function_logs (
  project_id,
  function_name,
  request_id,
  duration,
  status_code,
  logs,
  timestamp
) VALUES 
(
  (SELECT id FROM public.projects WHERE slug = 'company-website-demo' LIMIT 1),
  'contact-form',
  'req-abc123',
  250,
  200,
  '["Function started", "Processing form data", "Sending email", "Function completed"]',
  NOW() - INTERVAL '1 hour'
),
(
  (SELECT id FROM public.projects WHERE slug = 'company-website-demo' LIMIT 1),
  'newsletter-signup',
  'req-def456',
  180,
  200,
  '["Function started", "Validating email", "Adding to mailing list", "Function completed"]',
  NOW() - INTERVAL '2 hours'
);

-- Sample domains (only run after projects are created)
INSERT INTO public.domains (
  project_id,
  domain,
  is_custom,
  ssl_enabled,
  verified
) VALUES 
(
  (SELECT id FROM public.projects WHERE slug = 'company-website-demo' LIMIT 1),
  'demo-company.com',
  true,
  true,
  true
),
(
  (SELECT id FROM public.projects WHERE slug = 'company-website-demo' LIMIT 1),
  'www.demo-company.com',
  true,
  true,
  true
);