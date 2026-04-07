# FraudShield Deployment Guide

## 🚀 Deployment Options

### 1. Render (Recommended - Free Tier Available)
**Best for:** WebSocket support, easy setup, persistent database

**Steps:**
1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** fraudshield
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Add environment variables:
   - `JWT_SECRET`: Generate a random secret
   - `NODE_ENV`: production
6. Click "Create Web Service"

**URL:** `https://your-app-name.onrender.com`

---

### 2. Railway
**Best for:** Fast deployment, good WebSocket support

**Steps:**
1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your repository
4. Railway auto-detects Node.js settings
5. Add environment variables in dashboard
6. Deploy automatically

**URL:** `https://your-project-name.up.railway.app`

---

### 3. Vercel
**Best for:** Global CDN, fast deployments

**Steps:**
1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "New Project" → Import Git Repository
3. Connect your GitHub repo
4. Vercel detects the `vercel.json` config
5. Add environment variables in dashboard
6. Deploy

**URL:** `https://your-project-name.vercel.app`

---

### 4. Docker Deployment
**Best for:** Containerized deployment, any cloud provider

**Build & Run:**
```bash
# Build Docker image
docker build -t fraudshield .

# Run locally
docker run -p 3000:3000 fraudshield

# For production, deploy to:
# - AWS ECS/Fargate
# - Google Cloud Run
# - Azure Container Instances
# - DigitalOcean App Platform
```

---

## 🔧 Environment Variables Required

Add these to your deployment platform:

```env
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=production
PORT=3000
```

---

## 📊 Database

The app uses SQLite (`fraudshield.db`) which will be created automatically on first run. For production, consider:

- **SQLite:** Fine for single-instance deployments
- **PostgreSQL:** For multi-instance/scaling
- **MongoDB:** Alternative NoSQL option

---

## 🌐 WebSocket Support

This app requires WebSocket support for real-time features. All recommended platforms support WebSockets:

- ✅ Render
- ✅ Railway
- ✅ Vercel (with limitations)
- ✅ Docker on any cloud

---

## 🔒 Security Considerations

1. **Change default credentials** after deployment
2. **Use strong JWT_SECRET** (generate randomly)
3. **Enable HTTPS** (automatic on most platforms)
4. **Set up proper CORS** if needed
5. **Monitor logs** for suspicious activity

---

## 📈 Scaling

For high-traffic deployments:

1. **Database:** Migrate to PostgreSQL
2. **Caching:** Add Redis for session storage
3. **Load Balancing:** Use multiple instances
4. **CDN:** Serve static assets via CDN

---

## 🧪 Testing Deployment

After deployment, test:

1. **Login:** Use admin/admin123
2. **Dashboard:** Check real-time updates
3. **WebSocket:** Verify live transaction feed
4. **Database:** Check if data persists
5. **Alerts:** Test notification system

---

## 💡 Quick Deploy Commands

```bash
# For Render (if using CLI)
npm install -g @render/cli
render deploy

# For Railway
npm install -g @railway/cli
railway login
railway deploy

# For Vercel
npm install -g vercel
vercel --prod
```

Choose your preferred platform and deploy! 🚀