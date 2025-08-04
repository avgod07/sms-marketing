# SMS Marketing App

A comprehensive SMS marketing platform built with Node.js, React, and PostgreSQL.

## Features

- 📱 SMS Campaign Management
- 👥 Contact Management
- 📊 Analytics & Reporting
- 💳 Subscription Management
- 🔐 Secure Authentication
- 🎨 Modern UI/UX

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker (optional)

### Development

```bash
# Install dependencies
npm install

# Set up environment
cp env.production.example .env.local

# Start development server
npm run dev
```

### Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Feature Flags

### Message Retry Control

The application includes a feature flag to control automatic message retry behavior:

```bash
# Disable retries (recommended for cost control)
ENABLE_MESSAGE_RETRIES=false

# Enable retries (3 attempts with 15-minute delays)
ENABLE_MESSAGE_RETRIES=true
```

**Default behavior**: When `ENABLE_MESSAGE_RETRIES` is not set or set to `false`, failed messages are marked as failed immediately instead of being retried. This provides better cost control and predictable behavior.

**User Experience**: The feature flag does not affect the user interface - users still see identical success/failure statuses and campaign statistics.

## Database Connection Pooling

The application uses a production-optimized database connection pool to ensure stability and scalability.

### Configuration

Connection pool settings can be configured via environment variables:

```bash
# Database Connection Pool Settings (Optional - uses safe defaults if not set)
DB_POOL_MAX=20          # Maximum number of connections (default: 20)
DB_POOL_MIN=2           # Minimum number of connections (default: 2)
DB_POOL_IDLE=10000      # Idle timeout in milliseconds (default: 10000)
DB_POOL_ACQUIRE=60000   # Connection acquisition timeout (default: 60000)
DB_CONNECTION_TIMEOUT=10000   # Connection timeout (default: 10000)
DB_IDLE_TIMEOUT=30000   # Idle connection timeout (default: 30000)
DB_STATEMENT_TIMEOUT=30000    # Query timeout (default: 30000)
```

### Default Settings

The pool is configured with production-safe defaults:

- **Max Connections**: 20 (prevents overwhelming the database)
- **Min Connections**: 2 (maintains warm connections)
- **Idle Timeout**: 10 seconds (releases unused connections)
- **Connection Timeout**: 10 seconds (fails fast on connection issues)
- **Statement Timeout**: 30 seconds (prevents long-running queries)
- **SSL**: Enabled in production (secure connections)

### Monitoring

The application includes comprehensive connection pool monitoring:

- **Connection Events**: Logged when connections are established, acquired, or removed
- **Error Handling**: All pool errors are logged with detailed information
- **Health Checks**: Database health is included in the `/api/health` endpoint
- **Graceful Shutdown**: Properly closes connections on application termination

### Health Endpoint

The enhanced health endpoint (`/api/health`) now includes database status:

```json
{
  "status": "ok",
  "database": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Performance Tuning

For high-traffic applications, consider adjusting these settings:

```bash
# For high concurrency (100+ concurrent users)
DB_POOL_MAX=50
DB_POOL_MIN=5

# For low-latency requirements
DB_CONNECTION_TIMEOUT=5000
DB_STATEMENT_TIMEOUT=15000

# For long-running queries
DB_STATEMENT_TIMEOUT=60000
```

### Troubleshooting

**Connection Exhaustion**: If you see "connection pool exhausted" errors:

- Increase `DB_POOL_MAX`
- Check for connection leaks in your code
- Monitor connection usage in logs

**Slow Queries**: If queries are timing out:

- Increase `DB_STATEMENT_TIMEOUT`
- Optimize slow queries
- Add database indexes

**Connection Timeouts**: If connections are failing:

- Check database availability
- Verify network connectivity
- Increase `DB_CONNECTION_TIMEOUT`

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete deployment instructions.

## License

MIT License - see [LICENSE](./LICENSE) for details.
