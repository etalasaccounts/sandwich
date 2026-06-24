/** JSON Schemas enforcing agent outputs in the Claude Code workflow. */

export const INTAKE_SCHEMA = {
  type: "object",
  properties: {
    projectName: { type: "string" },
    confidence: { type: "string", enum: ["sufficient", "needs-more", "ambiguous"] },
    gaps: { type: "array", items: { type: "string" } },
    prd: { type: "string", description: "The full PRD markdown, ending with the Intake Quality block" },
  },
  required: ["projectName", "confidence", "prd"],
  additionalProperties: false,
} as const;

export const FEATURE_LIST_SCHEMA = {
  type: "object",
  properties: {
    projectName: { type: "string" },
    features: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          module: { type: "string" },
          userType: { type: "string" },
          divisions: { type: "array", items: { type: "string" } },
          userFlows: { type: "array", items: { type: "string" } },
          hasMissingFlow: { type: "boolean" },
          isInfrastructure: { type: "boolean" },
        },
        required: ["name", "module", "divisions"],
      },
    },
  },
  required: ["projectName", "features"],
} as const;

export const NFR_SCHEMA = {
  type: "object",
  properties: {
    nfrTasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          module: { type: "string" },
          division: { type: "string" },
          storyPoints: { type: "number" },
          description: { type: "string" },
          techNotes: { type: "string" },
          subtasks: { type: "array", items: { type: "string" } },
        },
        required: ["title", "module", "division"],
      },
    },
  },
  required: ["nfrTasks"],
} as const;

export const DEPS_SCHEMA = {
  type: "object",
  properties: {
    dependencies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: { type: "string" },
          blockedBy: { type: "array", items: { type: "string" } },
        },
        required: ["task", "blockedBy"],
      },
    },
  },
  required: ["dependencies"],
} as const;
