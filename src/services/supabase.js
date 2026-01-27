const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error('Missing Supabase configuration. Please check your environment variables.');
    }

    // Client for user operations (with RLS)
    this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
    
    // Admin client for service operations (bypasses RLS)
    this.supabaseAdmin = createClient(this.supabaseUrl, this.supabaseServiceKey);
  }

  // Get client with user session
  getClient(accessToken = null) {
    if (accessToken) {
      return createClient(this.supabaseUrl, this.supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      });
    }
    return this.supabase;
  }

  // Get admin client (bypasses RLS)
  getAdminClient() {
    return this.supabaseAdmin;
  }

  async connect() {
    try {
      // Test connection
      const { data, error } = await this.supabase.from('users').select('count').limit(1);
      if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist" which is fine for initial setup
        console.error('Supabase connection test failed:', error);
      } else {
        console.log('✅ Connected to Supabase');
      }
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      throw error;
    }
  }

  // Authentication helpers
  async signUp(email, password, metadata = {}) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    return { data, error };
  }

  async signIn(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  }

  async signOut(accessToken) {
    const client = this.getClient(accessToken);
    const { error } = await client.auth.signOut();
    return { error };
  }

  async getUser(accessToken) {
    const client = this.getClient(accessToken);
    const { data, error } = await client.auth.getUser();
    return { data, error };
  }

  async updateUser(accessToken, updates) {
    const client = this.getClient(accessToken);
    const { data, error } = await client.auth.updateUser(updates);
    return { data, error };
  }

  // Database helpers
  async createProject(userId, projectData) {
    const { data, error } = await this.supabaseAdmin
      .from('projects')
      .insert({
        ...projectData,
        owner_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return { data, error };
  }

  async getProjects(userId) {
    const { data, error } = await this.supabaseAdmin
      .from('projects')
      .select(`
        *,
        deployments (
          id,
          status,
          created_at,
          url,
          commit_sha,
          commit_message
        )
      `)
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });
    
    return { data, error };
  }

  async getProject(projectId, userId) {
    const { data, error } = await this.supabaseAdmin
      .from('projects')
      .select(`
        *,
        deployments (
          *
        )
      `)
      .eq('id', projectId)
      .eq('owner_id', userId)
      .single();
    
    return { data, error };
  }

  async updateProject(projectId, userId, updates) {
    const { data, error } = await this.supabaseAdmin
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .eq('owner_id', userId)
      .select()
      .single();
    
    return { data, error };
  }

  async deleteProject(projectId, userId) {
    const { data, error } = await this.supabaseAdmin
      .from('projects')
      .update({ 
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .eq('owner_id', userId);
    
    return { data, error };
  }

  async createDeployment(deploymentData) {
    const { data, error } = await this.supabaseAdmin
      .from('deployments')
      .insert({
        ...deploymentData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return { data, error };
  }

  async updateDeployment(deploymentId, updates) {
    const { data, error } = await this.supabaseAdmin
      .from('deployments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', deploymentId)
      .select()
      .single();
    
    return { data, error };
  }

  async getDeployments(projectId = null, userId = null, limit = 50) {
    let query = this.supabaseAdmin
      .from('deployments')
      .select(`
        *,
        projects (
          id,
          name,
          slug,
          owner_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (userId) {
      query = query.eq('projects.owner_id', userId);
    }

    const { data, error } = await query;
    return { data, error };
  }

  async getDeployment(deploymentId) {
    const { data, error } = await this.supabaseAdmin
      .from('deployments')
      .select(`
        *,
        projects (
          id,
          name,
          slug,
          owner_id
        )
      `)
      .eq('id', deploymentId)
      .single();
    
    return { data, error };
  }

  // Real-time subscriptions
  subscribeToDeployments(projectId, callback) {
    return this.supabase
      .channel(`deployments:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'deployments',
        filter: `project_id=eq.${projectId}`
      }, callback)
      .subscribe();
  }

  subscribeToProjects(userId, callback) {
    return this.supabase
      .channel(`projects:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `owner_id=eq.${userId}`
      }, callback)
      .subscribe();
  }

  // Storage helpers
  async uploadFile(bucket, path, file, options = {}) {
    const { data, error } = await this.supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, options);
    
    return { data, error };
  }

  async downloadFile(bucket, path) {
    const { data, error } = await this.supabaseAdmin.storage
      .from(bucket)
      .download(path);
    
    return { data, error };
  }

  async deleteFile(bucket, path) {
    const { data, error } = await this.supabaseAdmin.storage
      .from(bucket)
      .remove([path]);
    
    return { data, error };
  }

  async getPublicUrl(bucket, path) {
    const { data } = this.supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }
}

module.exports = new SupabaseService();