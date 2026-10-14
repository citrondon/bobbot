import type {
  AdapterContext,
  AgentHomeStore,
  ComputerRef,
  SandboxProvider,
} from "@bobbot/adapter-kit";
import type { ComputerUpdate } from "@bobbot/contracts";
import type { PrismaClient } from "@bobbot/db";
import { getLogger } from "@bobbot/logging";

export interface BotMetrics {
  cpu: number; // Percentage 0-100
  memory: number; // Percentage 0-100
  network: number; // Mbps
  responseTime: number; // milliseconds
  concurrentUsers?: number;
  timestamp: number;
}

export interface ScalingRule {
  type: "cpu" | "memory" | "responseTime" | "concurrentUsers";
  threshold: number;
  action: "scale_up" | "scale_down" | "maintain";
  severity: "low" | "medium" | "high";
  cooldownMs?: number;
}

export interface ResourceQuota {
  cpu: number; // cores
  memory: number; // GB
  storage: number; // GB
  ports?: number[];
  concurrentUsers?: number;
  maxFileSize?: number; // MB
}

export interface ScalingEvent {
  botId: string;
  runId: string;
  eventType: "scale_up" | "scale_down" | "circuit_breaker";
  reason: string;
  from: ResourceQuota;
  to: ResourceQuota;
  timestamp: number;
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

export class BotAutoScaler {
  private scalingRules: Map<string, ScalingRule[]> = new Map();
  private lastScalingEvents: Map<string, ScalingEvent[]> = new Map();
  private lastScalingTimes: Map<string, number> = new Map();
  private evaluationIntervals: Map<string, NodeJS.Timeout> = new Map();
  private metricsCollector: MetricsCollector;

  constructor(
    private deps: {
      prisma: PrismaClient;
      sandbox: SandboxProvider;
      home: AgentHomeStore;
    },
  ) {
    this.metricsCollector = new MetricsCollector(deps);
    this.setupDefaultScalingRules();
  }

  async startAutoScaling(botId: string): Promise<void> {
    // Initialize metrics collection for this bot
    await this.metricsCollector.startCollecting(botId);

    // Start scaling evaluation interval (every 15 seconds)
    const evalInterval = setInterval(async () => {
      await this.evaluateScalingNeeds(botId);
    }, 15000);
    this.evaluationIntervals.set(`${botId}:eval`, evalInterval);

    // Start circuit breaker monitoring
    const cbInterval = setInterval(async () => {
      await this.checkCircuitBreakerConditions(botId);
    }, 10000);
    this.evaluationIntervals.set(`${botId}:cb`, cbInterval);
  }

  async stopAutoScaling(botId: string): Promise<void> {
    for (const [key, interval] of this.evaluationIntervals) {
      if (key.startsWith(botId)) {
        clearInterval(interval);
        this.evaluationIntervals.delete(key);
      }
    }
  }

  private async evaluateScalingNeeds(botId: string): Promise<void> {
    try {
      // Get current metrics
      const metrics = await this.metricsCollector.getMetrics(botId);

      // Get current resource quota
      const currentQuota = await this.getCurrentResourceQuota(botId);

      // Get scaling rules for this bot
      const rules = this.scalingRules.get(botId) || this.scalingRules.get("default") || [];

      // Evaluate each rule
      let scaleTo: ResourceQuota | null = null;
      let reason = "No scaling needed";

      for (const rule of rules) {
        // Check cooldown
        const lastScale = this.lastScalingTimes.get(botId) || 0;
        if (rule.cooldownMs && Date.now() - lastScale < rule.cooldownMs) {
          continue;
        }

        const shouldScale = this.evaluateRule(metrics, rule);

        if (shouldScale && rule.action !== "maintain") {
          const targetQuota = await this.calculateTargetQuota(currentQuota, rule, metrics);

          if (targetQuota) {
            scaleTo = targetQuota;
            reason = `Rule triggered: ${rule.type} > ${rule.threshold}`;
            break; // First matching rule wins
          }
        }
      }

      if (scaleTo && JSON.stringify(scaleTo) !== JSON.stringify(currentQuota)) {
        await this.executeScaling(botId, scaleTo, reason);
      }
    } catch (error) {
      getLogger().error(`Auto-scaling evaluation failed for bot ${botId}:`, error);
    }
  }

