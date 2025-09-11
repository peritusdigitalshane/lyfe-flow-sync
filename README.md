# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/74583761-ea55-4459-9556-1f0b360c2bab

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/74583761-ea55-4459-9556-1f0b360c2bab) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### Method 1: Deploy via Lovable (Easiest)

Simply open [Lovable](https://lovable.dev/projects/74583761-ea55-4459-9556-1f0b360c2bab) and click on Share -> Publish.

### Method 2: Docker Deployment (Self-hosted)

This project includes Docker configuration for self-hosted deployment.

#### Prerequisites

- Docker and Docker Compose installed
- Git (to clone the repository)
- nginx proxy manager (optional, for custom domains and SSL)

#### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. **Build and run with Docker Compose**
   ```bash
   # Production deployment
   docker-compose up -d
   
   # Development with hot reload
   docker-compose --profile dev up app-dev
   ```

3. **Access your application**
   - Production: `http://localhost:8080`
   - Development: `http://localhost:5173`

#### Manual Docker Build

```bash
# Build the Docker image
docker build -t my-email-app .

# Run the container
docker run -d -p 8080:80 --name email-app my-email-app
```

#### nginx proxy manager Setup

If you're using nginx proxy manager for reverse proxy and SSL:

1. **Configure Proxy Host in nginx proxy manager:**
   - Domain Name: `your-domain.com`
   - Forward Hostname/IP: `localhost` (or container IP)
   - Forward Port: `8080`
   - Enable SSL if desired

2. **Network Configuration:**
   - Ensure both nginx proxy manager and your app are on the same Docker network
   - The app is configured to work behind a reverse proxy

#### Production Environment Variables

The application uses Supabase for backend services. Key environment variables are embedded in the build:

- `VITE_SUPABASE_PROJECT_ID`: Supabase project ID
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase anon/public key  
- `VITE_SUPABASE_URL`: Supabase project URL

#### Supabase Edge Functions

This project includes Supabase Edge Functions that are deployed automatically:

- `create-checkout`: Handles Stripe payment processing
- `check-subscription`: Validates user subscription status
- `customer-portal`: Manages Stripe customer portal access
- Additional email processing functions

**Required Secrets (configured in Supabase Dashboard):**
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `MICROSOFT_CLIENT_SECRET`: Microsoft Graph API client secret
- Other service-specific secrets

#### Health Checks and Monitoring

The Docker setup includes:
- Nginx health checks
- Proper signal handling
- Log rotation
- Security headers
- Gzip compression

#### Scaling and Performance

For production deployments:
- Use a reverse proxy (nginx proxy manager, Cloudflare, etc.)
- Enable SSL/TLS termination at the proxy level  
- Consider using Docker Swarm or Kubernetes for container orchestration
- Monitor container resources and scale as needed

#### Troubleshooting

**Common issues:**

1. **Port conflicts:** Change the port mapping in `docker-compose.yml`
2. **Build failures:** Ensure Docker has sufficient resources allocated
3. **Network issues:** Verify firewall settings and Docker network configuration
4. **Supabase connectivity:** Check environment variables and network connectivity

**View logs:**
```bash
# View application logs
docker-compose logs app

# Follow logs in real-time  
docker-compose logs -f app
```

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
