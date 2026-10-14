export interface SandboxTemplate {
  id: string;
  name: string;
  description: string;
  provider: "createos" | "box" | "docker" | "e2b" | "daytona" | "desktop" | "fake";
  config: SandboxTemplateConfig;
  resources: ResourceQuota;
  environment: EnvironmentConfig;
  tools: string[];
  security: SecurityProfile;
  networking: NetworkConfig;
  metadata: TemplateMetadata;
}

export interface SandboxTemplateConfig {
  baseImage?: string;
  startupScript?: string;
  healthCheck?: string;
  autoCleanup?: string;
  shutdownScript?: string;
  environmentVariables?: Record<string, string>;
  initScripts?: string[];
}

export interface ResourceQuota {
  cpu: string;
  memory: string;
  storage: string;
  ports?: number[];
  concurrentUsers?: number;
  maxFileSize?: string;
}

export interface EnvironmentConfig {
  runtime?: string;
  kernel?: string;
  locale?: string;
  timezone?: string;
  proxy?: string;
  dns?: string[];
}

export interface SecurityProfile {
  network: "isolated" | "nat" | "bridge";
  filesystem: "read-write" | "read-only" | "encrypted";
  capabilities: string[];
  allowedUsers?: string[];
  firewallRules?: FirewallRule[];
}

export interface FirewallRule {
  protocol: "tcp" | "udp" | "icmp";
  portRange: string;
  source?: string;
  destination?: string;
  action: "allow" | "deny";
}

export interface NetworkConfig {
  proxy?: string;
  dns?: string[];
  allowedPorts?: number[];
  egress?: EgressRule[];
  vpc?: string;
}

export interface EgressRule {
  host: string;
  port?: number;
  protocol: "tcp" | "udp" | "icmp";
  description?: string;
}

export interface TemplateMetadata {
  version: string;
  supportTier: "free" | "basic" | "professional" | "enterprise";
  sla?: string;
  tags: string[];
  documentation?: string;
  pricing?: PricingInfo;
}

export interface PricingInfo {
  unit: string;
  currency: string;
  pricePerHour?: number;
  freeTier?: boolean;
}

