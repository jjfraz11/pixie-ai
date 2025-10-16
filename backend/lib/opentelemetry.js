import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { metrics, ValueType } from "@opentelemetry/api"; // Import metrics and ValueType
import { PrismaInstrumentation } from '@prisma/instrumentation'; // Import PrismaInstrumentation
const sdk = new NodeSDK({
    serviceName: "pixie-ai-backend",
    instrumentations: [
        getNodeAutoInstrumentations(),
        new PrismaInstrumentation(), // Add Prisma instrumentation
    ],
});
// Get the global MeterProvider
const meter = metrics.getMeterProvider().getMeter('pixie-ai-metrics');
// Create custom metrics
export const activeUsersGauge = meter.createGauge('active_users', {
    description: 'Number of active users',
    unit: '1',
    valueType: ValueType.INT,
});
export const sessionDurationHistogram = meter.createHistogram('session_duration_seconds', {
    description: 'Duration of sessions in seconds',
    unit: 's',
    valueType: ValueType.DOUBLE,
    boundaries: [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600, 1800, 3600], // Example boundaries
});
export const errorRateCounter = meter.createCounter('error_rate_total', {
    description: 'Total count of errors',
    unit: '1',
    valueType: ValueType.INT,
});
export default sdk;
