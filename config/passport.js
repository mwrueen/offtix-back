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
    callbackURL: process.env.NODE_ENV === 'production'
      ? "https://offtix.com/api/auth/google/callback"
      : "http://localhost:5000/api/auth/google/callback",
    proxy: true
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this Google ID
      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        if (profile.photos && profile.photos[0]) {
          const photoUrl = profile.photos[0].value;
          let changed = false;
          if (!user.avatar) {
            user.avatar = photoUrl;
            changed = true;
          }
          if (!user.profile) {
            user.profile = {};
          }
          if (!user.profile.profilePicture) {
            user.profile.profilePicture = photoUrl;
            changed = true;
          }
          if (changed) {
            await user.save();
          }
        }
        return done(null, user);
      }

      // Check if user exists with same email
      user = await User.findOne({ email: profile.emails[0].value });

      if (user) {
        // Link Google account to existing user
        user.googleId = profile.id;
        if (profile.photos && profile.photos[0]) {
          const photoUrl = profile.photos[0].value;
          if (!user.avatar) {
            user.avatar = photoUrl;
          }
          if (!user.profile) {
            user.profile = {};
          }
          if (!user.profile.profilePicture) {
            user.profile.profilePicture = photoUrl;
          }
        }
        await user.save();
        return done(null, user);
      }

      // Create new user
      const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
      user = new User({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        avatar: avatarUrl,
        provider: 'google',
        profile: {
          profilePicture: avatarUrl
        }
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
    callbackURL: process.env.NODE_ENV === 'production'
      ? "https://offtix.com/api/auth/github/callback"
      : "http://localhost:5000/api/auth/github/callback",
    proxy: true
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
        let changed = false;
        // If user already exists but has a fallback email, update it with their real email if we now have it
        if (user.email.endsWith('@github.com') && !email.endsWith('@github.com')) {
          const emailConflict = await User.findOne({ email });
          if (!emailConflict) {
            user.email = email;
            changed = true;
          }
        }

        // Sync profile pictures for existing GitHub user
        if (profile.photos && profile.photos[0]) {
          const photoUrl = profile.photos[0].value;
          if (!user.avatar) {
            user.avatar = photoUrl;
            changed = true;
          }
          if (!user.profile) {
            user.profile = {};
          }
          if (!user.profile.profilePicture) {
            user.profile.profilePicture = photoUrl;
            changed = true;
          }
        }

        if (changed) {
          await user.save();
        }
        return done(null, user);
      }

      // Check if user exists with same email
      user = await User.findOne({ email });

      if (user) {
        // Link GitHub account to existing user
        user.githubId = profile.id;
        if (profile.photos && profile.photos[0]) {
          const photoUrl = profile.photos[0].value;
          if (!user.avatar) {
            user.avatar = photoUrl;
          }
          if (!user.profile) {
            user.profile = {};
          }
          if (!user.profile.profilePicture) {
            user.profile.profilePicture = photoUrl;
          }
        }
        await user.save();
        return done(null, user);
      }

      // Create new user
      const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
      user = new User({
        githubId: profile.id,
        name: profile.displayName || profile.username || 'GitHub User',
        email: email,
        avatar: avatarUrl,
        provider: 'github',
        profile: {
          profilePicture: avatarUrl
        }
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