export const CORE_SANDBOX_TEMPLATES: SandboxTemplate[] = [
  {
    id: "dev-template",
    name: "Development Sandbox",
    description:
      "Lightweight development environment with full debugging capabilities and hot-reloading",
    provider: "createos",
    config: {
      baseImage: "ubuntu:22.04",
      startupScript: "/opt/dev/start.sh",
      healthCheck: "/health-check.sh",
      autoCleanup: "4h",
      environmentVariables: {
        NODE_ENV: "development",
        DEBUG: "rakazo:*",
        CHOKIDAR_USEPOLLING: "true",
      },
      initScripts: [
        "apt-get update && apt-get install -y curl wget git vim nano",
        "npm install -g pnpm",
        "corepack enable",
      ],
    },
    resources: {
      cpu: "2 cores",
      memory: "4GB",
      storage: "20GB",
      ports: [3000, 5000, 8080, 3306],
      concurrentUsers: 1,
      maxFileSize: "100MB",
    },
    environment: {
      runtime: "nodejs-18",
      kernel: "linux",
      locale: "en_US.UTF-8",
      timezone: "America/New_York",
      proxy: "http://proxy.internal:8080",
      dns: ["8.8.8.8", "1.1.1.1"],
    },
    tools: [
      "curl",
      "wget",
      "git",
      "vim",
      "nano",
      "npm",
      "pnpm",
      "node",
      "python3",
      "pip",
      "docker",
      "docker-compose",
    ],
    security: {
      network: "isolated",
      filesystem: "read-write",
      capabilities: ["network", "file-system", "process"],
      allowedUsers: ["rakazo-user"],
      firewallRules: [
        {
          protocol: "tcp",
          portRange: "3000-5000",
          source: "localhost",
          action: "allow",
        },
        {
          protocol: "tcp",
          portRange: "8080",
          source: "0.0.0.0/0",
          action: "deny",
        },
      ],
    },
    networking: {
      proxy: "http://proxy.internal:8080",
      dns: ["8.8.8.8", "1.1.1.1"],
      allowedPorts: [3000, 5000, 8080],
      egress: [
        {
          host: "api.npmjs.org",
          port: 443,
          protocol: "tcp",
          description: "npm package registry",
        },
        {
          host: "registry.npmjs.org",
          port: 443,
          protocol: "tcp",
          description: "npm registry",
        },
      ],
      vpc: "dev-vpc",
    },
    metadata: {
      version: "1.2.0",
      supportTier: "basic",
      sla: "99.5%",
      tags: ["development", "nodejs", "python", "docker"],
      documentation: "https://docs.rakazo.io/dev-sandbox",
      pricing: {
        unit: "hour",
        currency: "USD",
        pricePerHour: 0.5,
        freeTier: false,
      },
    },
  },
  {
    id: "staging-template",
    name: "Staging Sandbox",
    description: "Production-like environment for staging applications with monitoring and logging",
    provider: "box",
    config: {
      baseImage: "ubuntu:22.04",
      startupScript: "/opt/staging/start.sh",
      healthCheck: "/health-check.sh",
      autoCleanup: "2h",
      environmentVariables: {
        NODE_ENV: "staging",
        DEBUG: "rakazo:*",
        LOG_LEVEL: "info",
      },
      initScripts: [
        "apt-get update && apt-get install -y curl wget git vim",
        "curl -sSL https://rclone.org/install.sh | bash",
        "mkdir -p /workspace/logs",
      ],
    },
    resources: {
      cpu: "4 cores",
      memory: "8GB",
      storage: "50GB",
      ports: [3000, 5000, 8080, 443],
      concurrentUsers: 2,
      maxFileSize: "500MB",
    },
    environment: {
      runtime: "nodejs-20",
      kernel: "linux",
      locale: "en_US.UTF-8",
      timezone: "UTC",
      proxy: "http://proxy.internal:8080",
      dns: ["1.1.1.1", "8.8.4.4"],
    },
    tools: ["curl", "wget", "git", "vim", "npm", "pnpm", "node", "python3", "pip", "rclone", "jq"],
    security: {
      network: "nat",
      filesystem: "read-write",
      capabilities: ["network", "file-system"],
      allowedUsers: ["rakazo-user", "staging-user"],
      firewallRules: [
        {
          protocol: "tcp",
          portRange: "8080-9090",
          source: "0.0.0.0/0",
          action: "allow",
        },
        {
          protocol: "icmp",
          portRange: "*",
          source: "*",
          action: "deny",
        },
      ],
    },
    networking: {
      proxy: "http://proxy.internal:8080",
      dns: ["1.1.1.1", "8.8.4.4"],
      allowedPorts: [8080, 8081, 8082],
      egress: [
        {
          host: "logs.internal",
          port: 443,
          protocol: "tcp",
          description: "internal logging",
        },
        {
          host: "metrics.internal",
          port: 8443,
          protocol: "tcp",
          description: "metrics endpoint",
        },
      ],
      vpc: "staging-vpc",
    },
    metadata: {
      version: "1.0.0",
      supportTier: "professional",
      sla: "99.9%",
      tags: ["staging", "production", "monitoring", "logging"],
      documentation: "https://docs.rakazo.io/staging-sandbox",
      pricing: {
        unit: "hour",
        currency: "USD",
        pricePerHour: 1.0,
        freeTier: false,
      },
    },
  },
  {
    id: "prod-template",
    name: "Production Sandbox",
    description: "High-performance production environment with enhanced security and redundancy",
    provider: "docker",
    config: {
      baseImage: "rakazo/computer:v1.2.0",
      startupScript: "/opt/prod/start.sh",
      healthCheck: "/health-check.sh",
      autoCleanup: "1h",
      environmentVariables: {
        NODE_ENV: "production",
        DEBUG: "rakazo:*",
        LOG_LEVEL: "error",
      },
      initScripts: [
        "apt-get update && apt-get install -y curl wget git",
        "echo 'Running as user: $(whoami)'",
        "echo 'Container ID: $(hostname)'",
      ],
    },
    resources: {
      cpu: "8 cores",
      memory: "16GB",
      storage: "100GB",
      ports: [80, 443, 3000],
      concurrentUsers: 5,
      maxFileSize: "2GB",
    },
    environment: {
      runtime: "linux",
      kernel: "linux",
      locale: "en_US.UTF-8",
      timezone: "UTC",
      proxy: "",
      dns: ["1.1.1.1"],
    },
    tools: ["curl", "wget", "git", "jq", "bash", "python3", "vim"],
    security: {
      network: "bridge",
      filesystem: "encrypted",
      capabilities: ["network", "file-system"],
      allowedUsers: ["rakazo-user"],
      firewallRules: [
        {
          protocol: "tcp",
          portRange: "80-443",
          source: "0.0.0.0/0",
          action: "allow",
        },
        {
          protocol: "icmp",
          portRange: "*",
          source: "*",
          action: "deny",
        },
      ],
    },
    networking: {
      proxy: "",
      dns: ["1.1.1.1"],
      allowedPorts: [80, 443, 3000],
      egress: [
        {
          host: "api.rakazo.io",
          port: 443,
          protocol: "tcp",
          description: "Rakazo API",
        },
        {
          host: "auth.rakazo.io",
          port: 443,
          protocol: "tcp",
          description: "Rakazo Auth",
        },
      ],
      vpc: "prod-vpc",
    },
    metadata: {
      version: "2.0.0",
      supportTier: "enterprise",
      sla: "99.99%",
      tags: ["production", "high-security", "redundancy"],
      documentation: "https://docs.rakazo.io/prod-sandbox",
      pricing: {
        unit: "hour",
        currency: "USD",
        pricePerHour: 2.5,
        freeTier: false,
      },
    },
  },
];

export function getSandboxTemplate(id: string): SandboxTemplate | undefined {
  return CORE_SANDBOX_TEMPLATES.find((t) => t.id === id);
}

export function getSandboxTemplatesByProvider(
  provider: SandboxTemplate["provider"],
): SandboxTemplate[] {
  return CORE_SANDBOX_TEMPLATES.filter((t) => t.provider === provider);
}

export function getAllSandboxTemplates(): SandboxTemplate[] {
  return CORE_SANDBOX_TEMPLATES;
}

export function createSandboxTemplate(
  template: SandboxTemplate,
  overrides: Partial<SandboxTemplate> = {},
): SandboxTemplate {
  return {
    ...template,
    ...overrides,
    id: overrides.id ?? `${template.id}-${Date.now()}`,
    name: overrides.name ?? template.name,
  };
}
