const express = require('express');
const SupabaseService = require('../services/supabase');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt:', { email: req.body.email, name: req.body.name });
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    console.log('Attempting Supabase signup...');
    // Sign up with Supabase Auth
    const { data, error } = await SupabaseService.signUp(email, password, { name });

    if (error) {
      console.error('Supabase signup error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Supabase signup successful:', data.user?.id);

    // Create user profile in our users table
    if (data.user) {
      console.log('Creating user profile...');
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
      } else {
        console.log('User profile created successfully');
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
    console.log('Login attempt:', { email: req.body.email });
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('Attempting Supabase signin...');
    // Sign in with Supabase Auth
    const { data, error } = await SupabaseService.signIn(email, password);

    if (error) {
      console.error('Supabase signin error:', error);
      return res.status(401).json({ error: error.message });
    }

    console.log('Supabase signin successful:', data.user?.id);

    // Get user profile
    const { data: userProfile, error: profileError } = await SupabaseService.getAdminClient()
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Failed to get user profile:', profileError);
    }

    console.log('Sending login response...');
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

// GitHub OAuth - Start authentication
router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.BASE_URL}/api/auth/github/callback`;
  const scope = 'repo,user:email,read:user'; // Added read:user for better email access
  const state = Math.random().toString(36).substring(7);
  
  // Store state in session (in production, use proper session storage)
  req.session = req.session || {};
  req.session.githubState = state;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
  
  res.redirect(githubAuthUrl);
});

// GitHub OAuth - Handle callback
router.get('/github/callback', async (req, res) => {
  try {
    console.log('GitHub OAuth callback received:', req.query);
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('GitHub OAuth error:', error);
      return res.redirect(`${process.env.BASE_URL}?error=oauth_error&message=${encodeURIComponent(error)}`);
    }
    
    if (!code) {
      console.error('No authorization code provided');
      return res.redirect(`${process.env.BASE_URL}?error=no_code&message=Authorization code not provided`);
    }
    
    console.log('Exchanging code for access token...');
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    console.log('Token response:', { ...tokenData, access_token: tokenData.access_token ? '[REDACTED]' : undefined });
    
    if (tokenData.error) {
      console.error('GitHub token error:', tokenData.error_description);
      return res.redirect(`${process.env.BASE_URL}?error=token_error&message=${encodeURIComponent(tokenData.error_description)}`);
    }
    
    if (!tokenData.access_token) {
      console.error('No access token received');
      return res.redirect(`${process.env.BASE_URL}?error=no_token&message=No access token received`);
    }
    
    console.log('Getting user info from GitHub...');
    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${tokenData.access_token}`,
        'User-Agent': 'HostingKE-App',
      },
    });
    
    if (!userResponse.ok) {
      console.error('Failed to get GitHub user info:', userResponse.status);
      return res.redirect(`${process.env.BASE_URL}?error=user_info_error&message=Failed to get user info`);
    }
    
    const githubUser = await userResponse.json();
    console.log('GitHub user:', { id: githubUser.id, login: githubUser.login, email: githubUser.email });
    
    // Get user email with multiple fallback strategies
    let primaryEmail = githubUser.email;
    
    if (!primaryEmail) {
      console.log('No public email, trying to get private emails...');
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'User-Agent': 'HostingKE-App',
        },
      });
      
      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        console.log('Available emails:', emails.map(e => ({ email: e.email, primary: e.primary, verified: e.verified })));
        
        // Try to find primary verified email
        const primaryVerified = emails.find(email => email.primary && email.verified);
        if (primaryVerified) {
          primaryEmail = primaryVerified.email;
        } else {
          // Fallback to any verified email
          const anyVerified = emails.find(email => email.verified);
          if (anyVerified) {
            primaryEmail = anyVerified.email;
          } else {
            // Last resort: use any email
            if (emails.length > 0) {
              primaryEmail = emails[0].email;
            }
          }
        }
      }
    }
    
    // If still no email, use GitHub username as identifier
    if (!primaryEmail) {
      console.log('No email found, using GitHub username as identifier');
      primaryEmail = `${githubUser.login}@github.local`; // Temporary email format
    }
    
    console.log('Using email:', primaryEmail);
    
    // Check if user exists in our system
    console.log('Checking for existing user...');
    let { data: existingUser, error: userError } = await SupabaseService.getAdminClient()
      .from('users')
      .select('*')
      .or(`email.eq.${primaryEmail},git_providers->>username.eq.${githubUser.login}`)
      .single();
    
    if (userError && userError.code !== 'PGRST116') {
      console.error('Error checking existing user:', userError);
      return res.redirect(`${process.env.BASE_URL}?error=database_error&message=Database error`);
    }
    
    // Prepare GitHub provider data
    const githubProvider = {
      provider: 'github',
      access_token: tokenData.access_token,
      username: githubUser.login,
      user_id: githubUser.id,
      avatar_url: githubUser.avatar_url
    };
    
    if (!existingUser) {
      console.log('Creating new user...');
      // Create new user
      const { data: newUser, error: createError } = await SupabaseService.getAdminClient()
        .from('users')
        .insert({
          email: primaryEmail,
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
          git_providers: [githubProvider]
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating user:', createError);
        return res.redirect(`${process.env.BASE_URL}?error=create_user_error&message=Failed to create user`);
      }
      
      existingUser = newUser;
      console.log('New user created:', existingUser.id);
    } else {
      console.log('Updating existing user with GitHub info...');
      // Update existing user with GitHub info
      let gitProviders = existingUser.git_providers || [];
      
      // Remove existing GitHub provider
      gitProviders = gitProviders.filter(p => p.provider !== 'github');
      
      // Add new GitHub provider
      gitProviders.push(githubProvider);
      
      const { error: updateError } = await SupabaseService.getAdminClient()
        .from('users')
        .update({
          git_providers: gitProviders,
          avatar: githubUser.avatar_url,
        })
        .eq('id', existingUser.id);
      
      if (updateError) {
        console.error('Error updating user:', updateError);
        return res.redirect(`${process.env.BASE_URL}?error=update_user_error&message=Failed to update user`);
      }
      
      console.log('User updated with GitHub info');
    }
    
    // Create session token (simplified - in production use proper JWT)
    const sessionToken = Buffer.from(JSON.stringify({
      userId: existingUser.id,
      email: existingUser.email,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    })).toString('base64');
    
    console.log('Redirecting to frontend with success...');
    // Redirect to frontend with token
    res.redirect(`${process.env.BASE_URL}?token=${sessionToken}&github=connected&success=true`);
    
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect(`${process.env.BASE_URL}?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

// Get user's GitHub repositories
router.get('/github/repos', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!accessToken) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Get user from our database
    const { data: authData, error: authError } = await SupabaseService.getUser(accessToken);

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile to get GitHub access token
    const { data: userProfile, error: profileError } = await SupabaseService.getAdminClient()
      .from('users')
      .select('git_providers')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Find GitHub provider
    const githubProvider = userProfile.git_providers?.find(p => p.provider === 'github');
    
    if (!githubProvider || !githubProvider.access_token) {
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    // Fetch repositories from GitHub
    const reposResponse = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `token ${githubProvider.access_token}`,
        'User-Agent': 'HostingKE-App',
      },
    });

    if (!reposResponse.ok) {
      return res.status(400).json({ error: 'Failed to fetch repositories' });
    }

    const repos = await reposResponse.json();
    
    // Filter and format repositories
    const formattedRepos = repos
      .filter(repo => !repo.fork) // Exclude forks
      .map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        language: repo.language,
        updated_at: repo.updated_at,
        private: repo.private,
      }));

    res.json({ repositories: formattedRepos });
  } catch (error) {
    console.error('GitHub repos error:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

module.exports = router;