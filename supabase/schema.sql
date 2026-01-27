-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_plan AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE deployment_status AS ENUM ('queued', 'building', 'ready', 'error', 'cancelled');
CREATE TYPE deployment_environment AS ENUM ('production', 'preview', 'branch-deploy');
CREATE TYPE git_provider AS ENUM ('github', 'gitlab', 'bitbucket');
CREATE TYPE function_runtime AS ENUM ('nodejs', 'python', 'go');
CREATE TYPE project_status AS ENUM ('active', 'paused', 'deleted');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  plan user_plan DEFAULT 'free',
  
  -- Usage tracking
  bandwidth_used BIGINT DEFAULT 0,
  build_minutes_used INTEGER DEFAULT 0,
  sites_count INTEGER DEFAULT 0,
  
  -- Limits based on plan
  bandwidth_limit BIGINT DEFAULT 107374182400, -- 100GB
  build_minutes_limit INTEGER DEFAULT 300,
  sites_limit INTEGER DEFAULT 10,
  
  -- Git provider connections
  git_providers JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Repository configuration
  repository JSONB DEFAULT '{}', -- {provider, url, branch, private_key}
  
  -- Build settings
  build_settings JSONB DEFAULT '{"command": "npm run build", "directory": "dist", "environment": {}}',
  
  -- Domains
  domains JSONB DEFAULT '[{"domain": "", "is_custom": false, "ssl_enabled": true, "verified": true}]',
  
  -- Functions
  functions JSONB DEFAULT '[]',
  
  -- Forms
  forms JSONB DEFAULT '[]',
  
  -- Split tests
  split_tests JSONB DEFAULT '[]',
  
  -- Analytics
  analytics JSONB DEFAULT '{"enabled": true, "tracking_id": null}',
  
  -- Status
  status project_status DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deployments table
CREATE TABLE public.deployments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  
  -- Git information
  commit_sha TEXT,
  commit_message TEXT,
  branch TEXT,
  
  -- Deployment status
  status deployment_status DEFAULT 'queued',
  environment deployment_environment DEFAULT 'production',
  
  -- Build information
  build_log TEXT[] DEFAULT '{}',
  build_time INTEGER, -- in seconds
  size BIGINT, -- in bytes
  
  -- URLs
  url TEXT,
  preview_url TEXT,
  
  -- Build settings snapshot
  build_settings JSONB,
  
  -- Assets and functions
  assets JSONB DEFAULT '[]',
  functions JSONB DEFAULT '[]',
  
  -- Performance metrics
  performance JSONB DEFAULT '{}',
  
  -- Error information
  error JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics table for storing site analytics
CREATE TABLE public.analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  
  -- Request information
  path TEXT NOT NULL,
  method TEXT DEFAULT 'GET',
  status_code INTEGER,
  response_time INTEGER,
  
  -- User information
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  city TEXT,
  
  -- Timestamps
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Form submissions table
CREATE TABLE public.form_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  form_name TEXT NOT NULL,
  
  -- Submission data
  data JSONB NOT NULL,
  
  -- Request information
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function logs table
CREATE TABLE public.function_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  function_name TEXT NOT NULL,
  
  -- Execution information
  request_id TEXT NOT NULL,
  duration INTEGER, -- in milliseconds
  status_code INTEGER,
  error TEXT,
  
  -- Log data
  logs TEXT[],
  
  -- Timestamps
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Domains table for better domain management
CREATE TABLE public.domains (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  ssl_enabled BOOLEAN DEFAULT false,
  ssl_certificate TEXT,
  verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX idx_projects_slug ON public.projects(slug);
CREATE INDEX idx_deployments_project_id ON public.deployments(project_id);
CREATE INDEX idx_deployments_status ON public.deployments(status);
CREATE INDEX idx_deployments_created_at ON public.deployments(created_at DESC);
CREATE INDEX idx_analytics_project_id ON public.analytics(project_id);
CREATE INDEX idx_analytics_timestamp ON public.analytics(timestamp DESC);
CREATE INDEX idx_form_submissions_project_id ON public.form_submissions(project_id);
CREATE INDEX idx_function_logs_project_id ON public.function_logs(project_id);
CREATE INDEX idx_domains_project_id ON public.domains(project_id);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = owner_id);

-- Deployments policies
CREATE POLICY "Users can view deployments of own projects" ON public.deployments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = deployments.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create deployments for own projects" ON public.deployments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = deployments.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update deployments of own projects" ON public.deployments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = deployments.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- Analytics policies (read-only for users)
CREATE POLICY "Users can view analytics of own projects" ON public.analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = analytics.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- Form submissions policies
CREATE POLICY "Anyone can insert form submissions" ON public.form_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view form submissions of own projects" ON public.form_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = form_submissions.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- Function logs policies
CREATE POLICY "Users can view function logs of own projects" ON public.function_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = function_logs.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- Domains policies
CREATE POLICY "Users can manage domains of own projects" ON public.domains
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = domains.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- Functions to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON public.domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('deployments', 'deployments', true),
  ('functions', 'functions', false),
  ('assets', 'assets', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload deployment files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'deployments' AND auth.role() = 'authenticated');

CREATE POLICY "Public can view deployment files" ON storage.objects
  FOR SELECT USING (bucket_id = 'deployments');

CREATE POLICY "Authenticated users can upload function files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'functions' AND auth.role() = 'authenticated');

CREATE POLICY "Function owners can view function files" ON storage.objects
  FOR SELECT USING (bucket_id = 'functions' AND auth.role() = 'authenticated');

CREATE POLICY "Public can view asset files" ON storage.objects
  FOR SELECT USING (bucket_id = 'assets');