/**
 * DOM Extractor for rrweb Session Replay
 *
 * Extracts relevant DOM context from rrweb FullSnapshot for LLM bug analysis.
 * Instead of passing entire DOM tree (thousands of tokens), extracts only
 * clicked elements and form context (~200-500 tokens).
 */

// rrweb node types
const NodeType = {
  Document: 0,
  DocumentType: 1,
  Element: 2,
  Text: 3,
  CDATA: 4,
  Comment: 5,
} as const;

// rrweb event types
const EventType = {
  DomContentLoaded: 0,
  Load: 1,
  FullSnapshot: 2,
  IncrementalSnapshot: 3,
  Meta: 4,
  Custom: 5,
  Plugin: 6,
} as const;

// rrweb incremental snapshot sources
const IncrementalSource = {
  Mutation: 0,
  MouseMove: 1,
  MouseInteraction: 2,
  Scroll: 3,
  ViewportResize: 4,
  Input: 5,
  TouchMove: 6,
  MediaInteraction: 7,
  StyleSheetRule: 8,
  CanvasMutation: 9,
  Font: 10,
  Log: 11,
  Drag: 12,
  StyleDeclaration: 13,
  Selection: 14,
  AdoptedStyleSheet: 15,
  CustomElement: 16,
} as const;

interface SerializedNode {
  id: number;
  type: number;
  tagName?: string;
  attributes?: Record<string, string | boolean | number>;
  textContent?: string;
  childNodes?: SerializedNode[];
}

interface RrwebEvent {
  type: number;
  timestamp: number;
  data: {
    node?: SerializedNode;
    source?: number;
    id?: number;
    x?: number;
    y?: number;
    text?: string;
    isChecked?: boolean;
    [key: string]: unknown;
  };
}

export interface SimplifiedElement {
  tagName: string;
  id?: string;
  className?: string;
  attributes: Record<string, string>;
  textContent: string;
  path: string;
}

export interface FormInput {
  tagName: string;
  type?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface FormContext {
  formElement: SimplifiedElement | null;
  inputs: FormInput[];
  submitButton: SimplifiedElement | null;
}

export interface DOMContext {
  clickedElement: SimplifiedElement | null;
  formContext: FormContext | null;
  lastInputs: Array<{ elementId: number; value: string; timestamp: number }>;
  interactionSummary: {
    clicks: number;
    inputs: number;
    scrolls: number;
    totalEvents: number;
  };
}

function findNodeById(node: SerializedNode, targetId: number): SerializedNode | null {
  if (node.id === targetId) return node;

  if (node.childNodes) {
    for (const child of node.childNodes) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }

  return null;
}

function findParentChain(
  root: SerializedNode,
  targetId: number,
  chain: SerializedNode[] = []
): SerializedNode[] | null {
  if (root.id === targetId) {
    return chain;
  }

  if (root.childNodes) {
    for (const child of root.childNodes) {
      const result = findParentChain(child, targetId, [...chain, root]);
      if (result) return result;
    }
  }

  return null;
}

function findClosestForm(
  root: SerializedNode,
  targetId: number
): SerializedNode | null {
  const chain = findParentChain(root, targetId);
  if (!chain) return null;

  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].tagName?.toLowerCase() === 'form') {
      return chain[i];
    }
  }

  return null;
}

function findElementsByTagName(
  node: SerializedNode,
  tagName: string,
  results: SerializedNode[] = []
): SerializedNode[] {
  if (node.type === NodeType.Element && node.tagName?.toLowerCase() === tagName.toLowerCase()) {
    results.push(node);
  }

  if (node.childNodes) {
    for (const child of node.childNodes) {
      findElementsByTagName(child, tagName, results);
    }
  }

  return results;
}

