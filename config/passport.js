const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const syncPendingInvitationNotifications = require('../utils/syncPendingInvitationNotifications');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy - only initialize if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id-here') {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this Google ID
      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        return done(null, user);
      }

      // Check if user exists with same email
      user = await User.findOne({ email: profile.emails[0].value });

      if (user) {
        // Link Google account to existing user
        user.googleId = profile.id;
        await user.save();
        return done(null, user);
      }

      // Create new user
      user = new User({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        provider: 'google'
      });

      await user.save();
      await syncPendingInvitationNotifications(user);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
}

// GitHub OAuth Strategy - only initialize if credentials are provided
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'your-github-client-id-here') {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Extract email or fetch from GitHub API directly
      let email = profile.emails && profile.emails[0] ? profile.emails[0].value : profile.email;

      if (!email && accessToken) {
        try {
          const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              'Authorization': `token ${accessToken}`,
              'User-Agent': 'offtix-auth'
            }
          });
          if (emailResponse.ok) {
            const emails = await emailResponse.json();
            const primaryEmail = emails.find(e => e.primary) || emails[0];
            if (primaryEmail) {
              email = primaryEmail.email;
            }
          }
        } catch (fetchError) {
          console.error('Error fetching emails from GitHub API:', fetchError);
        }
      }

      if (!email) {
        email = `${profile.username || profile.id}@github.com`;
      }

      email = email.toLowerCase();

      // Check if user already exists with this GitHub ID
      let user = await User.findOne({ githubId: profile.id });

      if (user) {
        // If user already exists but has a fallback email, update it with their real email if we now have it
        if (user.email.endsWith('@github.com') && !email.endsWith('@github.com')) {
          const emailConflict = await User.findOne({ email });
          if (!emailConflict) {
            user.email = email;
            await user.save();
          }
        }
        return done(null, user);
      }

      // Check if user exists with same email
      user = await User.findOne({ email });

      if (user) {
        // Link GitHub account to existing user
        user.githubId = profile.id;
        if (!user.avatar && profile.photos && profile.photos[0]) {
          user.avatar = profile.photos[0].value;
        }
        await user.save();
        return done(null, user);
      }

      // Create new user
      user = new User({
        githubId: profile.id,
        name: profile.displayName || profile.username || 'GitHub User',
        email: email,
        avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        provider: 'github'
      });

      await user.save();
      await syncPendingInvitationNotifications(user);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
}

module.exports = passport;