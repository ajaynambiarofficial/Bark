import { escalationApiService } from "./escalation.api-service";
import { escalationService as mockEscalationService } from "./escalation.mock-service";

export const escalationService = import.meta.env.VITE_USE_MOCK_AUTH === "true"
  ? mockEscalationService
  : { ...escalationApiService, resetDemoData: () => [] };