function extractTextContent(node: SerializedNode, maxLength: number = 100): string {
  if (node.type === NodeType.Text) {
    return (node.textContent || '').trim().slice(0, maxLength);
  }

  if (node.childNodes) {
    const texts: string[] = [];
    for (const child of node.childNodes) {
      const text = extractTextContent(child, maxLength);
      if (text) texts.push(text);
      if (texts.join(' ').length >= maxLength) break;
    }
    return texts.join(' ').slice(0, maxLength);
  }

  return '';
}

function buildElementPath(chain: SerializedNode[]): string {
  return chain
    .filter(n => n.type === NodeType.Element && n.tagName)
    .map(n => {
      let selector = n.tagName!.toLowerCase();
      const attrs = n.attributes || {};
      if (attrs.id) selector += `#${attrs.id}`;
      else if (attrs.class) {
        const firstClass = String(attrs.class).split(' ')[0];
        if (firstClass && !isTailwindClass(firstClass)) {
          selector += `.${firstClass}`;
        }
      }
      return selector;
    })
    .join(' > ');
}

function isTailwindClass(className: string): boolean {
  const prefixes = [
    'flex', 'grid', 'block', 'inline', 'hidden',
    'w-', 'h-', 'm-', 'p-', 'mt-', 'mb-', 'ml-', 'mr-', 'mx-', 'my-',
    'pt-', 'pb-', 'pl-', 'pr-', 'px-', 'py-',
    'text-', 'font-', 'bg-', 'border-', 'rounded-', 'shadow-',
    'gap-', 'space-', 'justify-', 'items-', 'overflow-', 'z-',
    'min-', 'max-', 'top-', 'bottom-', 'left-', 'right-',
    'absolute', 'relative', 'fixed', 'sticky', 'dark:',
  ];
  return prefixes.some(p => className.startsWith(p) || className === p.replace('-', ''));
}

function simplifyNode(node: SerializedNode, root: SerializedNode): SimplifiedElement {
  const attrs = node.attributes || {};
  const chain = findParentChain(root, node.id) || [];

  return {
    tagName: node.tagName?.toLowerCase() || 'unknown',
    id: attrs.id ? String(attrs.id) : undefined,
    className: attrs.class ? String(attrs.class) : undefined,
    attributes: Object.fromEntries(
      Object.entries(attrs)
        .filter(([k]) => ['type', 'name', 'href', 'src', 'disabled', 'required', 'placeholder'].includes(k))
        .map(([k, v]) => [k, String(v)])
    ),
    textContent: extractTextContent(node, 50),
    path: buildElementPath([...chain, node]),
  };
}

function extractFormInputs(formNode: SerializedNode): FormInput[] {
  const inputs: FormInput[] = [];
  const inputElements = [
    ...findElementsByTagName(formNode, 'input'),
    ...findElementsByTagName(formNode, 'textarea'),
    ...findElementsByTagName(formNode, 'select'),
  ];

  for (const input of inputElements) {
    const attrs = input.attributes || {};
    inputs.push({
      tagName: input.tagName?.toLowerCase() || 'input',
      type: attrs.type ? String(attrs.type) : undefined,
      name: attrs.name ? String(attrs.name) : undefined,
      value: attrs.value ? '[REDACTED]' : '',
      placeholder: attrs.placeholder ? String(attrs.placeholder) : undefined,
      required: attrs.required === true || attrs.required === 'true',
      disabled: attrs.disabled === true || attrs.disabled === 'true',
    });
  }

  return inputs;
}

function extractFormContext(
  root: SerializedNode,
  targetId: number
): FormContext | null {
  const formNode = findClosestForm(root, targetId);
  if (!formNode) return null;

  const submitButtons = findElementsByTagName(formNode, 'button')
    .filter(b => {
      const type = b.attributes?.type;
      return !type || type === 'submit';
    });

  return {
    formElement: simplifyNode(formNode, root),
    inputs: extractFormInputs(formNode),
    submitButton: submitButtons[0] ? simplifyNode(submitButtons[0], root) : null,
  };
}

