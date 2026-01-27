const express = require('express');
const Project = require('../models/Project');
const CDNService = require('../services/cdn');

const router = express.Router();

// Get analytics for a project
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { timeRange = '24h', metric = 'overview' } = req.query;

    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let analytics;

    switch (metric) {
      case 'overview':
        analytics = await getOverviewAnalytics(projectId, timeRange);
        break;
      case 'traffic':
        analytics = await getTrafficAnalytics(projectId, timeRange);
        break;
      case 'performance':
        analytics = await getPerformanceAnalytics(projectId, timeRange);
        break;
      case 'geography':
        analytics = await getGeographyAnalytics(projectId, timeRange);
        break;
      case 'referrers':
        analytics = await getReferrerAnalytics(projectId, timeRange);
        break;
      default:
        return res.status(400).json({ error: 'Invalid metric type' });
    }

    res.json(analytics);

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get real-time analytics
router.get('/:projectId/realtime', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Mock real-time data
    const realtimeData = {
      activeVisitors: Math.floor(Math.random() * 100),
      pageViews: Math.floor(Math.random() * 500),
      topPages: [
        { path: '/', visitors: Math.floor(Math.random() * 50) },
        { path: '/about', visitors: Math.floor(Math.random() * 20) },
        { path: '/contact', visitors: Math.floor(Math.random() * 10) }
      ],
      topCountries: [
        { country: 'US', visitors: Math.floor(Math.random() * 30) },
        { country: 'UK', visitors: Math.floor(Math.random() * 15) },
        { country: 'CA', visitors: Math.floor(Math.random() * 10) }
      ],
      trafficSources: [
        { source: 'Direct', visitors: Math.floor(Math.random() * 25) },
        { source: 'Google', visitors: Math.floor(Math.random() * 20) },
        { source: 'Social', visitors: Math.floor(Math.random() * 15) }
      ]
    };

    res.json(realtimeData);

  } catch (error) {
    console.error('Get realtime analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch realtime analytics' });
  }
});

// Get bandwidth usage
router.get('/:projectId/bandwidth', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { timeRange = '30d' } = req.query;

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const bandwidthData = await getBandwidthAnalytics(projectId, timeRange);
    res.json(bandwidthData);

  } catch (error) {
    console.error('Get bandwidth analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch bandwidth analytics' });
  }
});

// Analytics helper functions

async function getOverviewAnalytics(projectId, timeRange) {
  // Mock data - in real implementation, query from analytics database
  const baseMultiplier = getTimeRangeMultiplier(timeRange);
  
  return {
    pageViews: Math.floor(Math.random() * 10000 * baseMultiplier),
    uniqueVisitors: Math.floor(Math.random() * 5000 * baseMultiplier),
    bounceRate: 0.3 + Math.random() * 0.4, // 30-70%
    averageSessionDuration: 120 + Math.random() * 300, // 2-7 minutes
    topPages: [
      { path: '/', views: Math.floor(Math.random() * 3000 * baseMultiplier) },
      { path: '/about', views: Math.floor(Math.random() * 1000 * baseMultiplier) },
      { path: '/contact', views: Math.floor(Math.random() * 500 * baseMultiplier) },
      { path: '/blog', views: Math.floor(Math.random() * 800 * baseMultiplier) }
    ],
    dailyStats: generateDailyStats(timeRange),
    conversionRate: 0.02 + Math.random() * 0.08 // 2-10%
  };
}

async function getTrafficAnalytics(projectId, timeRange) {
  const baseMultiplier = getTimeRangeMultiplier(timeRange);
  
  return {
    totalVisits: Math.floor(Math.random() * 8000 * baseMultiplier),
    organicTraffic: Math.floor(Math.random() * 4000 * baseMultiplier),
    directTraffic: Math.floor(Math.random() * 2000 * baseMultiplier),
    referralTraffic: Math.floor(Math.random() * 1500 * baseMultiplier),
    socialTraffic: Math.floor(Math.random() * 500 * baseMultiplier),
    sources: [
      { source: 'Google', visits: Math.floor(Math.random() * 3000 * baseMultiplier), percentage: 35 },
      { source: 'Direct', visits: Math.floor(Math.random() * 2000 * baseMultiplier), percentage: 25 },
      { source: 'Facebook', visits: Math.floor(Math.random() * 800 * baseMultiplier), percentage: 10 },
      { source: 'Twitter', visits: Math.floor(Math.random() * 600 * baseMultiplier), percentage: 8 },
      { source: 'LinkedIn', visits: Math.floor(Math.random() * 400 * baseMultiplier), percentage: 5 }
    ],
    hourlyDistribution: generateHourlyDistribution()
  };
}

async function getPerformanceAnalytics(projectId, timeRange) {
  return {
    averageLoadTime: 1.2 + Math.random() * 2, // 1.2-3.2 seconds
    lighthouseScores: {
      performance: 85 + Math.random() * 10,
      accessibility: 90 + Math.random() * 8,
      bestPractices: 88 + Math.random() * 10,
      seo: 92 + Math.random() * 6
    },
    coreWebVitals: {
      lcp: 1.5 + Math.random() * 1, // Largest Contentful Paint
      fid: 50 + Math.random() * 50, // First Input Delay (ms)
      cls: 0.05 + Math.random() * 0.1 // Cumulative Layout Shift
    },
    pageSpeedTrends: generatePageSpeedTrends(timeRange),
    slowestPages: [
      { path: '/heavy-page', loadTime: 3.2 },
      { path: '/image-gallery', loadTime: 2.8 },
      { path: '/dashboard', loadTime: 2.5 }
    ]
  };
}

