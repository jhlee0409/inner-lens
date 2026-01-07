import { describe, it, expect } from 'vitest';
import {
  extractDOMContext,
  formatDOMContextForLLM,
  decompressSessionReplay,
} from './dom-extractor';

const SAMPLE_RRWEB_EVENTS = JSON.stringify([
  {
    type: 2,
    timestamp: 1704067200000,
    data: {
      node: {
        id: 1,
        type: 0,
        childNodes: [
          {
            id: 2,
            type: 2,
            tagName: 'html',
            attributes: {},
            childNodes: [
              {
                id: 3,
                type: 2,
                tagName: 'body',
                attributes: {},
                childNodes: [
                  {
                    id: 4,
                    type: 2,
                    tagName: 'form',
                    attributes: { id: 'member-form', class: 'add-member-form' },
                    childNodes: [
                      {
                        id: 5,
                        type: 2,
                        tagName: 'input',
                        attributes: { type: 'text', name: 'memberName', placeholder: 'Enter name' },
                        childNodes: [],
                      },
                      {
                        id: 6,
                        type: 2,
                        tagName: 'button',
                        attributes: { type: 'submit', class: 'submit-btn' },
                        childNodes: [
                          {
                            id: 7,
                            type: 3,
                            textContent: 'Add Member',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      initialOffset: { top: 0, left: 0 },
    },
  },
  {
    type: 3,
    timestamp: 1704067201000,
    data: {
      source: 2,
      id: 6,
      x: 100,
      y: 200,
    },
  },
  {
    type: 3,
    timestamp: 1704067200500,
    data: {
      source: 5,
      id: 5,
      text: 'test input',
    },
  },
]);

describe('extractDOMContext', () => {
  it('should extract clicked element from rrweb events', () => {
    const context = extractDOMContext(SAMPLE_RRWEB_EVENTS);

    expect(context).not.toBeNull();
    expect(context?.clickedElement?.tagName).toBe('button');
    expect(context?.clickedElement?.textContent).toBe('Add Member');
  });

  it('should extract form context when click is inside form', () => {
    const context = extractDOMContext(SAMPLE_RRWEB_EVENTS);

    expect(context?.formContext).not.toBeNull();
    expect(context?.formContext?.formElement?.tagName).toBe('form');
    expect(context?.formContext?.inputs).toHaveLength(1);
    expect(context?.formContext?.inputs[0].name).toBe('memberName');
    expect(context?.formContext?.submitButton?.textContent).toBe('Add Member');
  });

  it('should count interactions correctly', () => {
    const context = extractDOMContext(SAMPLE_RRWEB_EVENTS);

    expect(context?.interactionSummary.clicks).toBe(1);
    expect(context?.interactionSummary.inputs).toBe(1);
    expect(context?.interactionSummary.totalEvents).toBe(3);
  });

  it('should return null for invalid JSON', () => {
    expect(extractDOMContext('invalid json')).toBeNull();
  });

  it('should return null for empty events', () => {
    expect(extractDOMContext('[]')).toBeNull();
  });

  it('should return null for events without FullSnapshot', () => {
    const eventsWithoutSnapshot = JSON.stringify([
      { type: 3, timestamp: 1000, data: { source: 2, id: 1 } },
    ]);
    expect(extractDOMContext(eventsWithoutSnapshot)).toBeNull();
  });
});

describe('formatDOMContextForLLM', () => {
  it('should format context as markdown', () => {
    const context = extractDOMContext(SAMPLE_RRWEB_EVENTS);
    const formatted = formatDOMContextForLLM(context!);

    expect(formatted).toContain('## Session Replay DOM Context');
    expect(formatted).toContain('1 clicks');
    expect(formatted).toContain('**Last Clicked Element**');
    expect(formatted).toContain('<button>');
    expect(formatted).toContain('**Form Context**');
  });

  it('should include form inputs', () => {
    const context = extractDOMContext(SAMPLE_RRWEB_EVENTS);
    const formatted = formatDOMContextForLLM(context!);

    expect(formatted).toContain('name="memberName"');
    expect(formatted).toContain('placeholder="Enter name"');
  });
});

describe('decompressSessionReplay', () => {
  it('should decode base64 string', () => {
    const original = '{"test": "data"}';
    const base64 = Buffer.from(original).toString('base64');

    const decoded = decompressSessionReplay(base64);
    expect(decoded).toBe(original);
  });

  it('should return null for invalid base64', () => {
    expect(decompressSessionReplay('not-valid-base64!!!')).toBeNull();
  });
});
