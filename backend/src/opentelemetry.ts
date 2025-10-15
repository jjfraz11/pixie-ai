import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const sdk = new NodeSDK({
  serviceName: "pixie-ai-backend",
  instrumentations: [getNodeAutoInstrumentations()],
});

export default sdk;
