/**
 * Deal Templates System
 * Allows users to create and use deal templates
 */

export interface DealTemplate {
  id: string;
  name: string;
  description: string;
  stage: string;
  probability: number;
  estimatedValue: number;
  nextAction: string;
  daysToClose: number;
  createdAt: Date;
}

const STORAGE_KEY = "pipeline_deal_templates";

export const DEFAULT_TEMPLATES: DealTemplate[] = [
  {
    id: "template_startup",
    name: "Startup Deal",
    description: "Quick deal with high probability",
    stage: "Prospecting",
    probability: 30,
    estimatedValue: 50000,
    nextAction: "Schedule discovery call",
    daysToClose: 30,
    createdAt: new Date(),
  },
  {
    id: "template_enterprise",
    name: "Enterprise Deal",
    description: "Complex deal with longer sales cycle",
    stage: "Prospecting",
    probability: 20,
    estimatedValue: 500000,
    nextAction: "Send requirements questionnaire",
    daysToClose: 120,
    createdAt: new Date(),
  },
  {
    id: "template_quick_win",
    name: "Quick Win",
    description: "Small, fast deal",
    stage: "Proposal",
    probability: 70,
    estimatedValue: 15000,
    nextAction: "Send proposal",
    daysToClose: 7,
    createdAt: new Date(),
  },
];

export function getTemplates(): DealTemplate[] {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_TEMPLATES;
    
    const parsed = JSON.parse(stored);
    // Validate parsed is array
    if (!Array.isArray(parsed)) {
      console.error("DealTemplates: Invalid stored format, expected array");
      return DEFAULT_TEMPLATES;
    }

    // Validate and filter each template
    const validCustom = parsed
      .filter((t) => {
        if (!t || typeof t !== "object") return false;
        if (!t.id || typeof t.id !== "string") return false;
        if (!t.name || typeof t.name !== "string") return false;
        if (typeof t.probability !== "number" || t.probability < 0 || t.probability > 100) return false;
        if (typeof t.estimatedValue !== "number" || t.estimatedValue < 0) return false;
        return true;
      })
      .map((t) => ({
        ...t,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
      }));

    return [
      ...DEFAULT_TEMPLATES,
      ...validCustom,
    ];
  } catch (e) {
    console.error("DealTemplates: Error reading from localStorage:", e);
    return DEFAULT_TEMPLATES;
  }
}

export function createTemplate(
  name: string,
  description: string,
  template: Omit<DealTemplate, "id" | "createdAt">
): DealTemplate | null {
  // Validate inputs
  if (!name || typeof name !== "string") {
    console.error("DealTemplates: Template name is required");
    return null;
  }
  if (!description || typeof description !== "string") {
    console.error("DealTemplates: Template description is required");
    return null;
  }
  if (!template || typeof template !== "object") {
    console.error("DealTemplates: Invalid template object");
    return null;
  }

  // Validate template structure
  if (typeof template.probability !== "number" || template.probability < 0 || template.probability > 100) {
    console.error("DealTemplates: Probability must be between 0 and 100");
    return null;
  }
  if (typeof template.estimatedValue !== "number" || template.estimatedValue < 0) {
    console.error("DealTemplates: Estimated value must be positive");
    return null;
  }
  if (!template.stage || typeof template.stage !== "string") {
    console.error("DealTemplates: Stage is required");
    return null;
  }

  try {
    const templates = getTemplates();
    
    const newTemplate: DealTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      name: name.slice(0, 100), // Limit name length
      description: description.slice(0, 500), // Limit description
      createdAt: new Date(),
    };

    const customTemplates = templates.filter(
      (t) => t.id.startsWith("template_") && !DEFAULT_TEMPLATES.find((d) => d.id === t.id)
    );
    customTemplates.push(newTemplate);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
    
    return newTemplate;
  } catch (e) {
    console.error("DealTemplates: Error creating template:", e);
    return null;
  }
}

export function deleteTemplate(id: string): boolean {
  // Validate input
  if (!id || typeof id !== "string") {
    console.error("DealTemplates: Template ID is required");
    return false;
  }

  // Prevent deletion of default templates
  if (DEFAULT_TEMPLATES.find((d) => d.id === id)) {
    console.error("DealTemplates: Cannot delete default templates");
    return false;
  }

  try {
    const templates = getTemplates();
    const filtered = templates.filter((t) => t.id !== id);
    
    // Only save if something was actually deleted
    if (filtered.length === templates.length) {
      console.warn("DealTemplates: Template not found for deletion:", id);
      return false;
    }

    // Extract only custom templates for storage
    const customToSave = filtered.filter(
      (t) => !DEFAULT_TEMPLATES.find((d) => d.id === t.id)
    );
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customToSave));
    return true;
  } catch (e) {
    console.error("DealTemplates: Error deleting template:", e);
    return false;
  }
}
