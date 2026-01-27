-- Safe seed data that doesn't require existing users
-- This file contains sample data that won't cause foreign key errors

-- Sample analytics data (without requiring projects)
-- You can run this after creating projects through the application

-- Sample form submission data structure (for reference)
-- INSERT INTO public.form_submissions (project_id, form_name, data, ip_address, user_agent)
-- VALUES ('your-project-id', 'contact', '{"name": "John Doe", "email": "john@example.com"}', '192.168.1.1', 'Mozilla/5.0');

-- Sample function logs structure (for reference)  
-- INSERT INTO public.function_logs (project_id, function_name, request_id, duration, status_code, logs)
-- VALUES ('your-project-id', 'contact-form', 'req-123', 250, 200, '["Function started", "Function completed"]');

-- Sample domains structure (for reference)
-- INSERT INTO public.domains (project_id, domain, is_custom, ssl_enabled, verified)
-- VALUES ('your-project-id', 'example.com', true, true, true);

-- To use this seed data properly:
-- 1. First, register a user through your application
-- 2. Create a project through your application  
-- 3. Get the project ID from the database
-- 4. Replace 'your-project-id' in the examples above with the real project ID
-- 5. Then run the INSERT statements

-- Example query to get your project IDs after creating projects:
-- SELECT id, name, slug FROM public.projects WHERE owner_id = 'your-user-id';

-- Example query to get your user ID:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- This approach ensures no foreign key constraint violations!