-- Seed data for development and testing

-- Insert sample users (these will be created through Supabase Auth in real usage)
-- This is just for reference - actual users are managed by Supabase Auth

-- Sample projects
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
  'my-portfolio',
  '00000000-0000-0000-0000-000000000001', -- Replace with actual user ID
  '{"provider": "github", "url": "https://github.com/user/portfolio", "branch": "main"}',
  '{"command": "npm run build", "directory": "dist", "environment": {}}',
  '[{"domain": "my-portfolio.yourplatform.com", "is_custom": false, "ssl_enabled": true, "verified": true}]',
  'active'
),
(
  uuid_generate_v4(),
  'Company Website',
  'company-website',
  '00000000-0000-0000-0000-000000000001', -- Replace with actual user ID
  '{"provider": "gitlab", "url": "https://gitlab.com/company/website", "branch": "main"}',
  '{"command": "npm run build", "directory": "build", "environment": {"NODE_ENV": "production"}}',
  '[{"domain": "company-website.yourplatform.com", "is_custom": false, "ssl_enabled": true, "verified": true}, {"domain": "company.com", "is_custom": true, "ssl_enabled": true, "verified": true}]',
  'active'
);

-- Sample deployments
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
  (SELECT id FROM public.projects WHERE slug = 'my-portfolio' LIMIT 1),
  'abc123def456',
  'Update homepage design',
  'main',
  'ready',
  'production',
  45,
  2048576, -- 2MB
  'https://my-portfolio.yourplatform.com',
  '{"command": "npm run build", "directory": "dist", "environment": {}}'
),
(
  uuid_generate_v4(),
  (SELECT id FROM public.projects WHERE slug = 'company-website' LIMIT 1),
  'def456ghi789',
  'Add contact form',
  'main',
  'ready',
  'production',
  67,
  5242880, -- 5MB
  'https://company-website.yourplatform.com',
  '{"command": "npm run build", "directory": "build", "environment": {"NODE_ENV": "production"}}'
);

-- Sample analytics data
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
  (SELECT id FROM public.projects WHERE slug = 'my-portfolio' LIMIT 1),
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
  (SELECT id FROM public.projects WHERE slug = 'my-portfolio' LIMIT 1),
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
  (SELECT id FROM public.projects WHERE slug = 'company-website' LIMIT 1),
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

-- Sample form submissions
INSERT INTO public.form_submissions (
  project_id,
  form_name,
  data,
  ip_address,
  user_agent
) VALUES 
(
  (SELECT id FROM public.projects WHERE slug = 'my-portfolio' LIMIT 1),
  'contact',
  '{"name": "John Doe", "email": "john@example.com", "message": "Great portfolio!"}',
  '192.168.1.100',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
),
(
  (SELECT id FROM public.projects WHERE slug = 'company-website' LIMIT 1),
  'newsletter',
  '{"email": "jane@example.com", "interests": ["web-development", "design"]}',
  '10.0.0.50',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
);

-- Sample function logs
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
  (SELECT id FROM public.projects WHERE slug = 'company-website' LIMIT 1),
  'contact-form',
  'req-abc123',
  250,
  200,
  '["Function started", "Processing form data", "Sending email", "Function completed"]',
  NOW() - INTERVAL '1 hour'
),
(
  (SELECT id FROM public.projects WHERE slug = 'company-website' LIMIT 1),
  'newsletter-signup',
  'req-def456',
  180,
  200,
  '["Function started", "Validating email", "Adding to mailing list", "Function completed"]',
  NOW() - INTERVAL '2 hours'
);

-- Sample domains
INSERT INTO public.domains (
  project_id,
  domain,
  is_custom,
  ssl_enabled,
  verified
) VALUES 
(
  (SELECT id FROM public.projects WHERE slug = 'company-website' LIMIT 1),
  'company.com',
  true,
  true,
  true
),
(
  (SELECT id FROM public.projects WHERE slug = 'company-website' LIMIT 1),
  'www.company.com',
  true,
  true,
  true
);