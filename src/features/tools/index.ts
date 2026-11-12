import { registry } from "./registry";
import { echoTool } from "./tools/echo";
import { scheduleLinkTool } from "./tools/schedule-link";
import { scheduleHighLevelTool } from "./tools/schedule-highlevel";
import { checkAvailabilityTool } from "./tools/check-availability";
import { customWebhookTool } from "./tools/custom-webhook";
import {
  agendaBookTool,
  agendaCancelTool,
  agendaMyAppointmentsTool,
  agendaRescheduleTool,
  agendaServicesTool,
  agendaSlotsTool,
} from "./tools/agenda";
import { humanHandoffTool } from "./tools/handoff";

registry.register(echoTool);
registry.register(scheduleLinkTool);
registry.register(scheduleHighLevelTool);
registry.register(checkAvailabilityTool);
registry.register(customWebhookTool);
registry.register(agendaServicesTool);
registry.register(agendaSlotsTool);
registry.register(agendaBookTool);
registry.register(agendaMyAppointmentsTool);
registry.register(agendaCancelTool);
registry.register(agendaRescheduleTool);
registry.register(humanHandoffTool);

export { registry };
export type {
  Tool,
  ToolContext,
  ToolResult,
  ToolSensitivity,
} from "./core/tool";
