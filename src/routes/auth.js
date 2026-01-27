const express = require('express');
const SupabaseService = require('../services/supabase');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Sign up with Supabase Auth
    const { data, error } = await SupabaseService.signUp(email, password, { name });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Create user profile in our users table
    if (data.user) {
      const { data: userData, error: userError } = await SupabaseService.getAdminClient()
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email,
          name
        })
        .select()
        .single();

      if (userError) {
        console.error('Failed to create user profile:', userError);
      }
    }

    res.status(201).json({
      message: 'User created successfully. Please check your email to verify your account.',
      user: data.user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sign in with Supabase Auth
    const { data, error } = await SupabaseService.signIn(email, password);

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await SupabaseService.getAdminClient()
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Failed to get user profile:', profileError);
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userProfile?.name || data.user.user_metadata?.name,
        plan: userProfile?.plan || 'free',
        usage: {
          bandwidth_used: userProfile?.bandwidth_used || 0,
          build_minutes_used: userProfile?.build_minutes_used || 0,
          sites_count: userProfile?.sites_count || 0
        },
        limits: {
          bandwidth_limit: userProfile?.bandwidth_limit || 107374182400,
          build_minutes_limit: userProfile?.build_minutes_limit || 300,
          sites_limit: userProfile?.sites_limit || 10
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (accessToken) {
      const { error } = await SupabaseService.signOut(accessToken);
      if (error) {
        console.error('Logout error:', error);
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!accessToken) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Get user from Supabase Auth
    const { data: authData, error: authError } = await SupabaseService.getUser(accessToken);

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await SupabaseService.getAdminClient()
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json(userProfile);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    const { name, avatar } = req.body;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Get user from Supabase Auth
    const { data: authData, error: authError } = await SupabaseService.getUser(accessToken);

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Update user profile
    const { data: updatedProfile, error: updateError } = await SupabaseService.getAdminClient()
      .from('users')
      .update({ name, avatar })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json(updatedProfile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Connect Git provider
router.post('/connect-git', async (req, res) => {
  try {
    const { provider, accessToken, username } = req.body;
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!authToken) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Get user from Supabase Auth
    const { data: authData, error: authError } = await SupabaseService.getUser(authToken);

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get current user profile
    const { data: userProfile, error: profileError } = await SupabaseService.getAdminClient()
      .from('users')
      .select('git_providers')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update git providers
    let gitProviders = userProfile.git_providers || [];
    
    // Remove existing provider connection
    gitProviders = gitProviders.filter(p => p.provider !== provider);
    
    // Add new connection
    gitProviders.push({
      provider,
      access_token: accessToken,
      username
    });

    // Update user profile
    const { error: updateError } = await SupabaseService.getAdminClient()
      .from('users')
      .update({ git_providers: gitProviders })
      .eq('id', authData.user.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to connect Git provider' });
    }

    res.json({ message: 'Git provider connected successfully' });
  } catch (error) {
    console.error('Git connection error:', error);
    res.status(500).json({ error: 'Failed to connect Git provider' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { data, error } = await SupabaseService.supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

module.exports = router;