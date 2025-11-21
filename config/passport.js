const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

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
        avatar: profile.photos[0].value,
        provider: 'google'
      });

      await user.save();
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
} else {
  console.log('Google OAuth not configured - skipping Google strategy initialization');
}

// Facebook OAuth Strategy - only initialize if credentials are provided
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your-facebook-app-id-here') {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/api/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'email', 'photos']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this Facebook ID
      let user = await User.findOne({ facebookId: profile.id });

      if (user) {
        return done(null, user);
      }

      // Check if user exists with same email
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (email) {
        user = await User.findOne({ email });

        if (user) {
          // Link Facebook account to existing user
          user.facebookId = profile.id;
          await user.save();
          return done(null, user);
        }
      }

      // Create new user
      user = new User({
        facebookId: profile.id,
        name: profile.displayName,
        email: email,
        avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        provider: 'facebook'
      });

      await user.save();
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
} else {
  console.log('Facebook OAuth not configured - skipping Facebook strategy initialization');
}

module.exports = passport;