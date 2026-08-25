# Daraz Operations Platform

A comprehensive ERP solution for managing Daraz store operations, including inventory, orders, synchronization, and analytics.

## Overview

This platform integrates with the Daraz Open Platform API to provide seamless synchronization of products, orders, inventory, and fulfillment operations. It features robust error handling, rate limiting, token management, and observability to ensure reliable operation in production environments.

## Key Features

- **Daraz API Integration**: Full support for product catalog, order management, inventory updates, and fulfillment operations
- **Real-time Synchronization**: Bidirectional sync between Daraz stores and local database
- **Webhook Processing**: Secure handling of Daraz push notifications for order status updates
- **Barcode Scanning**: Efficient product and order lookup via barcode scanning with caching
- **Rate Limiting**: Endpoint-specific rate limiting to comply with Daraz API limits
- **Token Management**: Secure OAuth token handling with automatic refresh and race condition prevention
- **Observability**: Comprehensive logging, audit trails, and diagnostic capabilities
- **Conflict Resolution**: Mechanisms to handle data conflicts between multiple stores and systems

## Architecture

- **Frontend**: Next.js 14 with React 18 (App Router)
- **Backend**: Node.js/TypeScript with Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with custom Daraz OAuth integration
- **API Layer**: RESTful endpoints with proper validation and error handling
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account and project
- Daraz Developer Account with API credentials
- Environment variables configured (see `.env.example`)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```
4. Run database migrations:
   ```bash
   npx supabase db push
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

### Environment Variables

Required environment variables include:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DARAZ_APP_KEY`
- `DARAZ_APP_SECRET`
- `NEXT_PUBLIC_APP_URL`

## API Endpoints

### Authentication
- `POST /api/auth/daraz/login` - Initiate Daraz OAuth flow
- `GET /api/auth/daraz/callback` - Handle Daraz OAuth callback
- `POST /api/auth/logout` - Logout user

### Store Management
- `GET /api/daraz/stores` - List connected stores
- `POST /api/daraz/stores/[id]/sync` - Trigger manual sync
- `POST /api/daraz/stores/[id]/sync/stock` - Sync stock only
- `POST /api/daraz/stores/[id]/sync/orders` - Sync orders only
- `POST /api/daraz/stores/[id]/disconnect` - Disconnect store

### Inventory & Scanning
- `POST /api/inventory/scan` - Scan barcode for product/order lookup
- `GET /api/inventory/ledger` - View inventory ledger
- `GET /api/products/[id]` - Get product details

### Orders
- `GET /api/orders` - List orders
- `GET /api/orders/[id]` - Get order details
- `POST /api/orders/[id]/pack` - Mark order as packed
- `POST /api/orders/[id]/label` - Generate shipping label
- `POST /api/orders/[id]/ship` - Mark order as shipped

### Webhooks
- `POST /api/daraz/webhook` - Receive Daraz push notifications

### Admin
- `GET /api/admin/audit-logs` - View system audit logs
- `GET /api/admin/errors` - View system errors
- `GET /api/admin/users` - Manage users

### Health & Monitoring
- `GET /api/health` - Health check endpoint
- `GET /api/dashboard/summary` - Dashboard summary data
- `GET /api/dashboard/stock-mismatch` - Stock mismatch report

## Database Schema

The platform uses Supabase PostgreSQL with the following key tables:

- `daraz_stores` - Connected Daraz store information
- `daraz_store_credentials` - Encrypted API credentials for stores
- `daraz_apps` - Daraz application credentials
- `listings` - Product listings (synced from Daraz)
- `inventory` - Inventory tracking per store
- `daraz_products` - Product catalog from Daraz
- `daraz_product_skus` - SKU details from Daraz
- `orders` - Order headers
- `order_items` - Order line items
- `daraz_sync_settings` - Per-store sync configuration
- `daraz_sync_checkpoints` - Sync resume points
- `daraz_sync_logs` - Detailed API request logs
- `daraz_api_audit` - API call audit trail
- `daraz_webhook_events` - Received webhook events
- `sync_retry_queue` - Failed operations for retry
- `sync_runs` - Sync execution history
- `barcode_mappings` - Barcode to master SKU mappings
- `package_shipments` - Shipment tracking
- `shipping_labels` - Generated shipping labels

## Security

- **Row Level Security (RLS)**: Enforced on all tables for store-level data isolation
- **Credential Encryption**: App secrets and tokens encrypted at rest
- **Input Validation**: All API endpoints validate and sanitize inputs
- **Secure Headers**: Proper security headers applied
- **Audit Logging**: All sensitive operations logged for compliance

## Error Handling

The platform implements comprehensive error handling:
- **API Errors**: Daraz API errors classified and mapped to user-friendly messages
- **Network Errors**: Automatic retries with exponential backoff
- **Token Errors**: Automatic refresh with race condition prevention
- **Database Errors**: Proper transaction handling and constraint validation
- **Validation Errors**: Clear feedback for invalid inputs

## Rate Limiting

To prevent Daraz API bans, the platform implements:
- Endpoint-specific rate limits matching Daraz API policies
- Request queuing and throttling
- Automatic backoff on rate limit responses
- Monitoring and alerting for rate limit approaches

## Observability

- **Structured Logging**: All services emit structured logs with correlation IDs
- **API Audit Trail**: Complete record of all Daraz API calls
- **Sync Monitoring**: Detailed sync progress and failure tracking
- **Performance Metrics**: Operation timing and resource usage
- **Health Checks**: Endpoint for monitoring system health

## Development

### Code Organization

- `/src/app` - Next.js pages and API routes
- `/src/lib` - Shared libraries and utilities
- `/src/components` - Reusable React components
- `/supabase/migrations` - Database schema migrations
- `/public` - Static assets

### Testing

Run tests with:
```bash
npm test
```

### Linting

Check code quality with:
```bash
npm run lint
```

### Type Checking

Validate TypeScript types with:
```bash
npm run type-check
```

## Deployment

The platform can be deployed to various platforms including:
- Vercel (recommended for Next.js)
- Docker containers
- Traditional Node.js hosting

Refer to deployment guides for specific platforms.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure tests pass
5. Submit a pull request

## License

This project is proprietary software. All rights reserved.

## Support

For issues, questions, or support, please contact the development team.

--- 

*Last updated: August 25, 2026*