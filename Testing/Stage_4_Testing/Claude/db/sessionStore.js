// db/sessionStore.js — File-based session store (no native dependencies)
// Sessions are written to db/data/sessions.json so they survive server restarts.

const session = require('express-session');
const fs = require('fs');
const path = require('path');

const Store = session.Store;

class JsonSessionStore extends Store {
  constructor(options = {}) {
    super();
    this.filePath = options.filePath || path.join(__dirname, 'data', 'sessions.json');
  }

  _load() {
    if (!fs.existsSync(this.filePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      return {};
    }
  }

  _save(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  _isExpired(sess) {
    if (!sess || !sess.cookie) return false;
    const expires = sess.cookie.expires;
    if (!expires) return false;
    return new Date(expires).getTime() < Date.now();
  }

  get(sid, callback) {
    try {
      const sessions = this._load();
      const sess = sessions[sid];
      if (!sess) return callback(null, null);
      if (this._isExpired(sess)) {
        delete sessions[sid];
        this._save(sessions);
        return callback(null, null);
      }
      callback(null, sess);
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const sessions = this._load();
      sessions[sid] = sess;
      this._save(sessions);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      const sessions = this._load();
      delete sessions[sid];
      this._save(sessions);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  all(callback) {
    try {
      const sessions = this._load();
      callback(null, Object.values(sessions));
    } catch (err) {
      callback(err);
    }
  }

  length(callback) {
    try {
      callback(null, Object.keys(this._load()).length);
    } catch (err) {
      callback(err);
    }
  }

  clear(callback) {
    try {
      this._save({});
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

module.exports = JsonSessionStore;
