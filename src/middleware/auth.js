const SupabaseService = require('../services/supabase');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token with Supabase
    const { data, error } = await SupabaseService.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile from our users table
    const { data: userProfile, error: profileError } = await SupabaseService.getAdminClient()
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    // Attach user info to request
    req.user = {
      id: data.user.id,
      email: data.user.email,
      ...userProfile
    };
    
    req.accessToken = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;