export function extractDOMContext(eventsJson: string): DOMContext | null {
  let events: RrwebEvent[];
  try {
    events = JSON.parse(eventsJson);
  } catch {
    return null;
  }

  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  const fullSnapshot = events.find(e => e.type === EventType.FullSnapshot);
  if (!fullSnapshot?.data?.node) {
    return null;
  }

  const root = fullSnapshot.data.node;

  const clickEvents = events.filter(
    e => e.type === EventType.IncrementalSnapshot && e.data?.source === IncrementalSource.MouseInteraction
  );

  const inputEvents = events.filter(
    e => e.type === EventType.IncrementalSnapshot && e.data?.source === IncrementalSource.Input
  );

  const scrollEvents = events.filter(
    e => e.type === EventType.IncrementalSnapshot && e.data?.source === IncrementalSource.Scroll
  );

  const lastClick = clickEvents[clickEvents.length - 1];
  let clickedElement: SimplifiedElement | null = null;
  let formContext: FormContext | null = null;

  if (lastClick?.data?.id) {
    const node = findNodeById(root, lastClick.data.id);
    if (node) {
      clickedElement = simplifyNode(node, root);
      formContext = extractFormContext(root, lastClick.data.id);
    }
  }

  const lastInputs = inputEvents
    .slice(-5)
    .map(e => ({
      elementId: e.data?.id || 0,
      value: e.data?.text ? '[INPUT]' : '',
      timestamp: e.timestamp,
    }));

  return {
    clickedElement,
    formContext,
    lastInputs,
    interactionSummary: {
      clicks: clickEvents.length,
      inputs: inputEvents.length,
      scrolls: scrollEvents.length,
      totalEvents: events.length,
    },
  };
}

export function formatDOMContextForLLM(context: DOMContext): string {
  const lines: string[] = [];

  lines.push('## Session Replay DOM Context');
  lines.push('');

  lines.push(`**Interactions**: ${context.interactionSummary.clicks} clicks, ${context.interactionSummary.inputs} inputs, ${context.interactionSummary.scrolls} scrolls`);
  lines.push('');

  if (context.clickedElement) {
    const el = context.clickedElement;
    lines.push('**Last Clicked Element**:');
    lines.push(`- Tag: \`<${el.tagName}>\``);
    lines.push(`- Path: \`${el.path}\``);
    if (el.textContent) {
      lines.push(`- Text: "${el.textContent}"`);
    }
    if (Object.keys(el.attributes).length > 0) {
      lines.push(`- Attributes: ${JSON.stringify(el.attributes)}`);
    }
    lines.push('');
  }

  if (context.formContext) {
    const form = context.formContext;
    lines.push('**Form Context**:');
    if (form.formElement) {
      lines.push(`- Form path: \`${form.formElement.path}\``);
    }
    if (form.inputs.length > 0) {
      lines.push('- Inputs:');
      for (const input of form.inputs) {
        const attrs = [
          input.type && `type="${input.type}"`,
          input.name && `name="${input.name}"`,
          input.required && 'required',
          input.disabled && 'disabled',
          input.placeholder && `placeholder="${input.placeholder}"`,
        ].filter(Boolean).join(' ');
        lines.push(`  - \`<${input.tagName} ${attrs}>\` value=${input.value || '(empty)'}`);
      }
    }
    if (form.submitButton) {
      lines.push(`- Submit button: \`${form.submitButton.path}\` "${form.submitButton.textContent}"`);
    }
    lines.push('');
  }

  if (context.lastInputs.length > 0) {
    lines.push(`**Recent Input Events**: ${context.lastInputs.length} inputs captured`);
    lines.push('');
  }

  return lines.join('\n');
}

export function decompressSessionReplay(base64Data: string): string | null {
  try {
    if (typeof atob === 'function') {
      return atob(base64Data);
    }
    return Buffer.from(base64Data, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}
