import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fleet Command & Control API',
      version: '1.0.0',
      description: 'API documentation for the Fleet Command & Control server. This API manages carputer devices, images, commands, and metrics.\n\n**Authentication**: Most endpoints require a JWT Bearer token. Get your token by logging in via the frontend or directly via GoTrue at `/auth/v1/token?grant_type=password`.\n\n**Postman Import**: Import this API into Postman by using the OpenAPI JSON at `/api-docs/swagger.json`.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from Supabase Auth (GoTrue). Get token by logging in at /login or via POST /auth/v1/token?grant_type=password',
        },
        deviceAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-device-mac',
          description: 'Device authentication using MAC address (for device endpoints only)',
        },
        deviceIdAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-device-id',
          description: 'Device authentication using device ID (for device endpoints only)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Validation error details',
            },
          },
        },
        Device: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Internal device ID',
            },
            device_id: {
              type: 'string',
              description: 'Device identifier',
            },
            mac_address: {
              type: 'string',
              description: 'MAC address',
            },
            hostname: {
              type: 'string',
              nullable: true,
            },
            vin: {
              type: 'string',
              nullable: true,
            },
            hardware_rev: {
              type: 'string',
              nullable: true,
            },
            build_id: {
              type: 'string',
              nullable: true,
            },
            current_build_id: {
              type: 'string',
              nullable: true,
            },
            image_id: {
              type: 'integer',
              nullable: true,
            },
            image_build_hash: {
              type: 'string',
              nullable: true,
            },
            image_signature: {
              type: 'string',
              nullable: true,
            },
            image_verified: {
              type: 'boolean',
            },
            current_version: {
              type: 'string',
              nullable: true,
            },
            current_ip: {
              type: 'string',
              nullable: true,
            },
            registration_ip: {
              type: 'string',
              nullable: true,
            },
            registration_method: {
              type: 'string',
              enum: ['auto', 'manual'],
            },
            authorized: {
              type: 'boolean',
            },
            authorized_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            authorized_by: {
              type: 'string',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['online', 'offline', 'unknown'],
            },
            first_seen: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            last_seen: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Image: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            build_hash: {
              type: 'string',
            },
            signature: {
              type: 'string',
              nullable: true,
            },
            build_id: {
              type: 'string',
              nullable: true,
            },
            git_sha: {
              type: 'string',
              nullable: true,
            },
            build_timestamp: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            verified: {
              type: 'boolean',
            },
            verified_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            verified_by: {
              type: 'string',
              nullable: true,
            },
            notes: {
              type: 'string',
              nullable: true,
            },
            is_active: {
              type: 'boolean',
            },
            is_latest: {
              type: 'boolean',
            },
            changelog: {
              type: 'string',
              nullable: true,
            },
            device_count: {
              type: 'integer',
            },
            devices: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Device',
              },
            },
          },
        },
        Command: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            device_id: {
              type: 'integer',
            },
            command: {
              type: 'string',
              enum: ['reboot', 'start_service', 'stop_service', 'trigger_rsync', 'collect_logs', 'update'],
            },
            parameters: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed'],
            },
            result: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
            },
            error: {
              type: 'string',
              nullable: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Metrics: {
          type: 'object',
          properties: {
            devices: {
              type: 'object',
              properties: {
                byStatus: {
                  type: 'object',
                  additionalProperties: {
                    type: 'integer',
                  },
                },
                online: {
                  type: 'integer',
                },
              },
            },
            versions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  current_build_id: {
                    type: 'string',
                  },
                  count: {
                    type: 'integer',
                  },
                },
              },
            },
            commands: {
              type: 'object',
              properties: {
                last24h: {
                  type: 'object',
                  additionalProperties: {
                    type: 'integer',
                  },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Devices',
        description: 'Device registration and management',
      },
      {
        name: 'Commands',
        description: 'Device command management',
      },
      {
        name: 'Images',
        description: 'Image verification and management',
      },
      {
        name: 'Metrics',
        description: 'Fleet metrics and statistics',
      },
    ],
  },
  apis: ['src/routes/*.ts'], // Path to the API files (relative to backend directory)
};

export const swaggerSpec = swaggerJsdoc(options);

