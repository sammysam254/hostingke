const SupabaseService = require('../services/supabase');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    let userId = null;
    let userEmail = null;
    
    // Try to decode as custom session token first
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      if (decoded.userId && decoded.exp && decoded.exp > Date.now()) {
        userId = decoded.userId;
        userEmail = decoded.email;
        console.log('Using custom session token for user:', userId);
      }
    } catch (e) {
      // Not a custom token, try Supabase Auth
      console.log('Not a custom token, trying Supabase Auth...');
    }
    
    // If not a custom token, try Supabase Auth
    if (!userId) {
      const { data, error } = await SupabaseService.getUser(token);
      
      if (error || !data.user) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      userId = data.user.id;
      userEmail = data.user.email;
      console.log('Using Supabase Auth token for user:', userId);
    }

    // Get user profile from our users table
    const { data: userProfile, error: profileError } = await SupabaseService.getAdminClient()
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('User profile not found:', profileError);
      return res.status(401).json({ error: 'User profile not found' });
    }

    // Attach user info to request
    req.user = {
      id: userId,
      email: userEmail,
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