  private evaluateRule(metrics: BotMetrics, rule: ScalingRule): boolean {
    switch (rule.type) {
      case "cpu":
        return metrics.cpu > rule.threshold;
      case "memory":
        return metrics.memory > rule.threshold;
      case "responseTime":
        return metrics.responseTime > rule.threshold;
      case "concurrentUsers":
        return (metrics.concurrentUsers || 0) > rule.threshold;
      default:
        return false;
    }
  }

  private async calculateTargetQuota(
    currentQuota: ResourceQuota,
    rule: ScalingRule,
    metrics: BotMetrics,
  ): Promise<ResourceQuota> {
    const multiplier = rule.action === "scale_up" ? 1.5 : 0.5;
    const newQuota = { ...currentQuota };

    switch (rule.type) {
      case "cpu":
        newQuota.cpu = Math.max(1, Math.min(32, currentQuota.cpu * multiplier));
        break;
      case "memory":
        newQuota.memory = Math.max(2, Math.min(64, currentQuota.memory * multiplier));
        break;
      case "responseTime":
        // Response time scaling reduces resources
        newQuota.cpu = Math.max(1, currentQuota.cpu * 0.8);
        newQuota.memory = Math.max(2, currentQuota.memory * 0.8);
        break;
      case "concurrentUsers":
        newQuota.concurrentUsers = Math.max(
          1,
          Math.min(10, (metrics.concurrentUsers || 1) * multiplier),
        );
        break;
      default:
        break;
    }

    return newQuota;
  }