async function getGeographyAnalytics(projectId, timeRange) {
  const baseMultiplier = getTimeRangeMultiplier(timeRange);
  
  return {
    countries: [
      { country: 'United States', code: 'US', visits: Math.floor(Math.random() * 2000 * baseMultiplier) },
      { country: 'United Kingdom', code: 'GB', visits: Math.floor(Math.random() * 800 * baseMultiplier) },
      { country: 'Canada', code: 'CA', visits: Math.floor(Math.random() * 600 * baseMultiplier) },
      { country: 'Germany', code: 'DE', visits: Math.floor(Math.random() * 500 * baseMultiplier) },
      { country: 'France', code: 'FR', visits: Math.floor(Math.random() * 400 * baseMultiplier) }
    ],
    cities: [
      { city: 'New York', country: 'US', visits: Math.floor(Math.random() * 500 * baseMultiplier) },
      { city: 'London', country: 'GB', visits: Math.floor(Math.random() * 400 * baseMultiplier) },
      { city: 'Toronto', country: 'CA', visits: Math.floor(Math.random() * 300 * baseMultiplier) },
      { city: 'Berlin', country: 'DE', visits: Math.floor(Math.random() * 250 * baseMultiplier) }
    ],
    languages: [
      { language: 'English', code: 'en', percentage: 65 },
      { language: 'Spanish', code: 'es', percentage: 12 },
      { language: 'French', code: 'fr', percentage: 8 },
      { language: 'German', code: 'de', percentage: 7 }
    ]
  };
}

async function getReferrerAnalytics(projectId, timeRange) {
  const baseMultiplier = getTimeRangeMultiplier(timeRange);
  
  return {
    topReferrers: [
      { domain: 'google.com', visits: Math.floor(Math.random() * 2000 * baseMultiplier) },
      { domain: 'facebook.com', visits: Math.floor(Math.random() * 800 * baseMultiplier) },
      { domain: 'twitter.com', visits: Math.floor(Math.random() * 600 * baseMultiplier) },
      { domain: 'linkedin.com', visits: Math.floor(Math.random() * 400 * baseMultiplier) },
      { domain: 'reddit.com', visits: Math.floor(Math.random() * 300 * baseMultiplier) }
    ],
    searchKeywords: [
      { keyword: 'web hosting', visits: Math.floor(Math.random() * 500 * baseMultiplier) },
      { keyword: 'static site hosting', visits: Math.floor(Math.random() * 300 * baseMultiplier) },
      { keyword: 'jamstack hosting', visits: Math.floor(Math.random() * 200 * baseMultiplier) },
      { keyword: 'netlify alternative', visits: Math.floor(Math.random() * 150 * baseMultiplier) }
    ],
    socialMedia: [
      { platform: 'Facebook', visits: Math.floor(Math.random() * 800 * baseMultiplier) },
      { platform: 'Twitter', visits: Math.floor(Math.random() * 600 * baseMultiplier) },
      { platform: 'LinkedIn', visits: Math.floor(Math.random() * 400 * baseMultiplier) },
      { platform: 'Instagram', visits: Math.floor(Math.random() * 200 * baseMultiplier) }
    ]
  };
}

async function getBandwidthAnalytics(projectId, timeRange) {
  const baseMultiplier = getTimeRangeMultiplier(timeRange);
  
  return {
    totalBandwidth: Math.floor(Math.random() * 10000000000 * baseMultiplier), // bytes
    dailyBandwidth: generateDailyBandwidth(timeRange),
    topFiles: [
      { file: '/images/hero.jpg', bandwidth: Math.floor(Math.random() * 500000000) },
      { file: '/js/main.js', bandwidth: Math.floor(Math.random() * 200000000) },
      { file: '/css/styles.css', bandwidth: Math.floor(Math.random() * 100000000) }
    ],
    cacheHitRatio: 0.8 + Math.random() * 0.15, // 80-95%
    edgeLocations: [
      { location: 'US East', bandwidth: Math.floor(Math.random() * 3000000000) },
      { location: 'US West', bandwidth: Math.floor(Math.random() * 2500000000) },
      { location: 'EU West', bandwidth: Math.floor(Math.random() * 2000000000) },
      { location: 'Asia Pacific', bandwidth: Math.floor(Math.random() * 1500000000) }
    ]
  };
}

// Helper functions

function getTimeRangeMultiplier(timeRange) {
  switch (timeRange) {
    case '1h': return 0.1;
    case '24h': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 1;
  }
}

function generateDailyStats(timeRange) {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 7;
  const stats = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    stats.push({
      date: date.toISOString().split('T')[0],
      views: Math.floor(Math.random() * 1000),
      visitors: Math.floor(Math.random() * 500)
    });
  }
  
  return stats;
}

function generateHourlyDistribution() {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push({
      hour: i,
      visits: Math.floor(Math.random() * 200)
    });
  }
  return hours;
}

function generatePageSpeedTrends(timeRange) {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 7;
  const trends = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    trends.push({
      date: date.toISOString().split('T')[0],
      loadTime: 1.5 + Math.random() * 1
    });
  }
  
  return trends;
}

function generateDailyBandwidth(timeRange) {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 7;
  const bandwidth = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    bandwidth.push({
      date: date.toISOString().split('T')[0],
      bytes: Math.floor(Math.random() * 1000000000)
    });
  }
  
  return bandwidth;
}

module.exports = router;