  private async executeScaling(
    botId: string,
    targetQuota: ResourceQuota,
    reason: string,
  ): Promise<void> {
    try {
      // Get current computer ref for this bot
      const computerRef = await this.getComputerRef(botId);
      if (!computerRef) {
        throw new Error(`No computer found for bot ${botId}`);
      }

      // Get current resource quota from database
      const currentQuota = await this.getCurrentResourceQuota(botId);

      // Check cooldown period
      const lastScaleTime = this.lastScalingTimes.get(botId) || 0;
      const now = Date.now();

      if (
        currentQuota.cpu === targetQuota.cpu &&
        currentQuota.memory === targetQuota.memory &&
        currentQuota.concurrentUsers === targetQuota.concurrentUsers
      ) {
        // No actual change needed
        return;
      }

      // Update resource quota in database
      await this.updateResourceQuota(botId, targetQuota);

      // Log scaling event
      const scalingEvent: ScalingEvent = {
        botId,
        runId: botId, // TODO: Get actual runId from context
        eventType: targetQuota.cpu > currentQuota.cpu ? "scale_up" : "scale_down",
        reason,
        from: currentQuota,
        to: targetQuota,
        timestamp: now,
        success: true,
      };

      this.recordScalingEvent(scalingEvent);
      this.lastScalingTimes.set(botId, now);

      getLogger().info(`Bot ${botId} scaled: ${reason}`, scalingEvent);
    } catch (error) {
      getLogger().error(`Failed to scale bot ${botId}:`, error);

      // Record failed scaling event
      const scalingEvent: ScalingEvent = {
        botId,
        runId: botId,
        eventType: "scale_up",
        reason: `Scaling failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        from: { cpu: 1, memory: 2, storage: 10 },
        to: { cpu: 1, memory: 2, storage: 10 },
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      this.recordScalingEvent(scalingEvent);
      throw error;
    }
  }

  private async checkCircuitBreakerConditions(botId: string): Promise<void> {
    try {
      const recentEvents = this.lastScalingEvents.get(botId) || [];
      const failures = recentEvents.filter((event) => !event.success);
      const failureRate = failures.length / Math.max(recentEvents.length, 1);

      if (failureRate > 0.3) {
        // 30% failure rate
        await this.activateCircuitBreaker(botId, "High failure rate detected");
        return;
      }

      const metrics = await this.metricsCollector.getMetrics(botId);

      if (metrics.cpu > 90) {
        // Critical CPU usage
        await this.activateCircuitBreaker(botId, "Critical CPU usage");
        return;
      }

      if (metrics.memory > 95) {
        // Critical memory usage
        await this.activateCircuitBreaker(botId, "Critical memory usage");
        return;
      }
    } catch (error) {
      getLogger().error(`Circuit breaker check failed for bot ${botId}:`, error);
    }
  }

  private async activateCircuitBreaker(botId: string, reason: string): Promise<void> {
    try {
      // Update resource quota to minimal safe levels
      const minimalQuota: ResourceQuota = {
        cpu: 1,
        memory: 2,
        storage: 10,
        concurrentUsers: 1,
      };

      await this.updateResourceQuota(botId, minimalQuota);

      const scalingEvent: ScalingEvent = {
        botId,
        runId: botId,
        eventType: "circuit_breaker",
        reason,
        from: { cpu: 4, memory: 8, storage: 50, concurrentUsers: 5 },
        to: minimalQuota,
        timestamp: Date.now(),
        success: true,
      };

      this.recordScalingEvent(scalingEvent);
      getLogger().warn(`Circuit breaker activated for bot ${botId}: ${reason}`, scalingEvent);
    } catch (error) {
      getLogger().error(`Failed to activate circuit breaker for bot ${botId}:`, error);
    }
  }

  private setupDefaultScalingRules(): void {
    // Default scaling rules for all bots
    const defaultRules: ScalingRule[] = [
      {
        type: "cpu",
        threshold: 80,
        action: "scale_up",
        severity: "medium",
        cooldownMs: 300000, // 5 minutes
      },
      {
        type: "memory",
        threshold: 85,
        action: "scale_up",
        severity: "medium",
        cooldownMs: 300000,
      },
      {
        type: "responseTime",
        threshold: 1000,
        action: "scale_up",
        severity: "high",
        cooldownMs: 600000,
      },
      {
        type: "cpu",
        threshold: 50,
        action: "scale_down",
        severity: "low",
        cooldownMs: 120000, // 2 minutes
      },
      {
        type: "memory",
        threshold: 60,
        action: "scale_down",
        severity: "low",
        cooldownMs: 120000,
      },
    ];

    // Apply default rules to existing bots
    this.scalingRules.set("default", defaultRules);
  }

  private recordScalingEvent(event: ScalingEvent): void {
    let events = this.lastScalingEvents.get(event.botId) || [];
    events.push(event);

    // Keep only last 100 events per bot
    if (events.length > 100) {
      events = events.slice(-100);
    }

    this.lastScalingEvents.set(event.botId, events);
  }

  // Public API methods

  async configureScalingRules(botId: string, rules: ScalingRule[]): Promise<void> {
    this.scalingRules.set(botId, rules);
  }

  async getScalingMetrics(botId: string): Promise<ScalingEvent[]> {
    return this.lastScalingEvents.get(botId) || [];
  }

  async getCurrentResourceQuota(botId: string): Promise<ResourceQuota> {
    // Query database for current resource quota
    const computer = await this.deps.prisma.computer.findFirst({
      where: { bots: { some: { id: botId } } },
    });

    if (!computer) {
      // Default quota
      return {
        cpu: 1,
        memory: 2,
        storage: 10,
        concurrentUsers: 1,
      };
    }

    // Return default based on computer kind
    return this.getDefaultQuotaForKind(computer.kind);
  }

  private getDefaultQuotaForKind(kind: string): ResourceQuota {
    switch (kind) {
      case "docker":
        return { cpu: 2, memory: 4, storage: 20, concurrentUsers: 1 };
      case "e2b":
        return { cpu: 2, memory: 4, storage: 20, concurrentUsers: 1 };
      case "daytona":
        return { cpu: 4, memory: 8, storage: 50, concurrentUsers: 2 };
      case "box":
        return { cpu: 4, memory: 8, storage: 50, concurrentUsers: 2 };
      case "createos":
        return { cpu: 8, memory: 16, storage: 100, concurrentUsers: 5 };
      default:
        return { cpu: 1, memory: 2, storage: 10, concurrentUsers: 1 };
    }
  }

  private parseSandboxConfig(config: any): ResourceQuota {
    // Parse the sandbox configuration from database
    // This depends on how the sandbox config is stored
    return {
      cpu: config.cpu || 1,
      memory: config.memory || 2,
      storage: config.storage || 10,
      concurrentUsers: config.concurrentUsers || 1,
      ports: config.ports || [],
      maxFileSize: config.maxFileSize || 100,
    };
  }

  private async updateResourceQuota(botId: string, quota: ResourceQuota): Promise<void> {
    // Store the desired resource quota for next provision/replace
    // The actual scaling requires replacing the computer with new resources
    // This is done via the sandbox provider's provision with custom config

    const computer = await this.deps.prisma.computer.findFirst({
      where: { bots: { some: { id: botId } } },
      select: { id: true, kind: true },
    });

    if (!computer) return;

    // Store desired quota as JSON in homeRevision (overloaded for quota tracking)
    // In production, add a dedicated column or use sandboxConfig relation
    const quotaJson = JSON.stringify({ ...quota, updatedAt: Date.now() });

    await this.deps.prisma.computer.updateMany({
      where: { id: computer.id },
      data: { homeRevision: quotaJson },
    });

    getLogger().info("Resource quota updated", { botId, computerId: computer.id, quota });
  }

  private async getComputerRef(botId: string): Promise<any | null> {
    // Get computer reference for the bot
    const computer = await this.deps.prisma.computer.findFirst({
      where: { bots: { some: { id: botId } } },
    });

    if (!computer || !computer.providerRef) {
      return null;
    }

    return {
      id: computer.id,
      botId: botId,
      kind: computer.kind as "docker" | "e2b" | "daytona" | "box" | "desktop" | "fake",
      providerRef: computer.providerRef,
      fresh: false,
    };
  }
}

class MetricsCollector {
  constructor(
    private deps: {
      prisma: PrismaClient;
      sandbox: SandboxProvider;
      home: AgentHomeStore;
    },
  ) {}

  async startCollecting(botId: string): Promise<void> {
    // Initialize metrics collection for the bot
    // This would track CPU, memory, network, response time
  }

  async getMetrics(botId: string): Promise<BotMetrics> {
    // Get current metrics for the bot from the sandbox provider
    // In production, this would query provider APIs for real metrics
    // For now, we use the sandbox observe() to infer health metrics
    try {
      const computer = await this.deps.prisma.computer.findFirst({
        where: { bots: { some: { id: botId } } },
      });

      if (!computer?.providerRef) {
        return {
          cpu: 0,
          memory: 0,
          network: 0,
          responseTime: 0,
          timestamp: Date.now(),
        };
      }

      const computerRef: ComputerRef = {
        id: computer.id,
        botId,
        kind: computer.kind as any,
        providerRef: computer.providerRef,
        fresh: false,
      };

      // Measure response time via observe()
      const observeStart = Date.now();
      try {
        await this.deps.sandbox.observe(computerRef, {
          operationId: "metrics.observe",
          traceId: "metrics.observe",
          spaceId: computer.spaceId,
          userId: computer.userId,
          botId,
          signal: AbortSignal.timeout(5000),
        } as AdapterContext);
        const responseTime = Date.now() - observeStart;

        // Estimate CPU/memory from response time heuristics
        // Real implementation would query provider metrics API
        const cpu = Math.min(100, Math.max(0, responseTime / 50));
        const memory = Math.min(100, Math.max(0, responseTime / 75));

        return {
          cpu,
          memory,
          network: 0, // Not available without provider-specific API
          responseTime,
          timestamp: Date.now(),
        };
      } catch (error) {
        // If observe fails, assume high resource usage
        return {
          cpu: 95,
          memory: 95,
          network: 0,
          responseTime: 5000,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      getLogger().warn(`Metrics collection failed for bot ${botId}:`, { error: String(error) });
      return {
        cpu: 0,
        memory: 0,
        network: 0,
        responseTime: 0,
        timestamp: Date.now(),
      };
    }
  }
}
